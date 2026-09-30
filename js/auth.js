// ============================================================================
// المصادقة: اختيار الجهة، إدخال PIN، التحقق عبر RPC آمنة، إدارة الجلسة محليًا
// ============================================================================

const SESSION_STORAGE_KEY = 'halawany_session';

const Auth = {
  pinBuffer: '',
  selectedDepartment: null,

  /** استرجاع جلسة محفوظة محليًا إن وُجدت ولم تنتهِ */
  loadSavedSession() {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (saved.expires_at && new Date(saved.expires_at) < new Date()) {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return null;
      }
      return saved;
    } catch { return null; }
  },

  saveSession(session) {
    // نخزّن نسخة محلية بمهلة 12 ساعة توافقًا مع مهلة الجلسة في قاعدة البيانات
    const expires_at = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const toSave = { ...session, expires_at };
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(toSave));
    STATE.session = toSave;
  },

  /**
   * إنهاء الجلسة والعودة لشاشة اختيار القسم فورًا.
   * (كان الخلل هنا: كان يُستدعى App.renderLogin وهي دالة غير موجودة،
   *  فيتوقف التنفيذ بخطأ ولا تتغير الشاشة.)
   */
  logout() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    STATE.session = null;
    // إغلاق أي نافذة مفتوحة وتنظيف الاشتراكات والمؤقتات قبل الخروج
    if (window.Modal) Modal.close();
    if (window.App && typeof App.teardown === 'function') App.teardown();
    // إعادة ضبط حالة الواجهة
    this.selectedDepartment = null;
    this.pinBuffer = '';
    STATE.searchTerm = '';
    this.renderLogin();
  },

  renderLogin() {
    const app = document.getElementById('app');
    app.innerHTML = '';

    const wrap = Utils.el('div', { class: 'login-screen' });
    wrap.appendChild(Utils.el('img', { src: 'assets/logo.png', class: 'login-logo', alt: 'شعار الحلواني' }));
    wrap.appendChild(Utils.el('h1', { class: 'login-title' }, 'تسجيل الدخول'));
    wrap.appendChild(Utils.el('p', { class: 'login-subtitle' }, 'اختر القسم أو الجهة، ثم أدخل رمز PIN المكوّن من 4 أرقام.'));

    const grid = Utils.el('div', { class: 'department-grid' });
    const visibleDepartments = (STATE.departments || []).filter(d => d.is_active);
    visibleDepartments.forEach(dep => {
      const card = Utils.el('button', {
        class: 'department-card',
        onclick: () => this.selectDepartment(dep)
      }, [
        Utils.el('span', { class: 'department-card__icon', html: `<i data-lucide="${Utils.deptIcon(dep)}"></i>` }),
        Utils.el('span', { class: 'department-card__name' }, dep.name)
      ]);
      grid.appendChild(card);
    });
    wrap.appendChild(grid);

    const pinHost = Utils.el('div', { id: 'pin-host' });
    wrap.appendChild(pinHost);

    app.appendChild(wrap);
    Utils.refreshIcons();
  },

  selectDepartment(dep) {
    this.selectedDepartment = dep;
    this.pinBuffer = '';
    this.renderPinPanel();
  },

  renderPinPanel() {
    const host = document.getElementById('pin-host');
    if (!host) return;
    host.innerHTML = '';

    const panel = Utils.el('div', { class: 'pin-panel' });
    panel.appendChild(Utils.el('div', { style: 'font-weight:800;margin-bottom:8px;' }, this.selectedDepartment.name));
    panel.appendChild(Utils.el('div', { style: 'color:var(--text-muted);font-size:0.88rem;' }, 'أدخل رمز PIN المكوّن من 4 أرقام'));

    const dots = Utils.el('div', { class: 'pin-dots' });
    for (let i = 0; i < 4; i++) {
      dots.appendChild(Utils.el('span', { class: 'pin-dot' + (i < this.pinBuffer.length ? ' filled' : '') }));
    }
    panel.appendChild(dots);

    const errorEl = Utils.el('div', { class: 'pin-error', id: 'pin-error' });
    panel.appendChild(errorEl);

    const keypad = Utils.el('div', { class: 'pin-keypad' });
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'مسح', '0', 'حذف'];
    keys.forEach(k => {
      keypad.appendChild(Utils.el('button', {
        class: 'pin-key',
        type: 'button',
        onclick: () => this.handleKey(k)
      }, k));
    });
    panel.appendChild(keypad);

    panel.appendChild(Utils.el('button', {
      class: 'btn btn-ghost btn-block',
      style: 'margin-top:12px;',
      onclick: () => { this.selectedDepartment = null; host.innerHTML = ''; }
    }, 'رجوع لاختيار الجهة'));

    host.appendChild(panel);
    Utils.refreshIcons();
  },

  handleKey(k) {
    if (k === 'حذف') { this.pinBuffer = this.pinBuffer.slice(0, -1); this.renderPinPanel(); return; }
    if (k === 'مسح') { this.pinBuffer = ''; this.renderPinPanel(); return; }
    if (this.pinBuffer.length >= 4) return;
    this.pinBuffer += k;
    this.renderPinPanel();
    if (this.pinBuffer.length === 4) this.submitPin();
  },

  async submitPin() {
    const errorEl = document.getElementById('pin-error');
    try {
      const { data, error } = await supabaseClient.rpc('verify_pin_and_create_session', {
        p_department_code: this.selectedDepartment.code,
        p_pin: this.pinBuffer
      });
      if (error || !data || !data.length) throw error || new Error('INVALID_PIN');

      const result = data[0];
      this.saveSession({
        token: result.session_token,
        department_id: result.department_id,
        department_name: result.department_name,
        department_kind: result.department_kind
      });
      await App.boot();
    } catch (e) {
      this.pinBuffer = '';
      this.renderPinPanel();
      const msg = document.getElementById('pin-error');
      if (msg) msg.textContent = 'رمز PIN غير صحيح، حاول مرة أخرى';
    }
  }
};
