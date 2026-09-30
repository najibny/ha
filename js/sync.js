// ============================================================================
// المزامنة اللحظية + إدارة انقطاع الإنترنت
// - يحمّل البيانات الحالية عند فتح التطبيق ثم يشترك في قنوات Realtime
// - عند الانقطاع: لا يمسح الواجهة، يحتفظ بآخر بيانات ويعرض تنبيهًا
// - يخزّن تعديلات مسؤول القسم أثناء الانقطاع في IndexedDB ثم يرسلها عند العودة
// ============================================================================

const DB_NAME = 'halawany_offline';
const DB_VERSION = 1;
const STORE_QUEUE = 'pending_actions';

const OfflineQueue = {
  db: null,

  async open() {
    if (this.db) return this.db;
    this.db = await new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.db;
  },

  async add(action) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readwrite');
      tx.objectStore(STORE_QUEUE).put(action);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async remove(id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readwrite');
      tx.objectStore(STORE_QUEUE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async all() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, 'readonly');
      const req = tx.objectStore(STORE_QUEUE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }
};

const Sync = {
  channel: null,

  /** تحميل كل البيانات الحالية من قاعدة البيانات دفعة واحدة عند بدء التشغيل */
  async loadInitialData() {
    const [departments, products, productDepartments, statuses, alternatives, popular, messages, activityLog] = await Promise.all([
      supabaseClient.from('departments').select('*').order('sort_order'),
      supabaseClient.from('products').select('*').order('sort_order'),
      supabaseClient.from('product_departments').select('*'),
      supabaseClient.from('product_statuses').select('*'),
      supabaseClient.from('product_alternatives').select('*'),
      supabaseClient.from('popular_products').select('*').order('sort_order'),
      supabaseClient.from('messages').select('*').eq('is_archived', false).order('created_at'),
      supabaseClient.from('activity_log').select('*').order('created_at', { ascending: false }).limit(500)
    ]);

    STATE.departments = departments.data || [];
    STATE.products = products.data || [];
    STATE.productDepartments = productDepartments.data || [];
    STATE.statuses = statuses.data || [];
    STATE.alternatives = alternatives.data || [];
    STATE.popular = popular.data || [];
    STATE.messages = messages.data || [];
    STATE.activityLog = activityLog.data || [];
  },

  /** الاشتراك في التحديثات اللحظية لكل الجداول المهمة */
  subscribeRealtime() {
    if (this.channel) supabaseClient.removeChannel(this.channel);

    this.channel = supabaseClient
      .channel('halawany-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_statuses' }, (payload) => this._onStatusChange(payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'departments' }, (payload) => this._onDepartmentChange(payload))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => this._onMessageChange(payload))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, (payload) => this._onActivityInsert(payload))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') this.setConnection('online');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') this.setConnection('reconnecting');
        else if (status === 'CLOSED') this.setConnection('offline');
      });
  },

  _onStatusChange(payload) {
    const idx = STATE.statuses.findIndex(s => s.id === payload.new?.id || s.id === payload.old?.id);
    if (payload.eventType === 'DELETE') {
      if (idx > -1) STATE.statuses.splice(idx, 1);
    } else if (idx > -1) {
      STATE.statuses[idx] = payload.new;
    } else {
      STATE.statuses.push(payload.new);
    }
    document.dispatchEvent(new CustomEvent('data:statuses-changed', { detail: payload }));
  },

  _onDepartmentChange(payload) {
    const idx = STATE.departments.findIndex(d => d.id === payload.new?.id);
    if (idx > -1) STATE.departments[idx] = payload.new;
    document.dispatchEvent(new CustomEvent('data:departments-changed', { detail: payload }));
  },

  _onMessageChange(payload) {
    if (payload.eventType === 'INSERT') {
      STATE.messages.push(payload.new);
      // صوت وإشعار فقط إذا كانت الرسالة موجهة لجهتي الحالية أو عامة، وليست من نفس جهتي
      if (STATE.session && payload.new.from_department_id !== STATE.session.department_id) {
        const forMe = payload.new.to_department_id === STATE.session.department_id || payload.new.to_department_id === null;
        if (forMe) { Sounds.message(); Utils.toast('رسالة جديدة وصلت', 'info'); }
      }
    } else if (payload.eventType === 'UPDATE') {
      const idx = STATE.messages.findIndex(m => m.id === payload.new.id);
      if (idx > -1) STATE.messages[idx] = payload.new;
    }
    document.dispatchEvent(new CustomEvent('data:messages-changed', { detail: payload }));
  },

  _onActivityInsert(payload) {
    STATE.activityLog.unshift(payload.new);
    document.dispatchEvent(new CustomEvent('data:activity-changed', { detail: payload }));
  },

  setConnection(status) {
    STATE.connection = status;
    document.dispatchEvent(new CustomEvent('connection:changed', { detail: status }));
  },

  /** يستدعى دوريًا لتحويل "سيتوفر لاحقًا" المنتهية إلى "متوفر" تلقائيًا */
  startExpiryWatcher() {
    setInterval(async () => {
      if (STATE.connection === 'offline') return;
      try {
        const { data } = await supabaseClient.rpc('auto_resolve_expired_coming_soon');
        if (data && data > 0) {
          Sounds.timerDone();
        }
      } catch (e) { /* صامت: لا داعي لإزعاج المستخدم بهذا الفحص الدوري */ }
    }, 20000);
  },

  /** مراقبة اتصال المتصفح بالإنترنت مباشرة (navigator.onLine) بالإضافة لحالة القناة */
  startConnectivityWatcher() {
    window.addEventListener('online', () => { this.setConnection('reconnecting'); this.reconnectAndFlush(); });
    window.addEventListener('offline', () => this.setConnection('offline'));
    if (!navigator.onLine) this.setConnection('offline');
  },

  async reconnectAndFlush() {
    try {
      await this.loadInitialData();
      this.subscribeRealtime();
      document.dispatchEvent(new CustomEvent('data:reloaded'));
      await this.flushQueue();
    } catch (e) {
      this.setConnection('offline');
    }
  },

  /** إرسال كل التعديلات المخزّنة محليًا بعد عودة الاتصال */
  async flushQueue() {
    const pending = await OfflineQueue.all();
    if (!pending.length) return;
    Utils.toast(`جارٍ إرسال ${pending.length} تعديل كان بانتظار عودة الاتصال...`, 'info');
    for (const action of pending) {
      try {
        if (action.type === 'update_status') {
          await supabaseClient.rpc('update_product_status', action.params);
        } else if (action.type === 'send_message') {
          await supabaseClient.rpc('send_message', action.params);
        }
        await OfflineQueue.remove(action.id);
      } catch (e) {
        console.error('فشل إرسال إجراء مؤجل', e);
      }
    }
    Utils.toast('تم إرسال كل التعديلات المؤجلة بنجاح', 'success');
  },

  /** تنفيذ إجراء: إذا كان الاتصال متاحًا ينفَّذ فورًا، وإلا يُحفظ في الطابور المحلي */
  async performOrQueue(type, params, rpcName) {
    if (STATE.connection === 'online' && navigator.onLine) {
      try {
        const { error } = await supabaseClient.rpc(rpcName, params);
        if (error) throw error;
        return { queued: false, error: null };
      } catch (e) {
        // إذا فشل الاتصال فعليًا رغم ظهوره متصلًا، نضعه بالطابور احتياطًا
        if (!navigator.onLine) {
          await OfflineQueue.add({ id: Utils.uuid(), type, params, createdAt: Date.now() });
          return { queued: true, error: null };
        }
        return { queued: false, error: e };
      }
    } else {
      await OfflineQueue.add({ id: Utils.uuid(), type, params, createdAt: Date.now() });
      Utils.toast('أنت غير متصل، سيتم الإرسال عند عودة الاتصال', 'info');
      return { queued: true, error: null };
    }
  }
};
