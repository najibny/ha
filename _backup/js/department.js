// ============================================================================
// صفحة مسؤول القسم
// ============================================================================

const DepartmentView = {
  countdownTimer: null,

  render() {
    const main = document.getElementById('app-main');
    main.innerHTML = '';

    const dep = STATE.departments.find(d => d.id === STATE.session.department_id);
    if (!dep) { main.appendChild(Utils.el('div', { class: 'empty-state' }, 'تعذر العثور على بيانات القسم')); return; }

    // --- رأس الصفحة: اسم القسم + وضع العمل ---
    const header = Utils.el('div', { class: 'view-header' });
    header.appendChild(Utils.el('h2', { class: 'view-title' }, `قسم ${dep.name}`));

    const modeGroup = Utils.el('div', { style: 'display:flex;gap:8px;' });
    modeGroup.appendChild(Utils.el('button', {
      class: 'btn ' + (dep.work_mode === 'normal' ? 'btn-primary' : 'btn-secondary'),
      onclick: () => this.setWorkMode('normal')
    }, 'وضع عادي'));
    modeGroup.appendChild(Utils.el('button', {
      class: 'btn ' + (dep.work_mode === 'high_pressure' ? 'btn-danger' : 'btn-secondary'),
      onclick: () => this.setWorkMode('high_pressure')
    }, 'ضغط عالٍ'));
    header.appendChild(modeGroup);
    main.appendChild(header);

    // --- بحث ---
    const searchBox = Utils.el('div', { class: 'search-box' }, [
      Utils.el('span', { html: '<i data-lucide="search" width="18"></i>' }),
      Utils.el('input', {
        type: 'text', placeholder: 'ابحث عن صنف...',
        oninput: Utils.debounce((e) => { STATE.searchTerm = e.target.value.trim(); this.renderProductList(dep); }, 200)
      })
    ]);
    main.appendChild(searchBox);

    // --- إجراءات جماعية ---
    const bulkBar = Utils.el('div', { style: 'display:flex;gap:10px;margin:16px 0;flex-wrap:wrap;' });
    bulkBar.appendChild(Utils.el('button', {
      class: 'btn btn-secondary', onclick: () => this.confirmBulk('available')
    }, 'توفير كل الأصناف'));
    bulkBar.appendChild(Utils.el('button', {
      class: 'btn btn-danger', onclick: () => this.confirmBulk('out_of_stock')
    }, 'إيقاف كل الأصناف'));
    main.appendChild(bulkBar);

    // --- قائمة الأصناف ---
    const listHost = Utils.el('div', { id: 'dept-product-list' });
    main.appendChild(listHost);

    this.renderProductList(dep);
    this.startCountdownTicker();
  },

  getDeptProducts(dep) {
    const productIds = STATE.productDepartments.filter(pd => pd.department_id === dep.id).map(pd => pd.product_id);
    let products = STATE.products.filter(p => p.is_active && productIds.includes(p.id));
    if (STATE.searchTerm) {
      const q = STATE.searchTerm.toLowerCase();
      products = products.filter(p => p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q));
    }
    return products.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  },

  renderProductList(dep) {
    const host = document.getElementById('dept-product-list');
    if (!host) return;
    host.innerHTML = '';

    const products = this.getDeptProducts(dep);
    if (!products.length) {
      host.appendChild(Utils.el('div', { class: 'empty-state' }, [
        Utils.el('div', { html: '<i data-lucide="package-search" width="40"></i>' }),
        Utils.el('p', {}, 'لا توجد أصناف مطابقة')
      ]));
      Utils.refreshIcons();
      return;
    }

    const grid = Utils.el('div', { class: 'products-grid' });
    products.forEach(p => grid.appendChild(this.renderProductCard(p, dep)));
    host.appendChild(grid);
    Utils.refreshIcons();
  },

  getStatus(productId, departmentId) {
    return STATE.statuses.find(s => s.product_id === productId && s.department_id === departmentId);
  },

  renderProductCard(product, dep) {
    const status = this.getStatus(product.id, dep.id) || { status: 'available', quantity_level: null };

    const card = Utils.el('div', { class: 'product-card' });

    const top = Utils.el('div', { class: 'product-card__top' });
    const nameRow = Utils.el('div', { class: 'product-card__name' }, [
      product.name,
      Utils.el('button', {
        class: 'info-btn', title: 'الوصف',
        onclick: (e) => this.showDescription(e, product.description)
      }, '!')
    ]);
    top.appendChild(nameRow);
    top.appendChild(Utils.el('span', { class: `status-badge ${status.status}`, html: `<i data-lucide="${Utils.statusIcon(status.status)}" width="14"></i> ${Utils.statusLabel(status.status)}` }));
    card.appendChild(top);

    card.appendChild(Utils.el('div', { class: 'product-card__meta' }, `آخر تحديث: ${Utils.timeAgo(status.updated_at)}`));

    if (status.status === 'available' && status.quantity_level) {
      card.appendChild(Utils.el('div', { class: 'product-card__meta' }, `الكمية: ${Utils.quantityLabel(status.quantity_level)}`));
    }
    if (status.status === 'coming_soon' && status.available_at) {
      card.appendChild(Utils.el('div', { class: 'countdown', 'data-target': status.available_at }, [
        Utils.el('span', { html: '<i data-lucide="clock" width="14"></i>' }),
        Utils.el('span', { class: 'countdown-value' }, Utils.formatCountdown(status.available_at))
      ]));
    }

    const choices = Utils.el('div', { class: 'status-choice-group' });
    choices.appendChild(Utils.el('button', {
      class: 'status-choice ' + (status.status === 'available' ? 'selected available' : ''),
      onclick: () => this.chooseAvailable(product, dep)
    }, [Utils.el('span', { html: '<i data-lucide="check-circle" width="18"></i>' }), 'متوفر']));
    choices.appendChild(Utils.el('button', {
      class: 'status-choice ' + (status.status === 'out_of_stock' ? 'selected out_of_stock' : ''),
      onclick: () => this.chooseOutOfStock(product, dep, status)
    }, [Utils.el('span', { html: '<i data-lucide="x-circle" width="18"></i>' }), 'منتهي']));
    choices.appendChild(Utils.el('button', {
      class: 'status-choice ' + (status.status === 'coming_soon' ? 'selected coming_soon' : ''),
      onclick: () => this.chooseComingSoon(product, dep)
    }, [Utils.el('span', { html: '<i data-lucide="clock" width="18"></i>' }), 'سيتوفر لاحقًا']));
    card.appendChild(choices);

    return card;
  },

  showDescription(evt, description) {
    document.querySelectorAll('.tooltip-popover').forEach(n => n.remove());
    const pop = Utils.el('div', { class: 'tooltip-popover' }, description || 'لا يوجد وصف لهذا الصنف');
    document.body.appendChild(pop);
    const rect = evt.target.getBoundingClientRect();
    pop.style.top = `${rect.bottom + window.scrollY + 6}px`;
    pop.style.right = `${document.documentElement.clientWidth - rect.right}px`;
    setTimeout(() => document.addEventListener('click', function handler(e) {
      if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', handler); }
    }), 10);
  },

  async chooseAvailable(product, dep) {
    Modal.open({
      title: 'اختر الكمية التقديرية',
      bodyNode: (() => {
        const wrap = Utils.el('div', { class: 'chip-select' });
        const opts = [['less_5', 'أقل من 5 قطع'], ['5_10', 'من 5 إلى 10 قطع'], ['more_10', 'أكثر من 10 قطع'], ['plenty', 'كمية كبيرة / متوفر بكثرة']];
        opts.forEach(([val, label]) => {
          wrap.appendChild(Utils.el('button', {
            class: 'chip', onclick: async () => {
              Modal.close();
              await this.saveStatus(product, dep, 'available', val);
            }
          }, label));
        });
        return wrap;
      })(),
      actions: []
    });
  },

  chooseOutOfStock(product, dep, currentStatus) {
    let selectedAlternatives = [];
    let note = '';

    const bodyWrap = Utils.el('div');
    bodyWrap.appendChild(Utils.el('p', { style: 'color:var(--text-muted);font-size:0.88rem;' }, 'إضافة بدائل أو اقتراحات للكول سنتر (اختياري)'));

    const searchInput = Utils.el('input', { class: 'form-input', placeholder: 'ابحث بالاسم أو أول حرفين...' });
    bodyWrap.appendChild(searchInput);

    const suggestionsHost = Utils.el('div', { class: 'chip-select', style: 'margin-top:10px;' });
    bodyWrap.appendChild(suggestionsHost);

    const renderSuggestions = () => {
      suggestionsHost.innerHTML = '';
      const q = searchInput.value.trim().toLowerCase();
      const pool = STATE.products.filter(p => p.is_active && p.id !== product.id);
      const filtered = (q ? pool.filter(p => p.name.toLowerCase().includes(q)) : pool).slice(0, 12);
      filtered.forEach(p => {
        const isSelected = selectedAlternatives.includes(p.id);
        suggestionsHost.appendChild(Utils.el('button', {
          class: 'chip' + (isSelected ? ' selected' : ''),
          onclick: () => {
            selectedAlternatives = isSelected ? selectedAlternatives.filter(id => id !== p.id) : [...selectedAlternatives, p.id];
            renderSuggestions();
          }
        }, p.name));
      });
    };
    searchInput.addEventListener('input', Utils.debounce(renderSuggestions, 150));
    renderSuggestions();

    const noteInput = Utils.el('textarea', { class: 'form-textarea', placeholder: 'ملاحظة قصيرة (اختياري)', style: 'margin-top:10px;', oninput: (e) => note = e.target.value });
    bodyWrap.appendChild(noteInput);

    Modal.open({
      title: `تعيين "${product.name}" كمنتهٍ`,
      bodyNode: bodyWrap,
      actions: [
        { label: 'تخطي والحفظ بدون بدائل', className: 'btn-secondary', onClick: async () => { Modal.close(); await this.saveStatus(product, dep, 'out_of_stock', null, null, ''); } },
        { label: 'حفظ مع البدائل', className: 'btn-primary', onClick: async () => {
          Modal.close();
          const newStatus = await this.saveStatus(product, dep, 'out_of_stock', null, null, note);
          if (newStatus && selectedAlternatives.length) {
            for (const altId of selectedAlternatives) {
              await supabaseClient.rpc('add_product_alternative', {
                p_session_token: STATE.session.token,
                p_product_status_id: newStatus.id,
                p_alternative_product_id: altId
              });
            }
          }
        } }
      ]
    });
  },

  chooseComingSoon(product, dep) {
    const bodyWrap = Utils.el('div');
    bodyWrap.appendChild(Utils.el('p', { style: 'color:var(--text-muted);font-size:0.88rem;' }, 'حدد مدة سريعة أو وقتًا مخصصًا'));

    const quickWrap = Utils.el('div', { class: 'chip-select' });
    const quickOptions = [[15, '15 دقيقة'], [30, '30 دقيقة'], [45, '45 دقيقة'], [60, 'ساعة'], [120, 'ساعتان']];
    quickOptions.forEach(([mins, label]) => {
      quickWrap.appendChild(Utils.el('button', {
        class: 'chip', onclick: async () => {
          const target = new Date(Date.now() + mins * 60000).toISOString();
          Modal.close();
          await this.saveStatus(product, dep, 'coming_soon', null, target, '');
        }
      }, label));
    });
    bodyWrap.appendChild(quickWrap);

    bodyWrap.appendChild(Utils.el('div', { class: 'form-group', style: 'margin-top:16px;' }, [
      Utils.el('label', { class: 'form-label' }, 'أو حدد تاريخًا ووقتًا يدويًا'),
      Utils.el('input', { type: 'datetime-local', class: 'form-input', id: 'custom-datetime' })
    ]));

    Modal.open({
      title: `متى يتوفر "${product.name}"؟`,
      bodyNode: bodyWrap,
      actions: [
        { label: 'إلغاء', className: 'btn-secondary', onClick: () => Modal.close() },
        { label: 'حفظ الموعد اليدوي', className: 'btn-primary', onClick: async () => {
          const val = document.getElementById('custom-datetime').value;
          if (!val) { Utils.toast('اختر تاريخًا ووقتًا أولًا', 'error'); return; }
          Modal.close();
          await this.saveStatus(product, dep, 'coming_soon', null, new Date(val).toISOString(), '');
        } }
      ]
    });
  },

  async saveStatus(product, dep, status, quantity_level, available_at, note) {
    const existing = this.getStatus(product.id, dep.id);
    const result = await Sync.performOrQueue('update_status', {
      p_session_token: STATE.session.token,
      p_product_id: product.id,
      p_status: status,
      p_quantity_level: quantity_level,
      p_available_at: available_at || null,
      p_note: note ?? '',
      p_expected_version: existing ? existing.version : null
    }, 'update_product_status');

    if (result.error) {
      if (String(result.error.message || '').includes('CONFLICT')) {
        Utils.toast('تم تغيير حالة هذا الصنف في مكان آخر، جرى تحديث البيانات', 'error');
        await Sync.loadInitialData();
        this.render();
      } else {
        Utils.toast('حدث خطأ أثناء الحفظ، حاول مرة أخرى', 'error');
      }
      return null;
    }
    if (!result.queued) { Sounds.success(); Utils.toast('تم حفظ التحديث بنجاح', 'success'); }
    this.render();
    return existing || null;
  },

  confirmBulk(status) {
    const dep = STATE.departments.find(d => d.id === STATE.session.department_id);
    const count = this.getDeptProducts(dep).length;
    const isDanger = status === 'out_of_stock';
    Modal.open({
      title: isDanger ? 'تأكيد إيقاف كل الأصناف' : 'تأكيد توفير كل الأصناف',
      bodyNode: Utils.el('p', {}, `سيتم تطبيق هذا الإجراء على ${count} صنف في قسمك. هل أنت متأكد؟`),
      actions: [
        { label: 'إلغاء', className: 'btn-secondary', onClick: () => Modal.close() },
        { label: isDanger ? 'نعم، أوقف الكل' : 'نعم، وفّر الكل', className: isDanger ? 'btn-danger' : 'btn-primary', onClick: async () => {
          Modal.close();
          const { error } = await supabaseClient.rpc('bulk_update_department_status', { p_session_token: STATE.session.token, p_status: status });
          if (error) { Utils.toast('حدث خطأ أثناء تنفيذ الإجراء الجماعي', 'error'); return; }
          Sounds.success();
          Utils.toast('تم تنفيذ الإجراء الجماعي بنجاح', 'success');
          await Sync.loadInitialData();
          this.render();
        } }
      ]
    });
  },

  async setWorkMode(mode) {
    const { error } = await supabaseClient.rpc('set_department_work_mode', { p_session_token: STATE.session.token, p_work_mode: mode });
    if (error) { Utils.toast('تعذر تحديث وضع القسم', 'error'); return; }
    await Sync.loadInitialData();
    this.render();
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
