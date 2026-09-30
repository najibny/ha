// ============================================================================
// نظام الرسائل الداخلي اللحظي بين الأقسام والكول سنتر
// ============================================================================

const Messages = {
  activeDepartmentId: null, // للكول سنتر: أي قسم يتم عرض محادثته الآن

  unreadCount() {
    // تبسيط: لا يوجد حقل "مقروءة" رسمي، نعتبر آخر 3 دقائق "جديدة" لأغراض المؤشر البصري فقط
    return 0;
  },

  openPanel() {
    const kind = STATE.session.department_kind;
    if (kind === 'department') return this.openDepartmentChat();
    return this.openCallcenterInbox();
  },

  /** واجهة مسؤول القسم: محادثة واحدة مع الكول سنتر */
  openDepartmentChat() {
    const myId = STATE.session.department_id;
    const callcenterDept = STATE.departments.find(d => d.kind === 'callcenter');
    const body = Utils.el('div');
    const chatWindow = Utils.el('div', { class: 'chat-window', id: 'chat-window' });
    body.appendChild(chatWindow);

    const inputRow = Utils.el('div', { style: 'display:flex;gap:8px;margin-top:12px;' });
    const input = Utils.el('input', { class: 'form-input', placeholder: 'اكتب رسالتك للكول سنتر...' });
    const sendBtn = Utils.el('button', { class: 'btn btn-primary', html: '<i data-lucide="send" width="18"></i>' });
    inputRow.appendChild(input);
    inputRow.appendChild(sendBtn);
    body.appendChild(inputRow);

    const send = async () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      const result = await Sync.performOrQueue('send_message', {
        p_session_token: STATE.session.token,
        p_to_department_id: callcenterDept ? callcenterDept.id : null, // نرسلها موجهة صراحة لجهة الكول سنتر
        p_body: text
      }, 'send_message');
      if (!result.queued && !result.error) renderMessages();
      if (result.error) Utils.toast('تعذر إرسال الرسالة', 'error');
    };
    sendBtn.addEventListener('click', send);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });

    const renderMessages = () => {
      chatWindow.innerHTML = '';
      const relevant = STATE.messages.filter(m => {
        if (m.is_archived) return false;
        if (m.from_department_id === myId) return true;         // رسائلي أنا
        if (m.to_department_id === myId) return true;            // رد موجّه لي مباشرة
        const sender = STATE.departments.find(d => d.id === m.from_department_id);
        if (m.to_department_id === null && sender && sender.kind === 'callcenter') return true; // بث عام من الكول سنتر لكل الأقسام
        return false;
      }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      if (!relevant.length) {
        chatWindow.appendChild(Utils.el('div', { class: 'empty-state' }, 'لا توجد رسائل بعد'));
      }
      relevant.forEach(m => {
        const mine = m.from_department_id === myId;
        const bubble = Utils.el('div', { class: `chat-bubble ${mine ? 'mine' : 'theirs'}` }, [
          Utils.el('div', {}, m.body),
          Utils.el('div', { class: 'chat-bubble__meta' }, Utils.formatDateTime(m.created_at))
        ]);
        chatWindow.appendChild(bubble);
      });
      chatWindow.scrollTop = chatWindow.scrollHeight;
    };
    renderMessages();
    document.addEventListener('data:messages-changed', renderMessages);

    Modal.open({
      title: 'الرسائل مع الكول سنتر',
      bodyNode: body,
      actions: [{ label: 'إغلاق', className: 'btn-secondary', onClick: () => { document.removeEventListener('data:messages-changed', renderMessages); Modal.close(); } }]
    });
  },

  /** واجهة الكول سنتر: صندوق وارد بكل الأقسام + محادثة لكل قسم */
  openCallcenterInbox() {
    const body = Utils.el('div');
    const depsWrap = Utils.el('div', { class: 'chip-select', style: 'margin-bottom:14px;' });
    const departments = STATE.departments.filter(d => d.kind === 'department' && d.is_active);
    departments.forEach(dep => {
      depsWrap.appendChild(Utils.el('button', {
        class: 'chip' + (this.activeDepartmentId === dep.id ? ' selected' : ''),
        onclick: () => { this.activeDepartmentId = dep.id; renderAll(); }
      }, dep.name));
    });
    body.appendChild(depsWrap);

    const toolbar = Utils.el('div', { style: 'display:flex;gap:8px;margin-bottom:10px;' });
    toolbar.appendChild(Utils.el('button', { class: 'btn btn-secondary btn-sm', onclick: () => this.confirmArchive() }, 'تصفير المحادثة'));
    body.appendChild(toolbar);

    const chatWindow = Utils.el('div', { class: 'chat-window', id: 'cc-chat-window' });
    body.appendChild(chatWindow);

    const inputRow = Utils.el('div', { style: 'display:flex;gap:8px;margin-top:12px;' });
    const input = Utils.el('input', { class: 'form-input', placeholder: 'اكتب ردًا...' });
    const sendToAllBtn = Utils.el('button', { class: 'btn btn-secondary', title: 'إرسال للكل' }, 'للكل');
    const sendBtn = Utils.el('button', { class: 'btn btn-primary', html: '<i data-lucide="send" width="18"></i>' });
    inputRow.appendChild(input);
    inputRow.appendChild(sendToAllBtn);
    inputRow.appendChild(sendBtn);
    body.appendChild(inputRow);

    const send = async (toAll) => {
      const text = input.value.trim();
      if (!text) return;
      if (!toAll && !this.activeDepartmentId) { Utils.toast('اختر قسمًا أولًا', 'error'); return; }
      input.value = '';
      const result = await Sync.performOrQueue('send_message', {
        p_session_token: STATE.session.token,
        p_to_department_id: toAll ? null : this.activeDepartmentId,
        p_body: text
      }, 'send_message');
      if (result.error) Utils.toast('تعذر إرسال الرسالة', 'error');
    };
    sendBtn.addEventListener('click', () => send(false));
    sendToAllBtn.addEventListener('click', () => send(true));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(false); });

    const renderAll = () => {
      depsWrap.querySelectorAll('.chip').forEach((chip, i) => chip.classList.toggle('selected', departments[i].id === this.activeDepartmentId));
      chatWindow.innerHTML = '';
      if (!this.activeDepartmentId) {
        chatWindow.appendChild(Utils.el('div', { class: 'empty-state' }, 'اختر قسمًا لعرض محادثته'));
        return;
      }
      const relevant = STATE.messages.filter(m => !m.is_archived && (
        m.from_department_id === this.activeDepartmentId ||
        m.to_department_id === this.activeDepartmentId ||
        m.to_department_id === null
      )).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      if (!relevant.length) chatWindow.appendChild(Utils.el('div', { class: 'empty-state' }, 'لا توجد رسائل بعد'));
      relevant.forEach(m => {
        const mine = m.from_department_id === STATE.session.department_id;
        const dep = STATE.departments.find(d => d.id === m.from_department_id);
        const bubble = Utils.el('div', { class: `chat-bubble ${mine ? 'mine' : 'theirs'}` }, [
          !mine ? Utils.el('div', { style: 'font-size:0.72rem;font-weight:800;margin-bottom:2px;' }, dep ? dep.name : '') : null,
          Utils.el('div', {}, m.body),
          Utils.el('div', { class: 'chat-bubble__meta' }, Utils.formatDateTime(m.created_at))
        ]);
        chatWindow.appendChild(bubble);
      });
      chatWindow.scrollTop = chatWindow.scrollHeight;
      Utils.refreshIcons();
    };
    renderAll();
    document.addEventListener('data:messages-changed', renderAll);

    Modal.open({
      title: 'رسائل الأقسام',
      large: true,
      bodyNode: body,
      actions: [{ label: 'إغلاق', className: 'btn-secondary', onClick: () => { document.removeEventListener('data:messages-changed', renderAll); Modal.close(); } }]
    });
  },

  confirmArchive() {
    if (!this.activeDepartmentId) { Utils.toast('اختر قسمًا أولًا', 'error'); return; }
    const depName = STATE.departments.find(d => d.id === this.activeDepartmentId)?.name || '';
    Modal.open({
      title: 'تصفير المحادثة',
      bodyNode: Utils.el('p', {}, `سيتم إخفاء محادثة "${depName}" من الواجهة (تبقى محفوظة في النظام ولا تُحذف نهائيًا). هل تريد المتابعة؟`),
      actions: [
        { label: 'إلغاء', className: 'btn-secondary', onClick: () => this.openCallcenterInbox() },
        { label: 'نعم، صفّر المحادثة', className: 'btn-danger', onClick: async () => {
          await supabaseClient.rpc('archive_conversation', { p_session_token: STATE.session.token, p_department_id: this.activeDepartmentId });
          await Sync.loadInitialData();
          Utils.toast('تم تصفير المحادثة', 'success');
          this.openCallcenterInbox();
        } }
      ]
    });
  }
};
