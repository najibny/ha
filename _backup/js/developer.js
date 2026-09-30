// ============================================================================
// لوحة المطور مجد — إدارة كاملة للبيانات من داخل الموقع دون لمس الكود
// ============================================================================

const DeveloperView = {
  activeTab: 'departments',

  render() {
    const main = document.getElementById('app-main');
    main.innerHTML = '';
    main.appendChild(Utils.el('div', { class: 'view-header' }, Utils.el('h2', { class: 'view-title' }, 'لوحة المطور')));

    const tabs = Utils.el('div', { class: 'tabs' });
    [['departments', 'الأقسام'], ['products', 'الأصناف'], ['popular', 'الأكثر شيوعًا'], ['pins', 'رموز PIN'], ['log', 'سجل التغييرات']].forEach(([key, label]) => {
      tabs.appendChild(Utils.el('button', { class: 'tab-btn' + (this.activeTab === key ? ' active' : ''), onclick: () => { this.activeTab = key; this.render(); } }, label));
    });
    main.appendChild(tabs);

    const body = Utils.el('div', { id: 'dev-body' });
    main.appendChild(body);

    if (this.activeTab === 'departments') this.renderDepartments(body);
    else if (this.activeTab === 'products') this.renderProducts(body);
    else if (this.activeTab === 'popular') this.renderPopular(body);
    else if (this.activeTab === 'pins') this.renderPins(body);
    else { AdminView.activeTab = 'log'; AdminView.renderLog(body); }
  },

  renderDepartments(body) {
    body.appendChild(Utils.el('button', { class: 'btn btn-primary', style: 'margin-bottom:16px;', onclick: () => this.editDepartment(null) }, '+ إضافة قسم جديد'));

    const wrap = Utils.el('div', { class: 'table-wrap' });
    const table = Utils.el('table', { class: 'data-table' });
    table.appendChild(Utils.el('thead', {}, Utils.el('tr', {}, [Utils.el('th', {}, 'الاسم'), Utils.el('th', {}, 'الرمز'), Utils.el('th', {}, 'الترتيب'), Utils.el('th', {}, 'الحالة'), Utils.el('th', {}, 'إجراءات')])));
    const tbody = Utils.el('tbody');
    STATE.departments.filter(d => d.kind === 'department').sort((a, b) => a.sort_order - b.sort_order).forEach(dep => {
      tbody.appendChild(Utils.el('tr', {}, [
        Utils.el('td', {}, dep.name),
        Utils.el('td', {}, dep.code),
        Utils.el('td', {}, String(dep.sort_order)),
        Utils.el('td', {}, dep.is_active ? 'مفعّل' : 'موقّف'),
        Utils.el('td', { style: 'display:flex;gap:6px;' }, [
          Utils.el('button', { class: 'btn btn-secondary btn-sm', onclick: () => this.editDepartment(dep) }, 'تعديل'),
          Utils.el('button', { class: 'btn btn-sm ' + (dep.is_active ? 'btn-danger' : 'btn-primary'), onclick: () => this.toggleDepartmentActive(dep) }, dep.is_active ? 'إيقاف' : 'تفعيل')
        ])
      ]));
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    body.appendChild(wrap);
  },

  editDepartment(dep) {
    const nameInput = Utils.el('input', { class: 'form-input', value: dep ? dep.name : '' });
    const codeInput = Utils.el('input', { class: 'form-input', value: dep ? dep.code : '', placeholder: 'مثال: baklawa (حروف إنجليزية فقط)' });
    const iconInput = Utils.el('input', { class: 'form-input', value: dep ? dep.icon : 'package', placeholder: 'اسم أيقونة Lucide مثل cake-slice' });
    const orderInput = Utils.el('input', { type: 'number', class: 'form-input', value: dep ? dep.sort_order : 0 });

    const body = Utils.el('div', {}, [
      Utils.el('div', { class: 'form-group' }, [Utils.el('label', { class: 'form-label' }, 'اسم القسم'), nameInput]),
      Utils.el('div', { class: 'form-group' }, [Utils.el('label', { class: 'form-label' }, 'الرمز البرمجي'), codeInput]),
      Utils.el('div', { class: 'form-group' }, [Utils.el('label', { class: 'form-label' }, 'الأيقونة'), iconInput]),
      Utils.el('div', { class: 'form-group' }, [Utils.el('label', { class: 'form-label' }, 'الترتيب'), orderInput])
    ]);

    Modal.open({
      title: dep ? 'تعديل القسم' : 'إضافة قسم جديد',
      bodyNode: body,
      actions: [
        { label: 'إلغاء', className: 'btn-secondary', onClick: () => Modal.close() },
        { label: 'حفظ', className: 'btn-primary', onClick: async () => {
          const { error } = await supabaseClient.rpc('dev_upsert_department', {
            p_session_token: STATE.session.token,
            p_id: dep ? dep.id : null,
            p_code: codeInput.value.trim(),
            p_name: nameInput.value.trim(),
            p_icon: iconInput.value.trim() || 'package',
            p_sort_order: parseInt(orderInput.value) || 0
          });
          if (error) { Utils.toast('تعذر الحفظ: تأكد أن الرمز فريد وغير مستخدم', 'error'); return; }
          Modal.close();
          Utils.toast('تم الحفظ بنجاح', 'success');
          await Sync.loadInitialData();
          this.render();
        } }
      ]
    });
  },

  async toggleDepartmentActive(dep) {
    await supabaseClient.rpc('dev_set_department_active', { p_session_token: STATE.session.token, p_department_id: dep.id, p_is_active: !dep.is_active });
    await Sync.loadInitialData();
    this.render();
  },

  renderProducts(body) {
    body.appendChild(Utils.el('button', { class: 'btn btn-primary', style: 'margin-bottom:16px;', onclick: () => this.editProduct(null) }, '+ إضافة صنف جديد'));

    const wrap = Utils.el('div', { class: 'table-wrap' });
    const table = Utils.el('table', { class: 'data-table' });
    table.appendChild(Utils.el('thead', {}, Utils.el('tr', {}, [Utils.el('th', {}, 'الاسم'), Utils.el('th', {}, 'الكود'), Utils.el('th', {}, 'الأقسام'), Utils.el('th', {}, 'الحالة'), Utils.el('th', {}, 'إجراءات')])));
    const tbody = Utils.el('tbody');
    STATE.products.sort((a, b) => a.sort_order - b.sort_order).forEach(p => {
      const depNames = STATE.productDepartments.filter(pd => pd.product_id === p.id).map(pd => Reports.departmentName(pd.department_id)).join('، ');
      tbody.appendChild(Utils.el('tr', {}, [
        Utils.el('td', {}, p.name),
        Utils.el('td', {}, p.code || '—'),
        Utils.el('td', {}, depNames || '—'),
        Utils.el('td', {}, p.is_active ? 'مفعّل' : 'موقّف'),
        Utils.el('td', { style: 'display:flex;gap:6px;' }, [
          Utils.el('button', { class: 'btn btn-secondary btn-sm', onclick: () => this.editProduct(p) }, 'تعديل'),
          Utils.el('button', { class: 'btn btn-sm ' + (p.is_active ? 'btn-danger' : 'btn-primary'), onclick: () => this.toggleProductActive(p) }, p.is_active ? 'إيقاف' : 'تفعيل')
        ])
      ]));
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    body.appendChild(wrap);
  },

  editProduct(product) {
    const nameInput = Utils.el('input', { class: 'form-input', value: product ? product.name : '' });
    const codeInput = Utils.el('input', { class: 'form-input', value: product ? (product.code || '') : '' });
    const descInput = Utils.el('textarea', { class: 'form-textarea', value: product ? (product.description || '') : '' });
    descInput.value = product ? (product.description || '') : '';
    const orderInput = Utils.el('input', { type: 'number', class: 'form-input', value: product ? product.sort_order : 0 });

    let selectedDeps = product ? STATE.productDepartments.filter(pd => pd.product_id === product.id).map(pd => pd.department_id) : [];
    const depsWrap = Utils.el('div', { class: 'chip-select' });
    const renderDeps = () => {
      depsWrap.innerHTML = '';
      STATE.departments.filter(d => d.kind === 'department' && d.is_active).forEach(d => {
        const isSel = selectedDeps.includes(d.id);
        depsWrap.appendChild(Utils.el('button', {
          class: 'chip' + (isSel ? ' selected' : ''),
          onclick: () => { selectedDeps = isSel ? selectedDeps.filter(id => id !== d.id) : [...selectedDeps, d.id]; renderDeps(); }
        }, d.name));
      });
    };
    renderDeps();

    const body = Utils.el('div', {}, [
      Utils.el('div', { class: 'form-group' }, [Utils.el('label', { class: 'form-label' }, 'اسم الصنف'), nameInput]),
      Utils.el('div', { class: 'form-group' }, [Utils.el('label', { class: 'form-label' }, 'الكود (اختياري)'), codeInput]),
      Utils.el('div', { class: 'form-group' }, [Utils.el('label', { class: 'form-label' }, 'الوصف المختصر'), descInput]),
      Utils.el('div', { class: 'form-group' }, [Utils.el('label', { class: 'form-label' }, 'الترتيب'), orderInput]),
      Utils.el('div', { class: 'form-group' }, [Utils.el('label', { class: 'form-label' }, 'ربط الصنف بقسم أو أكثر'), depsWrap])
    ]);

    Modal.open({
      title: product ? 'تعديل الصنف' : 'إضافة صنف جديد',
      bodyNode: body,
      actions: [
        { label: 'إلغاء', className: 'btn-secondary', onClick: () => Modal.close() },
        { label: 'حفظ', className: 'btn-primary', onClick: async () => {
          const { error } = await supabaseClient.rpc('dev_upsert_product', {
            p_session_token: STATE.session.token,
            p_id: product ? product.id : null,
            p_code: codeInput.value.trim() || null,
            p_name: nameInput.value.trim(),
            p_description: descInput.value.trim(),
            p_sort_order: parseInt(orderInput.value) || 0,
            p_department_ids: selectedDeps
          });
          if (error) { Utils.toast('تعذر حفظ الصنف', 'error'); return; }
          Modal.close();
          Utils.toast('تم الحفظ بنجاح', 'success');
          await Sync.loadInitialData();
          this.render();
        } }
      ]
    });
  },

  async toggleProductActive(product) {
    await supabaseClient.rpc('dev_set_product_active', { p_session_token: STATE.session.token, p_product_id: product.id, p_is_active: !product.is_active });
    await Sync.loadInitialData();
    this.render();
  },

  renderPopular(body) {
    body.appendChild(Utils.el('p', { style: 'color:var(--text-muted);' }, 'الأصناف المختارة هنا تظهر في قسم "الأكثر شيوعًا" أعلى شاشة الكول سنتر فقط.'));
    const grid = Utils.el('div', { class: 'products-grid' });
    STATE.products.filter(p => p.is_active).forEach(p => {
      const isPopular = STATE.popular.some(pp => pp.product_id === p.id);
      const card = Utils.el('div', { class: 'product-card' });
      card.appendChild(Utils.el('div', { class: 'product-card__name' }, p.name));
      card.appendChild(Utils.el('label', { class: 'switch' }, [
        Utils.el('input', { type: 'checkbox', checked: isPopular ? 'checked' : null, onchange: async (e) => {
          await supabaseClient.rpc('dev_set_popular', { p_session_token: STATE.session.token, p_product_id: p.id, p_is_popular: e.target.checked, p_sort_order: 0 });
          await Sync.loadInitialData();
        } }),
        Utils.el('span', { class: 'switch-slider' })
      ]));
      grid.appendChild(card);
    });
    body.appendChild(grid);
  },

  renderPins(body) {
    body.appendChild(Utils.el('p', { style: 'color:var(--text-muted);' }, 'رموز PIN مخزّنة بصورة مشفّرة في قاعدة البيانات. يمكنك تعيين رمز جديد لكل جهة من هنا.'));
    const wrap = Utils.el('div', { class: 'table-wrap' });
    const table = Utils.el('table', { class: 'data-table' });
    table.appendChild(Utils.el('thead', {}, Utils.el('tr', {}, [Utils.el('th', {}, 'الجهة'), Utils.el('th', {}, 'إجراء')])));
    const tbody = Utils.el('tbody');
    STATE.departments.forEach(dep => {
      let newPin = '';
      const input = Utils.el('input', { type: 'text', maxlength: '4', class: 'form-input', style: 'width:100px;display:inline-block;', placeholder: '****', oninput: (e) => newPin = e.target.value });
      const saveBtn = Utils.el('button', { class: 'btn btn-primary btn-sm', style: 'margin-right:8px;', onclick: async () => {
        if (!/^\d{4}$/.test(newPin)) { Utils.toast('رمز PIN يجب أن يكون 4 أرقام', 'error'); return; }
        const { error } = await supabaseClient.rpc('set_department_pin', { p_department_id: dep.id, p_new_pin: newPin });
        if (error) { Utils.toast('تعذر تحديث الرمز', 'error'); return; }
        Utils.toast(`تم تحديث رمز ${dep.name}`, 'success');
      } }, 'حفظ');
      tbody.appendChild(Utils.el('tr', {}, [Utils.el('td', {}, dep.name), Utils.el('td', {}, [input, saveBtn])]));
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    body.appendChild(wrap);
  }
};
