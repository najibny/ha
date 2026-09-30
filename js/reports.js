// ============================================================================
// تقرير نهاية اليوم — منطق مشترك يُستخدم من صفحتي الإدارة ومسؤول القسم
// ============================================================================

const Reports = {
  /** الحد الافتراضي لاعتبار الصنف "انتهى مبكرًا" — الساعة 15:00 (قابل للتعديل من هنا) */
  EARLY_HOUR: (window.APP_CONFIG && window.APP_CONFIG.EARLY_OUT_OF_STOCK_HOUR) || 15,

  /** يبني تقريرًا ليوم معيّن، اختياريًا لقسم واحد فقط */
  build(dateStr, departmentId = null) {
    const dayStart = new Date(dateStr); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateStr); dayEnd.setHours(23, 59, 59, 999);

    let events = STATE.activityLog.filter(e => {
      const t = new Date(e.created_at);
      return t >= dayStart && t <= dayEnd && e.event_type === 'status_change';
    });
    if (departmentId) events = events.filter(e => e.department_id === departmentId);

    // عدد مرات التغيير لكل صنف
    const changeCounts = {};
    const earlyOut = [];
    events.forEach(e => {
      const key = `${e.product_id}__${e.department_id}`;
      changeCounts[key] = (changeCounts[key] || 0) + 1;
      if (e.new_value && e.new_value.status === 'out_of_stock') {
        const t = new Date(e.created_at);
        if (t.getHours() < this.EARLY_HOUR) {
          earlyOut.push({ productId: e.product_id, departmentId: e.department_id, time: e.created_at });
        }
      }
    });

    const topChanged = Object.entries(changeCounts)
      .map(([key, count]) => {
        const [productId, departmentId] = key.split('__');
        return { productId, departmentId, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    return { events, earlyOut, topChanged, totalEvents: events.length };
  },

  productName(id) { return STATE.products.find(p => p.id === id)?.name || 'صنف محذوف'; },
  departmentName(id) { return STATE.departments.find(d => d.id === id)?.name || 'قسم محذوف'; },

  toCsvRows(report) {
    const rows = [['النوع', 'الصنف', 'القسم', 'الوقت']];
    report.events.forEach(e => {
      rows.push(['تغيير حالة', this.productName(e.product_id), this.departmentName(e.department_id), Utils.formatDateTime(e.created_at)]);
    });
    return rows;
  }
};
