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

    // رسالة الترحيب بعد الدخول الناجح عند فتح التطبيق
    Welcome.maybeShow();
  },

  /**
   * تعريف أزرار الترويسة في مكان واحد.
   * تُستخدم نفس القائمة لبناء أزرار سطح المكتب وقائمة "المزيد" على الموبايل،
   * حتى لا تختفي أي وظيفة على الشاشات الصغيرة.
   */
  headerActions() {
    const list = [];

    if (STATE.session.department_kind === 'callcenter') {
      list.push({
        id: 'messages-btn', icon: 'message-circle', label: 'مراسلة قسم',
        onClick: () => Messages.openPanel()
      });
    }

    list.push({
      id: 'help-btn', icon: 'help-circle', label: 'دليل الاستخدام',
      onClick: () => HelpGuide.open()
    });

    list.push({
      id: 'sound-toggle-btn',
      icon: () => (STATE.soundEnabled ? 'volume-2' : 'volume-x'),
      label: () => (STATE.soundEnabled ? 'كتم الصوت' : 'تشغيل الصوت'),
      onClick: () => {
        const on = Sounds.toggle();
        Utils.toast(on ? 'تم تشغيل الأصوات.' : 'تم كتم الأصوات.', 'info');
        this.refreshHeaderActions();
      }
    });

    list.push({
      id: 'theme-toggle-btn',
      icon: () => (STATE.theme === 'dark' ? 'sun' : 'moon'),
      label: () => (STATE.theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'),
      onClick: () => this.toggleTheme()
    });

    list.push({
      id: 'logout-btn', icon: 'log-out', label: 'تسجيل الخروج', danger: true,
      onClick: () => this.confirmLogout()
    });

    return list;
  },

  _val(v) { return typeof v === 'function' ? v() : v; },

  /** إعادة بناء أزرار الترويسة بعد تغيّر حالة (مثل الصوت أو المظهر) */
  refreshHeaderActions() {
    const host = document.getElementById('header-actions');
    if (!host) return;
    host.innerHTML = '';
    this.buildHeaderActions(host);
    Utils.refreshIcons();
  },

  buildHeaderActions(host) {
    const actions = this.headerActions();

    // --- أزرار كاملة: تظهر على اللابتوب والشاشات الكبيرة ---
    actions.forEach(a => {
      const label = this._val(a.label);
      host.appendChild(Utils.el('button', {
        class: 'icon-btn header-action' + (a.danger ? ' danger' : ''),
        id: a.id, title: label, 'aria-label': label,
        html: `<i data-lucide="${this._val(a.icon)}" width="17"></i>`,
        onclick: a.onClick
      }));
    });

    // --- زر "المزيد": يظهر على الموبايل فقط ويحتوي نفس الوظائف بلا استثناء ---
    host.appendChild(Utils.el('button', {
      class: 'icon-btn', id: 'more-btn', title: 'المزيد', 'aria-label': 'المزيد من الخيارات',
      'aria-expanded': 'false',
      html: '<i data-lucide="more-vertical" width="17"></i>',
      onclick: (e) => { e.stopPropagation(); this.toggleMoreMenu(); }
    }));

    const menu = Utils.el('div', { class: 'header-menu', id: 'header-menu', role: 'menu' });
    actions.forEach(a => {
      const label = this._val(a.label);
      menu.appendChild(Utils.el('button', {
        class: 'header-menu__item' + (a.danger ? ' danger' : ''),
        role: 'menuitem',
        onclick: () => { this.closeMoreMenu(); a.onClick(); }
      }, [
        Utils.el('span', { class: 'header-menu__icon', html: `<i data-lucide="${this._val(a.icon)}" width="16"></i>` }),
        Utils.el('span', {}, label)
      ]));
    });
    host.appendChild(menu);
  },

  toggleMoreMenu() {
    const menu = document.getElementById('header-menu');
    const btn = document.getElementById('more-btn');
    if (!menu) return;
    const willOpen = !menu.classList.contains('open');
    menu.classList.toggle('open', willOpen);
    if (btn) btn.setAttribute('aria-expanded', String(willOpen));

    if (willOpen) {
      // إغلاق القائمة عند النقر في أي مكان آخر
      this._menuCloser = (e) => { if (!menu.contains(e.target)) this.closeMoreMenu(); };
      setTimeout(() => document.addEventListener('click', this._menuCloser), 0);
    }
  },

  closeMoreMenu() {
    const menu = document.getElementById('header-menu');
    const btn = document.getElementById('more-btn');
    if (menu) menu.classList.remove('open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (this._menuCloser) { document.removeEventListener('click', this._menuCloser); this._menuCloser = null; }
  },

  renderShell() {
    const app = document.getElementById('app');
    app.innerHTML = '';

    const header = Utils.el('header', { class: 'app-header' });

    // --- الشعار + اسم الحلواني: يبقيان واضحين على كل المقاسات ---
    header.appendChild(Utils.el('div', { class: 'app-header__brand' }, [
      Utils.el('img', { src: 'assets/logo.png', class: 'app-header__logo', alt: 'شعار الحلواني' }),
      Utils.el('div', { class: 'app-header__titles' }, [
        Utils.el('span', { class: 'app-header__title' }, [
          Utils.el('span', { class: 'brand-ar' }, 'الحلواني'),
          Utils.el('span', { class: 'brand-en' }, ' | Halawany 1933')
        ]),
        Utils.el('span', { class: 'app-header__subtitle' }, 'نظام إدارة المنتجات اللحظي')
      ])
    ]));

    // --- الساعة + حالة الاتصال + الأزرار ---
    const meta = Utils.el('div', { class: 'app-header__meta' });
    meta.appendChild(Utils.el('span', { id: 'header-clock' }, Utils.formatClock()));
    meta.appendChild(Utils.el('span', { id: 'conn-badge', class: 'conn-badge online', title: 'حالة الاتصال' }, [
      Utils.el('span', { class: 'conn-dot' }),
      Utils.el('span', { class: 'conn-text', id: 'conn-badge-text' }, 'متصل')
    ]));

    const actionsHost = Utils.el('div', { class: 'app-header__actions', id: 'header-actions' });
    this.buildHeaderActions(actionsHost);
    meta.appendChild(actionsHost);

    header.appendChild(meta);
    app.appendChild(header);

    app.appendChild(Utils.el('div', { id: 'offline-banner-host' }));

    const main = Utils.el('main', { class: 'app-main', id: 'app-main' });
    app.appendChild(main);

    // مؤقت الساعة (يُلغى عند الخروج في teardown)
    clearInterval(this._clockTimer);
    this._clockTimer = setInterval(() => {
      const c = document.getElementById('header-clock');
      if (c) c.textContent = Utils.formatClock();
    }, 20000);

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
    if (STATE.connection === 'online') { badge.classList.add('online'); text.textContent = 'متصل'; badge.title = 'متصل'; }
    else if (STATE.connection === 'reconnecting') { badge.classList.add('reconnecting'); text.textContent = 'إعادة الاتصال'; badge.title = 'جارٍ إعادة الاتصال'; }
    else { badge.classList.add('offline'); text.textContent = 'غير متصل'; badge.title = 'غير متصل'; }

    if (bannerHost) {
      bannerHost.innerHTML = '';
      if (STATE.connection === 'offline') {
        bannerHost.appendChild(Utils.el('div', { class: 'offline-banner' }, 'أنت غير متصل، البيانات المعروضة قد لا تكون الأحدث'));
      }
    }
    // تحديث شارة الاتصال داخل رأس صفحة القسم أيضًا
    if (STATE.session?.department_kind === 'department' && typeof DepartmentView?.updateConnectionChip === 'function') {
      DepartmentView.updateConnectionChip();
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
    this.refreshHeaderActions();
  },

  /** تنظيف المؤقتات والاشتراكات قبل الخروج حتى لا تبقى تعمل في الخلفية */
  teardown() {
    clearInterval(this._clockTimer);
    this.closeMoreMenu();
    if (typeof DepartmentView !== 'undefined') clearInterval(DepartmentView.countdownTimer);
    if (typeof CallCenterView !== 'undefined') clearInterval(CallCenterView.countdownTimer);
    document.querySelectorAll('.tooltip-popover').forEach(n => n.remove());
  },

  confirmLogout() {
    Modal.open({
      title: 'تسجيل الخروج',
      bodyNode: Utils.el('p', { style: 'line-height:1.8;margin:0;' }, 'هل تريد إنهاء الجلسة الحالية والعودة إلى شاشة اختيار القسم؟'),
      actions: [
        { label: 'إلغاء', className: 'btn-secondary', onClick: () => Modal.close() },
        {
          label: 'تسجيل الخروج', className: 'btn-danger-solid', onClick: () => {
            Modal.close();
            Auth.logout();   // ينهي الجلسة ويعرض شاشة اختيار القسم فورًا
            Utils.toast('تم تسجيل الخروج بنجاح.', 'info');
          }
        }
      ]
    });
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
