// ============================================================================
// نظام الرسائل — نافذة مراسلة الأقسام (خاصة بالكول سنتر)
// مسؤول القسم لديه الآن صندوق شات دائم داخل صفحته (انظر department.js)
// منطق الإرسال عبر RPC كما هو دون تغيير
// ============================================================================

const Messages = {
  activeDepartmentId: null,   // القسم المعروضة محادثته حاليًا
  _rerender: null,            // مرجع دالة إعادة الرسم لإلغاء الاشتراك عند الإغلاق

  /** نقطة الدخول: يمكن تمرير معرّف قسم لفتح محادثته مباشرة (رد سريع) */
  openPanel(preselectDepartmentId = null) {
    if (STATE.session.department_kind === 'department') {
      // في صفحة القسم الشات دائم داخل الصفحة، نكتفي بالتمرير إليه
      const win = document.getElementById('dept-chat-window');
      if (win) win.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    this.openCallcenterInbox(preselectDepartmentId);
  },

  openCallcenterInbox(preselectDepartmentId = null) {
    const departments = STATE.departments
      .filter(d => d.kind === 'department' && d.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);

    if (preselectDepartmentId) this.activeDepartmentId = preselectDepartmentId;
    if (!this.activeDepartmentId && departments.length) this.activeDepartmentId = departments[0].id;

    const body = Utils.el('div');

    // --- اختيار القسم ---
    const depsWrap = Utils.el('div', { class: 'chip-select', style: 'margin-bottom:12px;' });
    body.appendChild(Utils.el('div', { class: 'form-label' }, 'اختر القسم'));
    body.appendChild(depsWrap);

    // --- نافذة المحادثة ---
    const chatWindow = Utils.el('div', {
      class: 'chat-window',
      style: 'border:1px solid var(--border);border-radius:12px;'
    });
    body.appendChild(chatWindow);

    // --- منطقة الكتابة ---
    const input = Utils.el('input', {
      class: 'form-input', placeholder: 'اكتب ردًا على القسم...',
      'aria-label': 'نص الرسالة',
      onkeydown: (e) => { if (e.key === 'Enter') send(false); }
    });
    const sendBtn = Utils.el('button', {
      class: 'chat-send-btn', title: 'إرسال للقسم المحدد', 'aria-label': 'إرسال',
      html: '<i data-lucide="send" width="18"></i>',
      onclick: () => send(false)
    });
    body.appendChild(Utils.el('div', { style: 'display:flex;gap:8px;margin-top:12px;align-items:center;' }, [
      input, sendBtn
    ]));

    body.appendChild(Utils.el('div', { style: 'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;' }, [
      Utils.el('button', {
        class: 'btn btn-secondary btn-sm',
        html: '<i data-lucide="megaphone" width="14"></i> إرسال لكل الأقسام',
        onclick: () => send(true)
      }),
      Utils.el('button', {
        class: 'btn btn-danger btn-sm',
        html: '<i data-lucide="eraser" width="14"></i> تصفير المحادثة',
        onclick: () => this.confirmArchive()
      })
    ]));

    // --- إرسال ---
    const send = async (toAll) => {
      const text = input.value.trim();
      if (!text) return;
      if (!toAll && !this.activeDepartmentId) { Utils.toast('اختر قسمًا أولًا.', 'error'); return; }

      const depName = STATE.departments.find(d => d.id === this.activeDepartmentId)?.name || '';
      input.value = '';

      const result = await Sync.performOrQueue('send_message', {
        p_session_token: STATE.session.token,
        p_to_department_id: toAll ? null : this.activeDepartmentId,
        p_body: text
      }, 'send_message');

      if (result.error) { Utils.toast('تعذر إرسال الرسالة، حاول مرة أخرى.', 'error'); return; }
      if (result.queued) { Utils.toast('سيتم إرسال الرسالة عند عودة الاتصال.', 'warn'); return; }
      Sounds.message();                     // نغمة خفيفة عند الإرسال
      Utils.toast(toAll ? 'تم إرسال الرسالة إلى جميع الأقسام.' : `تم إرسال الرسالة إلى قسم ${depName}.`, 'info');
    };

    // --- إعادة الرسم ---
    const renderAll = () => {
      // أزرار الأقسام
      depsWrap.innerHTML = '';
      departments.forEach(dep => {
        depsWrap.appendChild(Utils.el('button', {
          class: 'chip' + (this.activeDepartmentId === dep.id ? ' selected' : ''),
          onclick: () => { this.activeDepartmentId = dep.id; renderAll(); }
        }, dep.name));
      });

      // المحادثة
      chatWindow.innerHTML = '';
      if (!this.activeDepartmentId) {
        chatWindow.appendChild(Utils.el('div', { class: 'chat-empty' }, 'اختر قسمًا لعرض محادثته'));
        return;
      }

      const relevant = STATE.messages.filter(m => !m.is_archived && (
        m.from_department_id === this.activeDepartmentId ||
        m.to_department_id === this.activeDepartmentId ||
        m.to_department_id === null
      )).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      if (!relevant.length) {
        chatWindow.appendChild(Utils.el('div', { class: 'chat-empty' }, 'لا توجد رسائل بعد مع هذا القسم.'));
      }

      relevant.forEach(m => {
        const mine = m.from_department_id === STATE.session.department_id;
        const sender = STATE.departments.find(d => d.id === m.from_department_id);
        chatWindow.appendChild(Utils.el('div', { class: `chat-bubble ${mine ? 'mine' : 'theirs'}` }, [
          Utils.el('div', { class: 'chat-bubble__sender' }, mine ? 'الكول سنتر' : (sender ? sender.name : '')),
          Utils.el('div', {}, m.body),
          Utils.el('div', { class: 'chat-bubble__meta' }, Utils.formatClock(new Date(m.created_at)))
        ]));
      });
      chatWindow.scrollTop = chatWindow.scrollHeight;
      Utils.refreshIcons();
    };

    renderAll();

    // تحديث لحظي أثناء فتح النافذة
    if (this._rerender) document.removeEventListener('data:messages-changed', this._rerender);
    this._rerender = renderAll;
    document.addEventListener('data:messages-changed', this._rerender);

    Modal.open({
      title: 'مراسلة الأقسام',
      large: true,
      bodyNode: body,
      actions: [{
        label: 'إغلاق', className: 'btn-secondary',
        onClick: () => {
          if (this._rerender) document.removeEventListener('data:messages-changed', this._rerender);
          this._rerender = null;
          Modal.close();
        }
      }]
    });
  },

  confirmArchive() {
    if (!this.activeDepartmentId) { Utils.toast('اختر قسمًا أولًا.', 'error'); return; }
    const depName = STATE.departments.find(d => d.id === this.activeDepartmentId)?.name || '';

    Modal.open({
      title: 'تصفير المحادثة',
      bodyNode: Utils.el('p', { style: 'line-height:1.9;margin:0;' },
        `سيتم إخفاء محادثة قسم ${depName} من الواجهة. الرسائل تبقى محفوظة في النظام ولا تُحذف نهائيًا.`),
      actions: [
        { label: 'إلغاء', className: 'btn-secondary', onClick: () => this.openCallcenterInbox() },
        {
          label: 'نعم، صفّر المحادثة', className: 'btn-danger-solid', onClick: async () => {
            const { error } = await supabaseClient.rpc('archive_conversation', {
              p_session_token: STATE.session.token,
              p_department_id: this.activeDepartmentId
            });
            if (error) { Utils.toast('تعذر تصفير المحادثة.', 'error'); return; }
            await Sync.loadInitialData();
            Utils.toast(`تم تصفير محادثة قسم ${depName}.`, 'success');
            this.openCallcenterInbox();
          }
        }
      ]
    });
  }
};
