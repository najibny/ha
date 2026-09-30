// ============================================================================
// صفحة الإدارة
// ============================================================================

const AdminView = {
  activeTab: 'overview',
  logFilters: { date: '', departmentId: '', productId: '', type: '' },

  render() {
    const main = document.getElementById('app-main');
    main.innerHTML = '';

    main.appendChild(Utils.el('div', { class: 'view-header' }, Utils.el('h2', { class: 'view-title' }, 'لوحة الإدارة')));

    const tabs = Utils.el('div', { class: 'tabs' });
    const tabDefs = [['overview', 'نظرة عامة'], ['log', 'سجل التغييرات'], ['report', 'تقرير نهاية اليوم']];
    tabDefs.forEach(([key, label]) => {
      tabs.appendChild(Utils.el('button', {
        class: 'tab-btn' + (this.activeTab === key ? ' active' : ''),
        onclick: () => { this.activeTab = key; this.render(); }
      }, label));
    });
    main.appendChild(tabs);

    const body = Utils.el('div', { id: 'admin-body' });
    main.appendChild(body);

    if (this.activeTab === 'overview') this.renderOverview(body);
    else if (this.activeTab === 'log') this.renderLog(body);
    else this.renderReport(body);
  },

  renderOverview(body) {
    const stats = Utils.el('div', { class: 'stat-grid' });
    const departments = STATE.departments.filter(d => d.kind === 'department' && d.is_active);
    const pressureCount = departments.filter(d => d.work_mode === 'high_pressure').length;
    const outCount = STATE.statuses.filter(s => s.status === 'out_of_stock').length;
    const comingSoonCount = STATE.statuses.filter(s => s.status === 'coming_soon').length;

    [
      ['عدد الأقسام النشطة', departments.length],
      ['أقسام في ضغط عالٍ', pressureCount],
      ['أصناف منتهية حاليًا', outCount],
      ['أصناف سيتوفر لاحقًا', comingSoonCount]
    ].forEach(([label, value]) => {
      stats.appendChild(Utils.el('div', { class: 'stat-card' }, [
        Utils.el('div', { class: 'stat-card__value' }, String(value)),
        Utils.el('div', { class: 'stat-card__label' }, label)
      ]));
    });
    body.appendChild(stats);

    body.appendChild(Utils.el('h3', {}, 'حالة الأقسام'));
    const wrap = Utils.el('div', { class: 'table-wrap' });
    const table = Utils.el('table', { class: 'data-table' });
    table.appendChild(Utils.el('thead', {}, Utils.el('tr', {}, [
      Utils.el('th', {}, 'القسم'), Utils.el('th', {}, 'الوضع'), Utils.el('th', {}, 'عدد الأصناف المنتهية'), Utils.el('th', {}, 'آخر تحديث وضع')
    ])));
    const tbody = Utils.el('tbody');
    departments.forEach(dep => {
      const depOut = STATE.statuses.filter(s => s.department_id === dep.id && s.status === 'out_of_stock').length;
      tbody.appendChild(Utils.el('tr', {}, [
        Utils.el('td', {}, dep.name),
        Utils.el('td', {}, Utils.el('span', {
          class: `mode-badge ${dep.work_mode}`
        }, dep.work_mode === 'high_pressure' ? 'ضغط عالٍ' : 'عادي')),
        Utils.el('td', {}, String(depOut)),
        Utils.el('td', {}, Utils.timeAgo(dep.work_mode_updated_at))
      ]));
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    body.appendChild(wrap);

    body.appendChild(Utils.el('h3', { style: 'margin-top:24px;' }, 'الأصناف الأكثر نفادًا اليوم'));
    const today = new Date();
    const report = Reports.build(today);
    const depletedWrap = Utils.el('div', { class: 'table-wrap' });
    const depletedTable = Utils.el('table', { class: 'data-table' });
    depletedTable.appendChild(Utils.el('thead', {}, Utils.el('tr', {}, [Utils.el('th', {}, 'الصنف'), Utils.el('th', {}, 'القسم'), Utils.el('th', {}, 'عدد مرات التغيير')])));
    const dtbody = Utils.el('tbody');
    if (!report.topChanged.length) dtbody.appendChild(Utils.el('tr', {}, Utils.el('td', { colspan: '3' }, 'لا توجد بيانات اليوم')));
    report.topChanged.forEach(item => {
      dtbody.appendChild(Utils.el('tr', {}, [
        Utils.el('td', {}, Reports.productName(item.productId)),
        Utils.el('td', {}, Reports.departmentName(item.departmentId)),
        Utils.el('td', {}, String(item.count))
      ]));
    });
    depletedTable.appendChild(dtbody);
    depletedWrap.appendChild(depletedTable);
    body.appendChild(depletedWrap);
    Utils.refreshIcons();
  },

  renderLog(body) {
    const filterBar = Utils.el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;' });

    const dateInput = Utils.el('input', { type: 'date', class: 'form-input', style: 'width:auto;', onchange: (e) => { this.logFilters.date = e.target.value; this.renderLog(body); } });
    dateInput.value = this.logFilters.date;
    filterBar.appendChild(dateInput);

    const depSelect = Utils.el('select', { class: 'form-select', style: 'width:auto;', onchange: (e) => { this.logFilters.departmentId = e.target.value; this.renderLog(body); } });
    depSelect.appendChild(Utils.el('option', { value: '' }, 'كل الأقسام'));
    STATE.departments.forEach(d => depSelect.appendChild(Utils.el('option', { value: d.id, selected: this.logFilters.departmentId === d.id ? 'selected' : null }, d.name)));
    filterBar.appendChild(depSelect);

    const typeSelect = Utils.el('select', { class: 'form-select', style: 'width:auto;', onchange: (e) => { this.logFilters.type = e.target.value; this.renderLog(body); } });
    [['', 'كل الأحداث'], ['status_change', 'تغيير حالة'], ['work_mode_change', 'تغيير وضع القسم'], ['bulk_action', 'إجراء جماعي'], ['pin_change', 'تغيير PIN'], ['product_change', 'تعديل صنف']].forEach(([val, label]) => {
      typeSelect.appendChild(Utils.el('option', { value: val, selected: this.logFilters.type === val ? 'selected' : null }, label));
    });
    filterBar.appendChild(typeSelect);

    filterBar.appendChild(Utils.el('button', { class: 'btn btn-secondary btn-sm', html: '<i data-lucide="filter-x" width="14"></i> مسح الفلاتر', onclick: () => { this.logFilters = { date: '', departmentId: '', productId: '', type: '' }; this.renderLog(body); } }));
    filterBar.appendChild(Utils.el('button', { class: 'btn btn-primary btn-sm', html: '<i data-lucide="download" width="14"></i> تصدير CSV', onclick: () => this.exportLog() }));

    body.innerHTML = '';
    body.appendChild(filterBar);

    let logs = STATE.activityLog.slice();
    if (this.logFilters.date) {
      logs = logs.filter(l => new Date(l.created_at).toDateString() === new Date(this.logFilters.date).toDateString());
    }
    if (this.logFilters.departmentId) logs = logs.filter(l => l.department_id === this.logFilters.departmentId);
    if (this.logFilters.type) logs = logs.filter(l => l.event_type === this.logFilters.type);

    const wrap = Utils.el('div', { class: 'table-wrap' });
    const table = Utils.el('table', { class: 'data-table' });
    table.appendChild(Utils.el('thead', {}, Utils.el('tr', {}, [
      Utils.el('th', {}, 'التاريخ والوقت'), Utils.el('th', {}, 'النوع'),
      Utils.el('th', {}, 'القسم'), Utils.el('th', {}, 'التفاصيل'), Utils.el('th', {}, 'نفّذها')
    ])));
    const tbody = Utils.el('tbody');
    if (!logs.length) tbody.appendChild(Utils.el('tr', {}, Utils.el('td', { colspan: '5' }, 'لا توجد سجلات مطابقة')));
    logs.slice(0, 300).forEach(l => {
      const productName = l.product_id ? Reports.productName(l.product_id) : null;
      const departmentName = l.department_id ? Reports.departmentName(l.department_id) : null;
      const actorName = l.actor_department_id ? Reports.departmentName(l.actor_department_id) : null;
      tbody.appendChild(Utils.el('tr', {}, [
        Utils.el('td', { style: 'white-space:nowrap;' }, Utils.formatDateTime(l.created_at)),
        Utils.el('td', {}, ActivityFormat.eventLabel(l.event_type)),
        Utils.el('td', {}, departmentName || '—'),
        // وصف عربي مقروء بدل JSON الخام
        Utils.el('td', {}, ActivityFormat.describe(l, productName, departmentName)),
        Utils.el('td', {}, actorName || '—')
      ]));
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    body.appendChild(wrap);
    Utils.refreshIcons();
  },

  exportLog() {
    const rows = [['التاريخ والوقت', 'النوع', 'القسم', 'الصنف', 'التفاصيل']];
    STATE.activityLog.forEach(l => {
      const productName = l.product_id ? Reports.productName(l.product_id) : '';
      const departmentName = l.department_id ? Reports.departmentName(l.department_id) : '';
      rows.push([
        Utils.formatDateTime(l.created_at),
        ActivityFormat.eventLabel(l.event_type),
        departmentName,
        productName,
        ActivityFormat.describe(l, productName, departmentName).textContent  // نفس النص العربي المعروض
      ]);
    });
    Utils.downloadCsv('سجل-النشاط.csv', rows);
    Utils.toast('تم تصدير سجل النشاط بصيغة CSV.', 'success');
  },

  renderReport(body) {
    const dateInput = Utils.el('input', { type: 'date', class: 'form-input', style: 'width:auto;margin-bottom:16px;' });
    dateInput.value = new Date().toISOString().slice(0, 10);
    body.appendChild(dateInput);

    const resultHost = Utils.el('div', { id: 'admin-report-result' });
    body.appendChild(resultHost);

    const renderResult = () => {
      const report = Reports.build(dateInput.value);
      resultHost.innerHTML = '';

      const stats = Utils.el('div', { class: 'stat-grid' });
      [['إجمالي التغييرات', report.totalEvents], ['أصناف انتهت مبكرًا', report.earlyOut.length]].forEach(([label, value]) => {
        stats.appendChild(Utils.el('div', { class: 'stat-card' }, [Utils.el('div', { class: 'stat-card__value' }, String(value)), Utils.el('div', { class: 'stat-card__label' }, label)]));
      });
      resultHost.appendChild(stats);

      resultHost.appendChild(Utils.el('h4', {}, `الأصناف التي انتهت قبل الساعة ${Reports.EARLY_HOUR}:00`));
      if (!report.earlyOut.length) {
        resultHost.appendChild(Utils.el('p', { style: 'color:var(--text-muted);' }, 'لا يوجد'));
      } else {
        const ul = Utils.el('ul');
        report.earlyOut.forEach(e => ul.appendChild(Utils.el('li', { style: 'line-height:1.9;' },
          `${Reports.productName(e.productId)} — قسم ${Reports.departmentName(e.departmentId)} — انتهى الساعة ${Utils.formatClock(new Date(e.time))}`)));
        resultHost.appendChild(ul);
      }

      resultHost.appendChild(Utils.el('h4', {}, 'مقارنة بين الأقسام (عدد مرات التغيير)'));
      const byDept = {};
      report.events.forEach(e => { byDept[e.department_id] = (byDept[e.department_id] || 0) + 1; });
      const wrap = Utils.el('div', { class: 'table-wrap' });
      const table = Utils.el('table', { class: 'data-table' });
      table.appendChild(Utils.el('thead', {}, Utils.el('tr', {}, [Utils.el('th', {}, 'القسم'), Utils.el('th', {}, 'عدد التغييرات')])));
      const tbody = Utils.el('tbody');
      Object.entries(byDept).forEach(([depId, count]) => tbody.appendChild(Utils.el('tr', {}, [Utils.el('td', {}, Reports.departmentName(depId)), Utils.el('td', {}, String(count))])));
      table.appendChild(tbody);
      wrap.appendChild(table);
      resultHost.appendChild(wrap);

      resultHost.appendChild(Utils.el('button', {
        class: 'btn btn-primary', style: 'margin-top:16px;',
        onclick: () => { Utils.downloadCsv(`تقرير-${dateInput.value}.csv`, Reports.toCsvRows(report)); Utils.toast('تم تصدير التقرير بصيغة CSV.', 'success'); }
      }, 'تصدير التقرير CSV'));
    };

    dateInput.addEventListener('change', renderResult);
    renderResult();
  }
};
