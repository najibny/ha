// ============================================================================
// دوال مساعدة عامة (تنسيق الوقت، Toast، أيقونات Lucide، أدوات DOM صغيرة)
// ============================================================================

const Utils = {
  /** تهيئة عنصر DOM بسرعة */
  el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const child of [].concat(children)) {
      if (child == null) continue;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
    return node;
  },

  /** تنسيق وقت نسبي بسيط بالعربية */
  timeAgo(dateStr) {
    if (!dateStr) return '—';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'الآن';
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `منذ ${hours} ساعة`;
    const days = Math.floor(hours / 24);
    return `منذ ${days} يوم`;
  },

  /** تنسيق وقت الساعة بالعربية (24 ساعة) */
  formatClock(date = new Date()) {
    return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  },

  formatDateTime(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
  },

  /** عداد تنازلي نصي HH:MM:SS أو MM:SS */
  formatCountdown(targetDateStr) {
    const diff = new Date(targetDateStr).getTime() - Date.now();
    if (diff <= 0) return '00:00';
    const totalSec = Math.floor(diff / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  },

  quantityLabel(level) {
    const map = { less_5: 'أقل من 5 قطع', '5_10': 'من 5 إلى 10 قطع', more_10: 'أكثر من 10 قطع', plenty: 'متوفر بكثرة' };
    return map[level] || 'غير محددة';
  },

  statusLabel(status) {
    const map = { available: 'متوفر', out_of_stock: 'منتهي', coming_soon: 'سيتوفر لاحقًا' };
    return map[status] || status;
  },

  statusIcon(status) {
    const map = { available: 'check-circle', out_of_stock: 'x-circle', coming_soon: 'clock' };
    return map[status] || 'circle';
  },

  /** إعادة رسم أيقونات Lucide بعد أي تحديث للـ DOM */
  refreshIcons() {
    if (window.lucide) window.lucide.createIcons();
  },

  /** إظهار رسالة Toast قصيرة */
  toast(message, type = 'info') {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = Utils.el('div', { class: 'toast-stack' });
      document.body.appendChild(stack);
    }
    const node = Utils.el('div', { class: `toast ${type}` }, message);
    stack.appendChild(node);
    setTimeout(() => node.remove(), 3800);
  },

  debounce(fn, wait = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  },

  /** تحويل بيانات إلى CSV وتنزيلها */
  downloadCsv(filename, rows) {
    const csv = rows.map(r => r.map(cell => {
      const val = (cell ?? '').toString().replace(/"/g, '""');
      return `"${val}"`;
    }).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  uuid() {
    return crypto.randomUUID();
  }
};
