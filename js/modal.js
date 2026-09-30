// ============================================================================
// مكوّن نافذة منبثقة عام يُستخدم في كل الصفحات
// ============================================================================

const Modal = {
  overlay: null,

  /**
   * فتح نافذة منبثقة.
   * dismissible = false تمنع الإغلاق بالنقر على الخلفية أو بزر X أو بمفتاح Esc،
   * وتُستخدم عندما يجب على المستخدم اختيار أحد الأزرار صراحة (مثل رسالة الترحيب).
   */
  open({ title, bodyNode, actions = [], large = false, dismissible = true }) {
    this.close();

    const overlay = Utils.el('div', {
      class: 'modal-overlay',
      onclick: (e) => { if (dismissible && e.target === overlay) this.close(); }
    });
    const box = Utils.el('div', { class: 'modal-box' + (large ? ' modal-lg' : '') });

    const header = Utils.el('div', { class: 'modal-header' }, [
      Utils.el('h3', { class: 'modal-title' }, title),
      dismissible
        ? Utils.el('button', {
            class: 'icon-btn', title: 'إغلاق', 'aria-label': 'إغلاق',
            html: '<i data-lucide="x" width="18"></i>', onclick: () => this.close()
          })
        : null
    ]);
    box.appendChild(header);
    box.appendChild(bodyNode);

    if (actions.length) {
      const actionsWrap = Utils.el('div', { class: 'modal-actions' });
      actions.forEach(a => {
        actionsWrap.appendChild(Utils.el('button', { class: `btn ${a.className || 'btn-secondary'}`, onclick: a.onClick }, a.label));
      });
      box.appendChild(actionsWrap);
    }

    overlay.appendChild(box);
    document.body.appendChild(overlay);
    this.overlay = overlay;

    // إغلاق بمفتاح Esc للنوافذ القابلة للإغلاق فقط
    this._onKey = (e) => { if (e.key === 'Escape' && dismissible) this.close(); };
    document.addEventListener('keydown', this._onKey);

    Utils.refreshIcons();
  },

  close() {
    if (this._onKey) { document.removeEventListener('keydown', this._onKey); this._onKey = null; }
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
  }
};
