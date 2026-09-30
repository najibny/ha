// ============================================================================
// صفحة الكول سنتر — أهم واجهة، مصممة للاستخدام السريع تحت الضغط
// ============================================================================

const CallCenterView = {
  renderMessagesStrip() {
    const host = document.getElementById('cc-messages-strip');
    if (!host) return;
    host.innerHTML = '';
    const myId = STATE.session.department_id;
    const incoming = STATE.messages
      .filter(m => !m.is_archived && m.from_department_id !== myId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8);
    if (!incoming.length) return;

    const strip = Utils.el('div', { class: 'messages-strip', onclick: () => Messages.openPanel() });
    incoming.forEach(m => {
      const dep = STATE.departments.find(d => d.id === m.from_department_id);
      strip.appendChild(Utils.el('span', { class: 'messages-strip__item' }, `${dep ? dep.name : ''}: ${m.body.slice(0, 40)}`));
    });
    host.appendChild(strip);
  },

  render() {
    const main = document.getElementById('app-main');
    main.innerHTML = '';

    const header = Utils.el('div', { class: 'view-header' });
    header.appendChild(Utils.el('h2', { class: 'view-title' }, 'شاشة الكول سنتر'));
    const searchBox = Utils.el('div', { class: 'search-box' }, [
      Utils.el('span', { html: '<i data-lucide="search" width="18"></i>' }),
      Utils.el('input', {
        type: 'text', placeholder: 'ابحث باسم الصنف أو كوده...',
        oninput: Utils.debounce((e) => { STATE.searchTerm = e.target.value.trim(); this.renderBody(); }, 180)
      })
    ]);
    header.appendChild(searchBox);
    main.appendChild(header);

    // شريط آخر الرسائل الواردة من الأقسام
    main.appendChild(Utils.el('div', { id: 'cc-messages-strip' }));
    this.renderMessagesStrip();

    // تبويبات الأقسام
    const tabs = Utils.el('div', { class: 'tabs', id: 'cc-tabs' });
    main.appendChild(tabs);

    const bodyHost = Utils.el('div', { id: 'cc-body' });
    main.appendChild(bodyHost);

    this.renderTabs();
    this.renderBody();
  },

  renderTabs() {
    const tabs = document.getElementById('cc-tabs');
    if (!tabs) return;
    tabs.innerHTML = '';

    const allBtn = Utils.el('button', {
      class: 'tab-btn' + (STATE.callcenterDepartmentFilter === 'all' ? ' active' : ''),
      onclick: () => { STATE.callcenterDepartmentFilter = 'all'; this.renderTabs(); this.renderBody(); }
    }, 'الكل');
    tabs.appendChild(allBtn);

    STATE.departments.filter(d => d.kind === 'department' && d.is_active).forEach(dep => {
      const isPressure = dep.work_mode === 'high_pressure';
      tabs.appendChild(Utils.el('button', {
        class: 'tab-btn' + (STATE.callcenterDepartmentFilter === dep.id ? ' active' : ''),
        onclick: () => { STATE.callcenterDepartmentFilter = dep.id; this.renderTabs(); this.renderBody(); }
      }, [
        dep.name + ' ',
        isPressure ? Utils.el('span', { class: 'pressure-dot', title: 'ضغط عالٍ' }) : null
      ]));
    });
  },

  renderBody() {
    const host = document.getElementById('cc-body');
    if (!host) return;
    host.innerHTML = '';

    // --- قسم الأكثر شيوعًا (فقط عند عدم البحث وعرض "الكل") ---
    if (!STATE.searchTerm && STATE.callcenterDepartmentFilter === 'all' && STATE.popular.length) {
      host.appendChild(Utils.el('h3', { style: 'margin:8px 0;' }, 'الأكثر شيوعًا'));
      const popularGrid = Utils.el('div', { class: 'products-grid' });
      STATE.popular.forEach(pp => {
        const product = STATE.products.find(p => p.id === pp.product_id);
        if (product && product.is_active) popularGrid.appendChild(this.renderProductRow(product));
      });
      host.appendChild(popularGrid);
      host.appendChild(Utils.el('div', { style: 'height:20px;' }));
    }

    // --- الحالة التحذيرية لأقسام الضغط العالي ---
    const pressureDeps = STATE.departments.filter(d => d.kind === 'department' && d.work_mode === 'high_pressure' && d.is_active);
    if (pressureDeps.length && STATE.callcenterDepartmentFilter === 'all') {
      pressureDeps.forEach(dep => {
        host.appendChild(Utils.el('div', {
          style: 'background:var(--status-pressure-bg);color:var(--status-pressure);padding:10px 16px;border-radius:12px;margin-bottom:10px;font-weight:700;font-size:0.88rem;'
        }, `⚠ قسم ${dep.name} في وضع ضغط عالٍ حاليًا، يُرجى مراعاة ذلك عند الرد على العملاء`));
      });
    }

    // --- قائمة الأصناف المفلترة ---
    let products = STATE.products.filter(p => p.is_active);
    if (STATE.callcenterDepartmentFilter !== 'all') {
      const productIds = STATE.productDepartments.filter(pd => pd.department_id === STATE.callcenterDepartmentFilter).map(pd => pd.product_id);
      products = products.filter(p => productIds.includes(p.id));
    }
    if (STATE.searchTerm) {
      const q = STATE.searchTerm.toLowerCase();
      products = products.filter(p => p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q));
    }
    products = products.sort((a, b) => a.name.localeCompare(b.name, 'ar'));

    if (!products.length) {
      host.appendChild(Utils.el('div', { class: 'empty-state' }, [
        Utils.el('div', { html: '<i data-lucide="search-x" width="40"></i>' }),
        Utils.el('p', {}, 'لا توجد نتائج مطابقة')
      ]));
      Utils.refreshIcons();
      return;
    }

    const grid = Utils.el('div', { class: 'products-grid' });
    products.forEach(p => grid.appendChild(this.renderProductRow(p)));
    host.appendChild(grid);
    Utils.refreshIcons();
  },

  /** يرجع أفضل حالة تمثيلية للصنف عبر الأقسام المرتبطة به (لأغراض العرض في الكول سنتر) */
  getStatusesForProduct(productId) {
    const depIds = STATE.productDepartments.filter(pd => pd.product_id === productId).map(pd => pd.department_id);
    return STATE.statuses.filter(s => s.product_id === productId && depIds.includes(s.department_id));
  },

  renderProductRow(product) {
    const statuses = this.getStatusesForProduct(product.id);
    // إن كان مرتبطًا بأكثر من قسم، نعرض الحالة الأحدث تحديثًا كملخص
    const primary = statuses.slice().sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0] || { status: 'available' };
    const dep = STATE.departments.find(d => d.id === primary.department_id);

    const card = Utils.el('div', { class: 'product-card', style: 'cursor:pointer;', onclick: () => this.openDetail(product) });
    const top = Utils.el('div', { class: 'product-card__top' });
    top.appendChild(Utils.el('div', { class: 'product-card__name' }, product.name));
    top.appendChild(Utils.el('span', { class: `status-badge ${primary.status}`, html: `<i data-lucide="${Utils.statusIcon(primary.status)}" width="14"></i> ${Utils.statusLabel(primary.status)}` }));
    card.appendChild(top);

    if (dep) card.appendChild(Utils.el('div', { class: 'product-card__meta' }, `القسم: ${dep.name}`));
    if (primary.status === 'coming_soon' && primary.available_at) {
      card.appendChild(Utils.el('div', { class: 'countdown', 'data-target': primary.available_at }, `متوفر خلال ${Utils.formatCountdown(primary.available_at)}`));
    }
    return card;
  },

  openDetail(product) {
    const statuses = this.getStatusesForProduct(product.id);
    const body = Utils.el('div');
    body.appendChild(Utils.el('p', { style: 'color:var(--text-muted);' }, product.description || 'لا يوجد وصف لهذا الصنف'));

    if (!statuses.length) {
      body.appendChild(Utils.el('p', {}, 'لا توجد بيانات حالة لهذا الصنف بعد'));
    }

    statuses.forEach(s => {
      const dep = STATE.departments.find(d => d.id === s.department_id);
      const box = Utils.el('div', { style: 'border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px;' });
      box.appendChild(Utils.el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;' }, [
        Utils.el('strong', {}, dep ? dep.name : 'قسم غير معروف'),
        Utils.el('span', { class: `status-badge ${s.status}` }, Utils.statusLabel(s.status))
      ]));

      if (s.status === 'available' && s.quantity_level) {
        box.appendChild(Utils.el('div', {}, `الكمية التقريبية: ${Utils.quantityLabel(s.quantity_level)}`));
      }
      if (s.status === 'coming_soon' && s.available_at) {
        box.appendChild(Utils.el('div', { class: 'countdown', 'data-target': s.available_at }, `الوقت المتبقي: ${Utils.formatCountdown(s.available_at)}`));
      }
      if (s.status === 'out_of_stock') {
        const alts = STATE.alternatives.filter(a => a.product_status_id === s.id);
        if (alts.length) {
          const altNames = alts.map(a => {
            const ap = STATE.products.find(p => p.id === a.alternative_product_id);
            return ap ? ap.name : null;
          }).filter(Boolean);
          if (altNames.length) box.appendChild(Utils.el('div', {}, `بدائل مقترحة: ${altNames.join('، ')}`));
        }
        if (s.note) box.appendChild(Utils.el('div', { style: 'margin-top:6px;color:var(--text-muted);' }, `ملاحظة القسم: ${s.note}`));
      }

      box.appendChild(Utils.el('div', { class: 'product-card__meta', style: 'margin-top:8px;' }, `آخر تحديث: ${Utils.formatDateTime(s.updated_at)}`));
      body.appendChild(box);
    });

    Modal.open({ title: product.name, bodyNode: body, actions: [{ label: 'إغلاق', className: 'btn-primary', onClick: () => Modal.close() }] });
  }
};
