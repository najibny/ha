// ============================================================================
// صياغة سجل النشاط بالعربية — طبقة عرض فقط
// تعتمد كليًا على البيانات الموجودة حاليًا في activity_log
// ولا تعدّل أي جدول أو دالة في Supabase.
// ============================================================================

const ActivityFormat = {
  /** ترجمة اسم الحالة إلى العربية */
  status(code) {
    const map = { available: 'متوفر', out_of_stock: 'منتهي', coming_soon: 'لاحقًا' };
    return map[code] || null;
  },

  /** ترجمة مستوى الكمية إلى العربية */
  quantity(code) {
    const map = {
      less_5: 'أقل من 5 قطع',
      '5_10': 'من 5 إلى 10 قطع',
      more_10: 'أكثر من 10 قطع',
      plenty: 'متوفر بكثرة'
    };
    return map[code] || null;
  },

  /** عنوان نوع الحدث بالعربية */
  eventLabel(type) {
    const map = {
      status_change: 'تغيير حالة صنف',
      work_mode_change: 'تغيير وضع القسم',
      bulk_action: 'إجراء جماعي',
      pin_change: 'تغيير رمز الدخول',
      product_change: 'تعديل صنف'
    };
    return map[type] || 'حدث';
  },

  /** يحاول قراءة قيمة JSON سواء كانت كائنًا أو نصًا */
  parse(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch { return null; }
  },

  /** عنصر ملوّن لاسم الحالة */
  statusNode(code) {
    const label = this.status(code);
    if (!label) return null;
    return Utils.el('span', { class: `log-status ${code}` }, label);
  },

  /**
   * يبني وصفًا عربيًا مقروءًا لسطر واحد من السجل.
   * أمثلة الناتج:
   *   البقلاوة باللوز: من منتهي إلى لاحقًا — سيتوفر بعد ساعة.
   *   كيكة شوكولا: من لاحقًا إلى متوفر — الكمية: أكثر من 10 قطع.
   */
  describe(entry, productName, departmentName) {
    const oldVal = this.parse(entry.old_value);
    const newVal = this.parse(entry.new_value);
    const line = Utils.el('span', { class: 'log-line' });

    // --- تغيير حالة صنف ---
    if (entry.event_type === 'status_change') {
      if (productName) {
        line.appendChild(Utils.el('span', { class: 'log-item-name' }, productName));
        line.appendChild(document.createTextNode(': '));
      }

      const from = oldVal && this.status(oldVal.status);
      const to = newVal && this.status(newVal.status);

      if (from && to) {
        line.appendChild(document.createTextNode('من '));
        line.appendChild(this.statusNode(oldVal.status));
        line.appendChild(Utils.el('span', { class: 'log-arrow' }, '←'));
        line.appendChild(document.createTextNode('إلى '));
        line.appendChild(this.statusNode(newVal.status));
      } else if (to) {
        line.appendChild(document.createTextNode('تم ضبط الحالة على '));
        line.appendChild(this.statusNode(newVal.status));
      } else {
        line.appendChild(document.createTextNode('تم تحديث حالة الصنف'));
      }

      // تفاصيل إضافية حسب الحالة الجديدة
      const extras = [];
      if (newVal) {
        if (newVal.status === 'available') {
          const q = this.quantity(newVal.quantity_level);
          if (q) extras.push(`الكمية: ${q}`);
        }
        if (newVal.status === 'coming_soon' && newVal.available_at) {
          const remaining = new Date(newVal.available_at).getTime() - new Date(entry.created_at).getTime();
          if (remaining > 0) extras.push(`سيتوفر بعد ${Utils.humanDuration(remaining / 60000)}`);
          else extras.push(`موعد التوفر: ${Utils.formatDateTime(newVal.available_at)}`);
        }
      }
      if (extras.length) line.appendChild(document.createTextNode(` — ${extras.join(' — ')}.`));
      else line.appendChild(document.createTextNode('.'));
      return line;
    }

    // --- تغيير وضع القسم ---
    if (entry.event_type === 'work_mode_change') {
      const modeLabel = (m) => (m === 'high_pressure' ? 'ضغط عالٍ' : 'عادي');
      const dep = departmentName || 'القسم';
      if (oldVal && newVal) {
        line.appendChild(document.createTextNode(`${dep}: تغيّر وضع العمل من ${modeLabel(oldVal.work_mode)} إلى ${modeLabel(newVal.work_mode)}.`));
      } else if (newVal) {
        line.appendChild(document.createTextNode(`${dep}: أصبح وضع العمل ${modeLabel(newVal.work_mode)}.`));
      } else {
        line.appendChild(document.createTextNode(`${dep}: تم تغيير وضع العمل.`));
      }
      return line;
    }

    // --- إجراء جماعي على كل أصناف القسم ---
    if (entry.event_type === 'bulk_action') {
      const dep = departmentName || 'القسم';
      const statusLabel = newVal && this.status(newVal.status);
      const count = newVal && newVal.affected != null ? newVal.affected : null;
      if (statusLabel === 'متوفر') {
        line.appendChild(document.createTextNode(`${dep}: تم توفير جميع الأصناف${count != null ? ` (${count} صنفًا)` : ''}.`));
      } else if (statusLabel === 'منتهي') {
        line.appendChild(document.createTextNode(`${dep}: تم إيقاف جميع الأصناف${count != null ? ` (${count} صنفًا)` : ''}.`));
      } else {
        line.appendChild(document.createTextNode(`${dep}: تم تنفيذ إجراء جماعي على الأصناف.`));
      }
      return line;
    }

    // --- تغيير رمز الدخول ---
    if (entry.event_type === 'pin_change') {
      line.appendChild(document.createTextNode(`${departmentName || 'جهة'}: تم تحديث رمز الدخول.`));
      return line;
    }

    // --- أي نوع آخر: وصف عام مفهوم بدل JSON خام ---
    line.appendChild(document.createTextNode(
      `${this.eventLabel(entry.event_type)}${productName ? `: ${productName}` : ''}${departmentName ? ` — ${departmentName}` : ''}.`
    ));
    return line;
  }
};
