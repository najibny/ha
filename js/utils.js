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

  // ==========================================================================
  // أيقونات الأقسام
  // تعديل عرضي فقط: نستبدل أيقونة قسم معيّن دون لمس قاعدة البيانات.
  // المفتاح هو حقل code الخاص بالقسم، والقيمة اسم أيقونة من مكتبة Lucide.
  // لإضافة تخصيص لاحقًا، أضف سطرًا هنا فقط.
  // ==========================================================================
  DEPT_ICON_OVERRIDES: {
    baklawa: 'dessert'     // أقرب أيقونة لمعنى البقلاوة والحلويات الشرقية
  },

  /** تحويل اسم أيقونة من صيغة kebab-case إلى PascalCase كما تخزنها Lucide */
  _toPascal(name) {
    return String(name || '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  },

  /** التأكد أن الأيقونة موجودة فعلًا في المكتبة قبل استخدامها */
  lucideHas(name) {
    if (!name) return false;
    const icons = window.lucide && window.lucide.icons;
    if (!icons) return true;          // المكتبة لم تُحمّل بعد: لا نمنع الاسم
    return Object.prototype.hasOwnProperty.call(icons, Utils._toPascal(name));
  },

  /** أيقونة القسم النهائية: التخصيص أولًا، ثم أيقونة قاعدة البيانات، ثم بديل آمن */
  deptIcon(dep) {
    const override = dep && Utils.DEPT_ICON_OVERRIDES[dep.code];
    if (override && Utils.lucideHas(override)) return override;
    if (dep && dep.icon && Utils.lucideHas(dep.icon)) return dep.icon;
    return 'cookie';
  },

  quantityLabel(level) {
    const map = { less_5: 'أقل من 5 قطع', '5_10': 'من 5 إلى 10 قطع', more_10: 'أكثر من 10 قطع', plenty: 'متوفر بكثرة' };
    return map[level] || 'غير محددة';
  },

  statusLabel(status) {
    const map = { available: 'متوفر', out_of_stock: 'منتهي', coming_soon: 'لاحقًا' };
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

  /** أيقونة الإشعار حسب النوع */
  toastIcon(type) {
    const map = { success: 'check-circle-2', error: 'alert-circle', warn: 'clock', info: 'info' };
    return map[type] || 'info';
  },

  /**
   * إشعار منبثق في زاوية الشاشة (ليس رسالة شات).
   * الأنواع: success (أخضر) | error (أحمر) | warn (برتقالي) | info (أزرق)
   */
  toast(message, type = 'info', duration = 4200) {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = Utils.el('div', { class: 'toast-stack' });
      document.body.appendChild(stack);
    }
    const node = Utils.el('div', { class: `toast ${type}`, role: 'status' }, [
      Utils.el('span', { class: 'toast__icon', html: `<i data-lucide="${Utils.toastIcon(type)}"></i>` }),
      Utils.el('span', { class: 'toast__text' }, message)
    ]);
    stack.appendChild(node);
    Utils.refreshIcons();
    // اختفاء لطيف بعد المدة المحددة
    setTimeout(() => {
      node.classList.add('leaving');
      setTimeout(() => node.remove(), 260);
    }, duration);
  },

  /** صياغة مدة بالعربية من إجمالي الدقائق: "ساعة و10 دقائق" */
  humanDuration(totalMinutes) {
    const mins = Math.max(0, Math.round(totalMinutes));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const hPart = h === 0 ? '' : h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : (h <= 10 ? `${h} ساعات` : `${h} ساعة`);
    const mPart = m === 0 ? '' : m === 1 ? 'دقيقة' : m === 2 ? 'دقيقتين' : (m <= 10 ? `${m} دقائق` : `${m} دقيقة`);
    if (hPart && mPart) return `${hPart} و${mPart}`;
    return hPart || mPart || 'أقل من دقيقة';
  },

  /** المدة المتبقية حتى وقت معيّن بصيغة عربية مقروءة */
  humanRemaining(targetDateStr) {
    const diffMin = (new Date(targetDateStr).getTime() - Date.now()) / 60000;
    if (diffMin <= 0) return 'انتهى الوقت';
    return Utils.humanDuration(diffMin);
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
