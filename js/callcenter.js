// ============================================================================
// شاشة الكول سنتر — أهم واجهة في النظام
// الترتيب: شريط الرسائل ← الأكثر شيوعًا ← البحث والفلاتر ← قوائم الأصناف
// كل التغييرات هنا عرضية فقط؛ التزامن اللحظي والبيانات كما هي
// ============================================================================

const CallCenterView = {
  countdownTimer: null,

  render() {
    const main = document.getElementById('app-main');
    if (!main) return;
    main.innerHTML = '';

    // 1) شريط الرسائل والتنبيهات العلوي
    main.appendChild(Utils.el('div', { id: 'cc-messages-strip' }));

    // 2) تنبيهات أقسام الضغط العالي
    main.appendChild(Utils.el('div', { id: 'cc-pressure-alerts' }));

    // 3) الأكثر شيوعًا
    main.appendChild(Utils.el('div', { id: 'cc-popular' }));

    // 4) البحث
    main.appendChild(Utils.el('div', { class: 'view-header' }, [
      Utils.el('h2', { class: 'view-title' }, 'أصناف الأقسام'),
      Utils.el('div', { class: 'search-box' }, [
        Utils.el('input', {
          type: 'text', placeholder: 'ابحث باسم الصنف أو كوده...',
          value: STATE.searchTerm || '', 'aria-label': 'بحث عن صنف',
          oninput: Utils.debounce((e) => {
            STATE.searchTerm = e.target.value.trim();
            this.renderBody();
            this.renderPopular();
          }, 180)
        }),
        Utils.el('span', { class: 'search-icon', html: '<i data-lucide="search" width="17"></i>' })
      ])
    ]));

    // 5) فلاتر الأقسام (أزرار صغيرة تلتف في صفوف، بلا سحب أفقي)
    main.appendChild(Utils.el('div', { class: 'dept-filters', id: 'cc-filters' }));

    // 6) قائمة الأصناف
    main.appendChild(Utils.el('div', { id: 'cc-body' }));

    this.renderMessagesStrip();
    this.renderPressureAlerts();
    this.renderPopular();
    this.renderFilters();
    this.renderBody();
    this.startCountdownTicker();
    Utils.refreshIcons();
  },

  // ==========================================================================
  // شريط الرسائل العلوي مع رد سريع
  // ==========================================================================
  renderMessagesStrip() {
    const host = document.getElementById('cc-messages-strip');
    if (!host) return;
    host.innerHTML = '';

    const myId = STATE.session.department_id;
    const incoming = STATE.messages
      .filter(m => !m.is_archived && m.from_department_id !== myId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 6);

    const strip = Utils.el('div', { class: 'msg-strip' });
    strip.appendChild(Utils.el('div', { class: 'msg-strip__head' }, [
      Utils.el('span', { class: 'head-right' }, [
        Utils.el('span', { html: '<i data-lucide="bell" width="15"></i>' }),
        Utils.el('span', {}, 'رسائل الأقسام'),
        Utils.el('span', { class: 'count-pill' }, String(incoming.length))
      ]),
      Utils.el('button', {
        class: 'btn btn-secondary btn-xs',
        html: '<i data-lucide="message-square-plus" width="14"></i> مراسلة قسم',
        onclick: () => Messages.openPanel()
      })
    ]));

    const list = Utils.el('div', { class: 'msg-strip__list' });
    if (!incoming.length) {
      list.appendChild(Utils.el('div', { style: 'padding:14px 16px;color:var(--text-muted);font-size:.85rem;' },
        'لا توجد رسائل واردة من الأقسام حاليًا.'));
    } else {
      incoming.forEach(m => {
        const dep = STATE.departments.find(d => d.id === m.from_department_id);
        list.appendChild(Utils.el('button', {
          class: 'msg-strip__item',
          title: 'فتح المحادثة والرد',
          onclick: () => Messages.openPanel(m.from_department_id)   // رد سريع على القسم المرسل
        }, [
          Utils.el('span', { class: 'msg-strip__dept' }, dep ? dep.name : 'قسم'),
          Utils.el('span', { class: 'msg-strip__body' }, m.body),
          Utils.el('span', { class: 'msg-strip__time' }, Utils.formatClock(new Date(m.created_at)))
        ]));
      });
    }
    strip.appendChild(list);
    host.appendChild(strip);
    Utils.refreshIcons();
  },

  renderPressureAlerts() {
    const host = document.getElementById('cc-pressure-alerts');
    if (!host) return;
    host.innerHTML = '';
    STATE.departments
      .filter(d => d.kind === 'department' && d.is_active && d.work_mode === 'high_pressure')
      .forEach(dep => {
        host.appendChild(Utils.el('div', { class: 'alert-box pressure' }, [
          Utils.el('span', { html: '<i data-lucide="alert-triangle" width="16"></i>' }),
          Utils.el('span', {}, `قسم ${dep.name} في وضع ضغط عالٍ — يُرجى مراعاة ذلك عند وعد العميل بوقت التجهيز.`)
        ]));
      });
    Utils.refreshIcons();
  },

  // ==========================================================================
  // الأكثر شيوعًا — صفوف أفقية أنيقة في أعلى الشاشة
  // ==========================================================================
  renderPopular() {
    const host = document.getElementById('cc-popular');
    if (!host) return;
    host.innerHTML = '';

    // يظهر فقط عند عرض "الكل" وبدون بحث نشط
    if (STATE.searchTerm || STATE.callcenterDepartmentFilter !== 'all') return;
    if (!STATE.popular.length) return;

    const products = STATE.popular
      .map(pp => STATE.products.find(p => p.id === pp.product_id))
      .filter(p => p && p.is_active);
    if (!products.length) return;

    const block = Utils.el('div', { class: 'popular-block' });
    block.appendChild(Utils.el('div', { class: 'section-title' }, [
      Utils.el('span', { html: '<i data-lucide="star" width="17"></i>' }),
      Utils.el('span', {}, 'الأكثر شيوعًا'),
      Utils.el('span', { class: 'count-pill' }, String(products.length))
    ]));

    const rows = Utils.el('div', { class: 'item-rows' });
    products.forEach(p => rows.appendChild(this.renderItemRow(p)));
    block.appendChild(rows);
    host.appendChild(block);
    Utils.refreshIcons();
  },

  // ==========================================================================
  // فلاتر الأقسام
  // ==========================================================================
  countProductsOf(departmentId) {
    if (departmentId === 'all') return STATE.products.filter(p => p.is_active).length;
    const ids = STATE.productDepartments.filter(pd => pd.department_id === departmentId).map(pd => pd.product_id);
    return STATE.products.filter(p => p.is_active && ids.includes(p.id)).length;
  },

  renderFilters() {
    const host = document.getElementById('cc-filters');
    if (!host) return;
    host.innerHTML = '';

    host.appendChild(Utils.el('button', {
      class: 'dept-filter' + (STATE.callcenterDepartmentFilter === 'all' ? ' active' : ''),
      onclick: () => this.setFilter('all')
    }, [
      Utils.el('span', {}, 'الكل'),
      Utils.el('span', { class: 'filter-count' }, String(this.countProductsOf('all')))
    ]));

    STATE.departments
      .filter(d => d.kind === 'department' && d.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .forEach(dep => {
        const isPressure = dep.work_mode === 'high_pressure';
        host.appendChild(Utils.el('button', {
          class: 'dept-filter' + (STATE.callcenterDepartmentFilter === dep.id ? ' active' : ''),
          title: isPressure ? `${dep.name} — ضغط عالٍ` : `${dep.name} — عادي`,
          onclick: () => this.setFilter(dep.id)
        }, [
          isPressure ? Utils.el('span', { class: 'pressure-dot' }) : null,
          Utils.el('span', {}, dep.name),
          Utils.el('span', { class: 'filter-count' }, String(this.countProductsOf(dep.id)))
        ]));
      });
  },

  setFilter(value) {
    STATE.callcenterDepartmentFilter = value;
    this.renderFilters();
    this.renderPopular();
    this.renderBody();
  },

  // ==========================================================================
  // قوائم أصناف الأقسام
  // ==========================================================================
  renderBody() {
    const host = document.getElementById('cc-body');
    if (!host) return;
    host.innerHTML = '';

    let products = STATE.products.filter(p => p.is_active);
    if (STATE.callcenterDepartmentFilter !== 'all') {
      const ids = STATE.productDepartments
        .filter(pd => pd.department_id === STATE.callcenterDepartmentFilter)
        .map(pd => pd.product_id);
      products = products.filter(p => ids.includes(p.id));
    }
    if (STATE.searchTerm) {
      const q = STATE.searchTerm.toLowerCase();
      products = products.filter(p => p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q));
    }
    products = products.sort((a, b) => a.name.localeCompare(b.name, 'ar'));

    if (!products.length) {
      host.appendChild(Utils.el('div', { class: 'empty-state' }, [
        Utils.el('div', { html: '<i data-lucide="search-x" width="38"></i>' }),
        Utils.el('p', {}, 'لا توجد نتائج مطابقة')
      ]));
      Utils.refreshIcons();
      return;
    }

    const rows = Utils.el('div', { class: 'item-rows' });
    products.forEach(p => rows.appendChild(this.renderItemRow(p)));
    host.appendChild(rows);
    Utils.refreshIcons();
  },

  /** كل حالات الصنف عبر الأقسام المرتبطة به */
  getStatusesForProduct(productId) {
    const depIds = STATE.productDepartments.filter(pd => pd.product_id === productId).map(pd => pd.department_id);
    return STATE.statuses.filter(s => s.product_id === productId && depIds.includes(s.department_id));
  },

  /** الحالة التمثيلية للعرض السريع: الأحدث تحديثًا */
  getPrimaryStatus(productId) {
    const statuses = this.getStatusesForProduct(productId);
    return statuses.slice().sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0] || null;
  },

  /** صف صنف أفقي: الاسم، القسم، الحالة، الكمية/العداد/البدائل، زر التفاصيل */
  renderItemRow(product) {
    const primary = this.getPrimaryStatus(product.id) || { status: 'available' };
    const dep = STATE.departments.find(d => d.id === primary.department_id);

    const sub = Utils.el('div', { class: 'item-row__sub' });
    if (dep) sub.appendChild(Utils.el('span', {}, dep.name));

    if (primary.status === 'available' && primary.quantity_level) {
      sub.appendChild(Utils.el('span', {}, `• ${Utils.quantityLabel(primary.quantity_level)}`));
    } else if (primary.status === 'coming_soon' && primary.available_at) {
      sub.appendChild(Utils.el('span', { class: 'countdown', 'data-target': primary.available_at }, [
        Utils.el('span', { html: '<i data-lucide="clock" width="12"></i>' }),
        Utils.el('span', { class: 'countdown-value' }, Utils.formatCountdown(primary.available_at))
      ]));
    } else if (primary.status === 'out_of_stock') {
      const altNames = STATE.alternatives
        .filter(a => a.product_status_id === primary.id)
        .map(a => STATE.products.find(p => p.id === a.alternative_product_id)?.name)
        .filter(Boolean);
      if (altNames.length) {
        const short = altNames.slice(0, 2).join('، ') + (altNames.length > 2 ? ` +${altNames.length - 2}` : '');
        sub.appendChild(Utils.el('span', {}, `• البدائل: ${short}`));
      }
    }

    return Utils.el('button', {
      class: `item-row status-${primary.status}`,
      onclick: () => this.openDetail(product)
    }, [
      Utils.el('div', { class: 'item-row__main' }, [
        Utils.el('div', { class: 'item-row__name' }, product.name),
        sub
      ]),
      Utils.el('div', { class: 'item-row__right' }, [
        Utils.el('span', {
          class: `status-badge ${primary.status}`,
          html: `<i data-lucide="${Utils.statusIcon(primary.status)}"></i> ${Utils.statusLabel(primary.status)}`
        }),
        Utils.el('span', { class: 'item-row__chevron', html: '<i data-lucide="chevron-left" width="17"></i>' })
      ])
    ]);
  },

  // ==========================================================================
  // نافذة تفاصيل الصنف
  // ==========================================================================
  openDetail(product) {
    const statuses = this.getStatusesForProduct(product.id);
    const body = Utils.el('div');

    body.appendChild(Utils.el('p', { class: 'form-hint', style: 'margin-top:0;line-height:1.8;' },
      product.description || 'لا يوجد وصف لهذا الصنف'));

    if (!statuses.length) {
      body.appendChild(Utils.el('div', { class: 'empty-state' }, 'لا توجد بيانات حالة لهذا الصنف بعد'));
    }

    statuses.forEach(s => {
      const dep = STATE.departments.find(d => d.id === s.department_id);
      const box = Utils.el('div', {
        style: 'border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px;background:var(--surface-2);'
      });

      box.appendChild(Utils.el('div', {
        style: 'display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;'
      }, [
        Utils.el('strong', {}, dep ? dep.name : 'قسم غير معروف'),
        Utils.el('span', {
          class: `status-badge ${s.status}`,
          html: `<i data-lucide="${Utils.statusIcon(s.status)}"></i> ${Utils.statusLabel(s.status)}`
        })
      ]));

      const detail = (label, value) => Utils.el('div', { style: 'font-size:.88rem;margin-bottom:4px;' }, [
        Utils.el('span', { style: 'color:var(--text-muted);' }, `${label}: `),
        Utils.el('span', { style: 'font-weight:700;' }, value)
      ]);

      if (s.status === 'available') {
        box.appendChild(detail('الكمية التقريبية', Utils.quantityLabel(s.quantity_level)));
      }

      if (s.status === 'coming_soon' && s.available_at) {
        box.appendChild(detail('الوقت المتبقي', Utils.humanRemaining(s.available_at)));
        box.appendChild(Utils.el('div', { class: 'countdown', 'data-target': s.available_at, style: 'margin-bottom:4px;' }, [
          Utils.el('span', { html: '<i data-lucide="clock" width="13"></i>' }),
          Utils.el('span', { class: 'countdown-value' }, Utils.formatCountdown(s.available_at))
        ]));
      }

      if (s.status === 'out_of_stock') {
        const altNames = STATE.alternatives
          .filter(a => a.product_status_id === s.id)
          .map(a => STATE.products.find(p => p.id === a.alternative_product_id)?.name)
          .filter(Boolean);
        box.appendChild(detail('البدائل المقترحة', altNames.length ? altNames.join('، ') : 'لا توجد بدائل مقترحة'));
        if (s.note) box.appendChild(detail('ملاحظة القسم', s.note));
      }

      const updater = STATE.departments.find(d => d.id === s.updated_by_department_id);
      box.appendChild(detail('آخر تحديث', `${Utils.formatDateTime(s.updated_at)}${updater ? ` — ${updater.name}` : ''}`));

      body.appendChild(box);
    });

    Modal.open({
      title: product.name,
      bodyNode: body,
      actions: [{ label: 'إغلاق', className: 'btn-primary', onClick: () => Modal.close() }]
    });
    Utils.refreshIcons();
  },

  startCountdownTicker() {
    clearInterval(this.countdownTimer);
    this.countdownTimer = setInterval(() => {
      document.querySelectorAll('[data-target]').forEach(node => {
        const valueEl = node.querySelector('.countdown-value');
        if (valueEl) valueEl.textContent = Utils.formatCountdown(node.getAttribute('data-target'));
      });
    }, 1000);
  }
};
