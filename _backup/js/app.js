// ============================================================================
// نقطة انطلاق التطبيق: التمهيد، الترويسة العامة، التوجيه بين الواجهات حسب الدور
// ============================================================================

const App = {
  async init() {
    this.applyTheme();
    Sync.startConnectivityWatcher();

    const saved = Auth.loadSavedSession();
    if (saved) {
      STATE.session = saved;
      await this.boot();
    } else {
      await this.loadPublicDataForLogin();
      Auth.renderLogin();
    }
  },

  /** قبل الدخول نحتاج فقط قائمة الأقسام لعرض بطاقات تسجيل الدخول */
  async loadPublicDataForLogin() {
    try {
      const { data } = await supabaseClient.from('departments').select('*').eq('is_active', true).order('sort_order');
      STATE.departments = data || [];
    } catch (e) {
      Utils.toast('تعذر الاتصال بالخادم، تحقق من الإنترنت', 'error');
    }
  },

  async boot() {
    try {
      await Sync.loadInitialData();
    } catch (e) {
      Utils.toast('أنت غير متصل، سيتم عرض آخر بيانات محفوظة إن وجدت', 'info');
    }
    this.renderShell();
    Sync.subscribeRealtime();
    Sync.startExpiryWatcher();
    await Sync.flushQueue();

    document.addEventListener('data:statuses-changed', () => this.rerenderCurrentView());
    document.addEventListener('data:departments-changed', () => this.rerenderCurrentView());
    document.addEventListener('data:messages-changed', () => {
      this.updateMessagesBadge();
      if (STATE.session?.department_kind === 'callcenter') CallCenterView.renderMessagesStrip();
    });
    document.addEventListener('data:activity-changed', () => this.rerenderCurrentView());
    document.addEventListener('data:reloaded', () => this.rerenderCurrentView());
    document.addEventListener('connection:changed', () => this.updateConnectionBadge());
  },

  renderShell() {
    const app = document.getElementById('app');
    app.innerHTML = '';

    const header = Utils.el('header', { class: 'app-header' });
    header.appendChild(Utils.el('div', { class: 'app-header__brand' }, [
      Utils.el('img', { src: 'assets/logo.png', class: 'app-header__logo', alt: 'شعار الحلواني' }),
      Utils.el('span', { class: 'app-header__title' }, window.APP_CONFIG?.APP_NAME || 'الحلواني')
    ]));

    const meta = Utils.el('div', { class: 'app-header__meta' });
    meta.appendChild(Utils.el('span', { id: 'header-clock', style: 'font-weight:700;color:var(--text-muted);font-size:0.9rem;' }, Utils.formatClock()));
    meta.appendChild(Utils.el('span', { id: 'conn-badge', class: 'conn-badge online' }, [
      Utils.el('span', {}, '● '), Utils.el('span', { id: 'conn-badge-text' }, 'متصل')
    ]));

    const actions = Utils.el('div', { class: 'app-header__actions' });

    const showMessages = ['department', 'callcenter'].includes(STATE.session.department_kind);
    if (showMessages) {
      actions.appendChild(Utils.el('button', {
        class: 'icon-btn', id: 'messages-btn', title: 'الرسائل', html: '<i data-lucide="message-circle" width="18"></i>',
        onclick: () => Messages.openPanel()
      }));
    }

    actions.appendChild(Utils.el('button', {
      class: 'icon-btn', id: 'sound-toggle-btn', title: 'كتم/تشغيل الصوت',
      html: `<i data-lucide="${STATE.soundEnabled ? 'volume-2' : 'volume-x'}" width="18"></i>`,
      onclick: (e) => { const on = Sounds.toggle(); e.currentTarget.innerHTML = `<i data-lucide="${on ? 'volume-2' : 'volume-x'}" width="18"></i>`; Utils.refreshIcons(); }
    }));

    actions.appendChild(Utils.el('button', {
      class: 'icon-btn', title: 'تبديل المظهر', id: 'theme-toggle-btn',
      html: `<i data-lucide="${STATE.theme === 'dark' ? 'sun' : 'moon'}" width="18"></i>`,
      onclick: () => this.toggleTheme()
    }));

    actions.appendChild(Utils.el('button', {
      class: 'icon-btn', title: 'تسجيل الخروج', html: '<i data-lucide="log-out" width="18"></i>',
      onclick: () => this.confirmLogout()
    }));

    meta.appendChild(actions);
    header.appendChild(meta);
    app.appendChild(header);

    app.appendChild(Utils.el('div', { id: 'offline-banner-host' }));

    const main = Utils.el('main', { class: 'app-main', id: 'app-main' });
    app.appendChild(main);

    setInterval(() => { const c = document.getElementById('header-clock'); if (c) c.textContent = Utils.formatClock(); }, 1000 * 30);

    this.updateConnectionBadge();
    this.rerenderCurrentView();
    Utils.refreshIcons();
  },

  rerenderCurrentView() {
    const kind = STATE.session?.department_kind;
    if (kind === 'department') DepartmentView.render();
    else if (kind === 'callcenter') CallCenterView.render();
    else if (kind === 'admin') AdminView.render();
    else if (kind === 'developer') DeveloperView.render();
  },

  updateConnectionBadge() {
    const badge = document.getElementById('conn-badge');
    const text = document.getElementById('conn-badge-text');
    const bannerHost = document.getElementById('offline-banner-host');
    if (!badge || !text) return;
    badge.classList.remove('online', 'reconnecting', 'offline');
    if (STATE.connection === 'online') { badge.classList.add('online'); text.textContent = 'متصل'; }
    else if (STATE.connection === 'reconnecting') { badge.classList.add('reconnecting'); text.textContent = 'جارٍ إعادة الاتصال...'; }
    else { badge.classList.add('offline'); text.textContent = 'غير متصل'; }

    if (bannerHost) {
      bannerHost.innerHTML = '';
      if (STATE.connection === 'offline') {
        bannerHost.appendChild(Utils.el('div', { class: 'offline-banner' }, 'أنت غير متصل، البيانات المعروضة قد لا تكون الأحدث'));
      }
    }
  },

  updateMessagesBadge() {
    // مؤشر بصري بسيط: نقطة حمراء تظهر عند وصول رسالة جديدة لهذه الجهة خلال آخر دقيقتين
    const btn = document.getElementById('messages-btn');
    if (!btn || !STATE.session) return;
    const myId = STATE.session.department_id;
    const recentIncoming = STATE.messages.some(m =>
      m.from_department_id !== myId &&
      (m.to_department_id === myId || m.to_department_id === null) &&
      (Date.now() - new Date(m.created_at).getTime()) < 120000
    );
    btn.querySelector('.badge-dot')?.remove();
    if (recentIncoming) btn.appendChild(Utils.el('span', { class: 'badge-dot' }));
  },

  applyTheme() {
    document.documentElement.setAttribute('data-theme', STATE.theme);
  },

  toggleTheme() {
    STATE.theme = STATE.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', STATE.theme);
    this.applyTheme();
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.innerHTML = `<i data-lucide="${STATE.theme === 'dark' ? 'sun' : 'moon'}" width="18"></i>`;
    Utils.refreshIcons();
  },

  confirmLogout() {
    Modal.open({
      title: 'تسجيل الخروج',
      bodyNode: Utils.el('p', {}, 'هل تريد تسجيل الخروج من هذه الجهة؟'),
      actions: [
        { label: 'إلغاء', className: 'btn-secondary', onClick: () => Modal.close() },
        { label: 'تسجيل الخروج', className: 'btn-danger', onClick: () => { Modal.close(); Auth.logout(); } }
      ]
    });
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
