// ============================================================================
// صفحة مسؤول القسم
// التغييرات هنا واجهة فقط — منطق RPC والتزامن كما هو دون أي تعديل
// ============================================================================

const DepartmentView = {
  countdownTimer: null,
  _chatBound: false,

  render() {
    const main = document.getElementById('app-main');
    if (!main) return;
    main.innerHTML = '';

    const dep = STATE.departments.find(d => d.id === STATE.session.department_id);
    if (!dep) {
      main.appendChild(Utils.el('div', { class: 'empty-state' }, 'تعذر العثور على بيانات القسم'));
      return;
    }

    main.appendChild(this.renderDeptHeader(dep));   // 1) رأس القسم + الإجراءات الجماعية
    main.appendChild(this.renderChatPanel());        // 2) شات دائم مع الكول سنتر

    // 3) البحث + قائمة الأصناف
    const listSection = Utils.el('div');
    listSection.appendChild(Utils.el('div', { class: 'view-header' }, [
      Utils.el('h3', { class: 'view-title' }, 'أصناف القسم'),
      Utils.el('div', { class: 'search-box' }, [
        Utils.el('input', {
          type: 'text', placeholder: 'ابحث عن صنف...', value: STATE.searchTerm || '',
          'aria-label': 'بحث عن صنف',
          oninput: Utils.debounce((e) => { STATE.searchTerm = e.target.value.trim(); this.renderProductList(dep); }, 200)
        }),
        Utils.el('span', { class: 'search-icon', html: '<i data-lucide="search" width="17"></i>' })
      ])
    ]));
    listSection.appendChild(Utils.el('div', { id: 'dept-product-list' }));
    main.appendChild(listSection);

    this.renderProductList(dep);
    this.renderChatMessages();
    this.startCountdownTicker();
    Utils.refreshIcons();
  },

  // ==========================================================================
  // رأس القسم: الاسم، الأيقونة، وضع العمل، حالة الاتصال، الإجراءات الجماعية
  // ==========================================================================
  renderDeptHeader(dep) {
    const box = Utils.el('div', { class: 'dept-header' });

    box.appendChild(Utils.el('div', { class: 'dept-header__id' }, [
      Utils.el('span', { class: 'dept-header__icon', html: `<i data-lucide="${Utils.deptIcon(dep)}" width="24"></i>` }),
      Utils.el('div', {}, [
        Utils.el('div', { class: 'dept-header__name' }, `قسم ${dep.name}`),
        Utils.el('div', { class: 'dept-header__badges' }, [
          Utils.el('span', {
            class: `mode-badge ${dep.work_mode}`,
            html: dep.work_mode === 'high_pressure'
              ? '<i data-lucide="alert-triangle" width="13"></i> ضغط عالٍ'
              : '<i data-lucide="check" width="13"></i> عادي'
          }),
          Utils.el('span', { id: 'dept-conn-chip', class: `conn-badge ${STATE.connection}` }, [
            Utils.el('span', { class: 'conn-dot' }),
            Utils.el('span', { class: 'conn-text' }, this.connectionLabel())
          ])
        ])
      ])
    ]));

    // أدوات: تبديل وضع العمل + إجراءات جماعية بأزرار صغيرة
    const tools = Utils.el('div', { class: 'dept-header__tools' });

    tools.appendChild(Utils.el('div', { class: 'mode-switch', role: 'group', 'aria-label': 'وضع العمل' }, [
      Utils.el('button', {
        class: dep.work_mode === 'normal' ? 'active normal' : '',
        onclick: () => this.setWorkMode('normal', dep)
      }, 'عادي'),
      Utils.el('button', {
        class: dep.work_mode === 'high_pressure' ? 'active high_pressure' : '',
        onclick: () => this.setWorkMode('high_pressure', dep)
      }, 'ضغط عالٍ')
    ]));

    tools.appendChild(Utils.el('button', {
      class: 'btn btn-success btn-sm',
      html: '<i data-lucide="check-circle-2" width="15"></i> توفير الكل',
      onclick: () => this.confirmBulk('available', dep)
    }));
    tools.appendChild(Utils.el('button', {
      class: 'btn btn-danger btn-sm',
      html: '<i data-lucide="x-circle" width="15"></i> إيقاف الكل',
      onclick: () => this.confirmBulk('out_of_stock', dep)
    }));

    box.appendChild(tools);
    return box;
  },

  connectionLabel() {
    if (STATE.connection === 'online') return 'متصل';
    if (STATE.connection === 'reconnecting') return 'إعادة الاتصال';
    return 'غير متصل';
  },

  /** تحديث شارة الاتصال داخل رأس القسم بدون إعادة رسم الصفحة كلها */
  updateConnectionChip() {
    const chip = document.getElementById('dept-conn-chip');
    if (!chip) return;
    chip.classList.remove('online', 'reconnecting', 'offline');
    chip.classList.add(STATE.connection);
    const text = chip.querySelector('.conn-text');
    if (text) text.textContent = this.connectionLabel();
  },

  // ==========================================================================
  // صندوق المحادثة الدائم مع الكول سنتر (بدل زر المحادثة العلوي)
  // ==========================================================================
  renderChatPanel() {
    const panel = Utils.el('div', { class: 'chat-panel' });

    panel.appendChild(Utils.el('div', { class: 'chat-panel__header' }, [
      Utils.el('span', { html: '<i data-lucide="headset" width="17"></i>' }),
      Utils.el('span', {}, 'التواصل مع الكول سنتر')
    ]));

    panel.appendChild(Utils.el('div', { class: 'chat-window', id: 'dept-chat-window' }));

    const input = Utils.el('input', {
      class: 'form-input', id: 'dept-chat-input',
      placeholder: 'اكتب رسالة أو تنبيهًا عاجلًا للكول سنتر...',
      'aria-label': 'نص الرسالة',
      onkeydown: (e) => { if (e.key === 'Enter') this.sendChatMessage(); }
    });
    const sendBtn = Utils.el('button', {
      class: 'chat-send-btn', title: 'إرسال', 'aria-label': 'إرسال الرسالة',
      html: '<i data-lucide="send" width="18"></i>',
      onclick: () => this.sendChatMessage()
    });
    panel.appendChild(Utils.el('div', { class: 'chat-compose' }, [input, sendBtn]));

    // الاشتراك مرة واحدة فقط في تحديث الرسائل اللحظي
    if (!this._chatBound) {
      document.addEventListener('data:messages-changed', () => this.renderChatMessages());
      this._chatBound = true;
    }
    return panel;
  },

  /** الرسائل التي تخص هذا القسم (رسائلي + ما أُرسل لي + البث العام من الكول سنتر) */
  getMyMessages() {
    const myId = STATE.session.department_id;
    return STATE.messages.filter(m => {
      if (m.is_archived) return false;
      if (m.from_department_id === myId) return true;
      if (m.to_department_id === myId) return true;
      const sender = STATE.departments.find(d => d.id === m.from_department_id);
      if (m.to_department_id === null && sender && sender.kind === 'callcenter') return true;
      return false;
    }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  },

  renderChatMessages() {
    const win = document.getElementById('dept-chat-window');
    if (!win) return;
    const myId = STATE.session.department_id;
    win.innerHTML = '';

    const messages = this.getMyMessages();
    if (!messages.length) {
      win.appendChild(Utils.el('div', { class: 'chat-empty' }, 'لا توجد رسائل بعد. اكتب رسالتك للكول سنتر بالأسفل.'));
      return;
    }

    messages.forEach(m => {
      const mine = m.from_department_id === myId;
      const sender = STATE.departments.find(d => d.id === m.from_department_id);
      win.appendChild(Utils.el('div', { class: `chat-bubble ${mine ? 'mine' : 'theirs'}` }, [
        Utils.el('div', { class: 'chat-bubble__sender' }, mine ? 'قسمي' : (sender ? sender.name : 'الكول سنتر')),
        Utils.el('div', {}, m.body),
        Utils.el('div', { class: 'chat-bubble__meta' }, Utils.formatClock(new Date(m.created_at)))
      ]));
    });
    win.scrollTop = win.scrollHeight;
  },

  async sendChatMessage() {
    const input = document.getElementById('dept-chat-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    const callcenter = STATE.departments.find(d => d.kind === 'callcenter');
    input.value = '';

    const result = await Sync.performOrQueue('send_message', {
      p_session_token: STATE.session.token,
      p_to_department_id: callcenter ? callcenter.id : null,
      p_body: text
    }, 'send_message');

    if (result.error) { Utils.toast('تعذر إرسال الرسالة، حاول مرة أخرى.', 'error'); return; }
    if (result.queued) { Utils.toast('سيتم إرسال الرسالة عند عودة الاتصال.', 'warn'); return; }
    Sounds.message();                                     // نغمة خفيفة عند الإرسال
    Utils.toast('تم إرسال الرسالة إلى الكول سنتر.', 'info');
  },

  // ==========================================================================
  // قائمة الأصناف
  // ==========================================================================
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
        Utils.el('div', { html: '<i data-lucide="package-search" width="38"></i>' }),
        Utils.el('p', {}, STATE.searchTerm ? 'لا توجد أصناف مطابقة للبحث' : 'لا توجد أصناف في هذا القسم بعد')
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

    // الاسم + أيقونة الوصف + شارة الحالة
    card.appendChild(Utils.el('div', { class: 'product-card__top' }, [
      Utils.el('div', { class: 'product-card__name' }, [
        Utils.el('span', { class: 'name-text' }, product.name),
        Utils.el('button', {
          class: 'info-btn', title: 'وصف الصنف', 'aria-label': 'وصف الصنف',
          onclick: (e) => { e.stopPropagation(); this.showDescription(e, product); }
        }, '!')
      ]),
      Utils.el('span', {
        class: `status-badge ${status.status}`,
        html: `<i data-lucide="${Utils.statusIcon(status.status)}"></i> ${Utils.statusLabel(status.status)}`
      })
    ]));

    // منطقة معلومات بارتفاع ثابت حتى لا تختلف البطاقات عند تغير الحالة
    const info = Utils.el('div', { class: 'product-card__info' });
    if (status.status === 'available' && status.quantity_level) {
      info.appendChild(Utils.el('div', {}, [
        'الكمية: ', Utils.el('span', { class: 'info-strong' }, Utils.quantityLabel(status.quantity_level))
      ]));
    } else if (status.status === 'coming_soon' && status.available_at) {
      info.appendChild(Utils.el('div', { class: 'countdown', 'data-target': status.available_at }, [
        Utils.el('span', { html: '<i data-lucide="clock" width="13"></i>' }),
        Utils.el('span', { class: 'countdown-value' }, Utils.formatCountdown(status.available_at))
      ]));
    } else if (status.status === 'out_of_stock') {
      const alts = STATE.alternatives.filter(a => a.product_status_id === status.id).length;
      info.appendChild(Utils.el('div', {}, alts ? `تم اقتراح ${alts} بديلًا للكول سنتر` : 'بدون بدائل مقترحة'));
    }
    info.appendChild(Utils.el('div', {}, `آخر تحديث: ${Utils.timeAgo(status.updated_at)}`));
    card.appendChild(info);

    // أزرار الحالات — صغيرة ومتساوية
    card.appendChild(Utils.el('div', { class: 'status-choice-group product-card__actions' }, [
      Utils.el('button', {
        class: 'status-choice' + (status.status === 'available' ? ' selected available' : ''),
        onclick: () => this.chooseAvailable(product, dep)
      }, [Utils.el('span', { html: '<i data-lucide="check-circle-2"></i>' }), 'متوفر']),
      Utils.el('button', {
        class: 'status-choice' + (status.status === 'out_of_stock' ? ' selected out_of_stock' : ''),
        onclick: () => this.chooseOutOfStock(product, dep)
      }, [Utils.el('span', { html: '<i data-lucide="x-circle"></i>' }), 'منتهي']),
      Utils.el('button', {
        class: 'status-choice' + (status.status === 'coming_soon' ? ' selected coming_soon' : ''),
        onclick: () => this.chooseComingSoon(product, dep)
      }, [Utils.el('span', { html: '<i data-lucide="clock"></i>' }), 'لاحقًا'])
    ]));

    return card;
  },

  showDescription(evt, product) {
    document.querySelectorAll('.tooltip-popover').forEach(n => n.remove());
    const pop = Utils.el('div', { class: 'tooltip-popover' }, [
      Utils.el('div', { style: 'font-weight:800;margin-bottom:4px;' }, product.name),
      Utils.el('div', {}, product.description || 'لا يوجد وصف لهذا الصنف')
    ]);
    document.body.appendChild(pop);

    const rect = evt.currentTarget.getBoundingClientRect();
    const right = Math.max(8, Math.min(
      document.documentElement.clientWidth - rect.right,
      document.documentElement.clientWidth - 272
    ));
    pop.style.top = `${rect.bottom + window.scrollY + 6}px`;
    pop.style.right = `${right}px`;

    setTimeout(() => document.addEventListener('click', function handler(e) {
      if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', handler); }
    }), 10);
  },

  // ==========================================================================
  // اختيار الحالات
  // ==========================================================================
  chooseAvailable(product, dep) {
    const wrap = Utils.el('div', { class: 'chip-select', style: 'justify-content:center;' });
    const opts = [
      ['less_5', 'أقل من 5 قطع'],
      ['5_10', 'من 5 إلى 10 قطع'],
      ['more_10', 'أكثر من 10 قطع'],
      ['plenty', 'متوفر بكثرة']
    ];
    opts.forEach(([val, label]) => {
      wrap.appendChild(Utils.el('button', {
        class: 'chip',
        onclick: async () => {
          Modal.close();
          const ok = await this.saveStatus(product, dep, 'available', val);
          if (ok) Utils.toast(`${product.name}: متوفر — ${label}.`, 'success');
        }
      }, label));
    });

    Modal.open({
      title: `كمية "${product.name}" التقديرية`,
      bodyNode: Utils.el('div', {}, [
        Utils.el('p', { class: 'form-hint', style: 'margin-top:0;margin-bottom:14px;' },
          'اختر الكمية التقريبية التي ستظهر لموظفي الكول سنتر.'),
        wrap
      ]),
      actions: [{ label: 'إلغاء', className: 'btn-secondary', onClick: () => Modal.close() }]
    });
  },

  chooseOutOfStock(product, dep) {
    let selectedAlternatives = [];
    let note = '';

    const bodyWrap = Utils.el('div');
    bodyWrap.appendChild(Utils.el('p', { class: 'form-hint', style: 'margin-top:0;' },
      'يمكنك اقتراح بدائل للكول سنتر (اختياري).'));

    const searchInput = Utils.el('input', { class: 'form-input', placeholder: 'ابحث بالاسم أو أول حرفين...' });
    bodyWrap.appendChild(searchInput);

    const suggestionsHost = Utils.el('div', { class: 'chip-select', style: 'margin-top:10px;' });
    bodyWrap.appendChild(suggestionsHost);

    const renderSuggestions = () => {
      suggestionsHost.innerHTML = '';
      const q = searchInput.value.trim().toLowerCase();
      const pool = STATE.products.filter(p => p.is_active && p.id !== product.id);
      const filtered = (q ? pool.filter(p => p.name.toLowerCase().includes(q)) : pool).slice(0, 12);
      if (!filtered.length) {
        suggestionsHost.appendChild(Utils.el('span', { class: 'form-hint' }, 'لا توجد أصناف مطابقة'));
        return;
      }
      filtered.forEach(p => {
        const isSelected = selectedAlternatives.includes(p.id);
        suggestionsHost.appendChild(Utils.el('button', {
          class: 'chip' + (isSelected ? ' selected' : ''),
          onclick: () => {
            selectedAlternatives = isSelected
              ? selectedAlternatives.filter(id => id !== p.id)
              : [...selectedAlternatives, p.id];
            renderSuggestions();
          }
        }, p.name));
      });
    };
    searchInput.addEventListener('input', Utils.debounce(renderSuggestions, 150));
    renderSuggestions();

    bodyWrap.appendChild(Utils.el('textarea', {
      class: 'form-textarea', placeholder: 'ملاحظة قصيرة للكول سنتر (اختياري)',
      style: 'margin-top:10px;', oninput: (e) => { note = e.target.value; }
    }));

    Modal.open({
      title: `تعيين "${product.name}" كمنتهي`,
      bodyNode: bodyWrap,
      actions: [
        {
          label: 'حفظ بدون بدائل', className: 'btn-secondary', onClick: async () => {
            Modal.close();
            const ok = await this.saveStatus(product, dep, 'out_of_stock', null, null, '');
            if (ok) Utils.toast(`${product.name}: تم تعيينه كمنتهي.`, 'error');
          }
        },
        {
          label: 'حفظ مع البدائل', className: 'btn-primary', onClick: async () => {
            Modal.close();
            const ok = await this.saveStatus(product, dep, 'out_of_stock', null, null, note);
            if (!ok) return;
            // إضافة البدائل بعد حفظ الحالة (نفس استدعاء RPC السابق دون تغيير)
            const statusRow = this.getStatus(product.id, dep.id);
            if (statusRow && selectedAlternatives.length) {
              for (const altId of selectedAlternatives) {
                await supabaseClient.rpc('add_product_alternative', {
                  p_session_token: STATE.session.token,
                  p_product_status_id: statusRow.id,
                  p_alternative_product_id: altId
                });
              }
              await Sync.loadInitialData();
              this.render();
            }
            Utils.toast(
              selectedAlternatives.length
                ? `${product.name}: منتهي — تم اقتراح ${selectedAlternatives.length} بديلًا.`
                : `${product.name}: تم تعيينه كمنتهي.`,
              'error'
            );
          }
        }
      ]
    });
  },

  /**
   * "لاحقًا": اختيار مدة بالساعات والدقائق فقط (بدون تاريخ أو يوم).
   * الوقت الفعلي يُحسب ويُحفظ في الخلفية تمامًا كما في المنطق الأصلي.
   */
  chooseComingSoon(product, dep) {
    let hours = 1;
    let minutes = 0;

    const summary = Utils.el('div', { class: 'duration-summary' });
    const hoursValue = Utils.el('span', { class: 'duration-value' }, String(hours));
    const minutesValue = Utils.el('span', { class: 'duration-value' }, String(minutes));

    const updateSummary = () => {
      hoursValue.textContent = String(hours);
      minutesValue.textContent = String(minutes);
      const total = hours * 60 + minutes;
      if (total <= 0) {
        summary.className = 'duration-summary invalid';
        summary.textContent = 'يجب تحديد مدة أكبر من صفر';
      } else {
        summary.className = 'duration-summary';
        summary.textContent = `سيصبح الصنف متوفرًا بعد ${Utils.humanDuration(total)}`;
      }
    };

    const unit = (label, valueNode, getVal, setVal, step, max) =>
      Utils.el('div', { class: 'duration-unit' }, [
        Utils.el('div', { class: 'duration-unit__label' }, label),
        Utils.el('div', { class: 'duration-unit__control' }, [
          Utils.el('button', {
            class: 'duration-step', type: 'button', 'aria-label': `زيادة ${label}`,
            onclick: () => { setVal(Math.min(max, getVal() + step)); updateSummary(); }
          }, '+'),
          valueNode,
          Utils.el('button', {
            class: 'duration-step', type: 'button', 'aria-label': `إنقاص ${label}`,
            onclick: () => { setVal(Math.max(0, getVal() - step)); updateSummary(); }
          }, '−')
        ])
      ]);

    const body = Utils.el('div', {}, [
      Utils.el('p', { class: 'form-hint', style: 'margin-top:0;text-align:center;' },
        'حدد المدة المتبقية حتى توفر الصنف.'),
      Utils.el('div', { class: 'duration-picker' }, [
        unit('ساعات', hoursValue, () => hours, (v) => { hours = v; }, 1, 12),
        unit('دقائق', minutesValue, () => minutes, (v) => { minutes = v; }, 5, 55)
      ]),
      summary
    ]);
    updateSummary();

    Modal.open({
      title: `متى يتوفر "${product.name}"؟`,
      bodyNode: body,
      actions: [
        { label: 'إلغاء', className: 'btn-secondary', onClick: () => Modal.close() },
        {
          label: 'حفظ', className: 'btn-primary', onClick: async () => {
            const total = hours * 60 + minutes;
            if (total <= 0) { Utils.toast('يجب تحديد مدة أكبر من صفر.', 'error'); return; }
            Modal.close();
            const target = new Date(Date.now() + total * 60000).toISOString();
            const ok = await this.saveStatus(product, dep, 'coming_soon', null, target, '');
            if (ok) Utils.toast(`${product.name}: سيصبح متوفرًا بعد ${Utils.humanDuration(total)}.`, 'warn');
          }
        }
      ]
    });
  },

  // ==========================================================================
  // الحفظ (نفس منطق RPC والتعارض السابق دون أي تغيير)
  // ==========================================================================
  async saveStatus(product, dep, status, quantity_level, available_at, note) {
    const existing = this.getStatus(product.id, dep.id);
    const result = await Sync.performOrQueue('update_status', {
      p_session_token: STATE.session.token,
      p_product_id: product.id,
      p_status: status,
      p_quantity_level: quantity_level ?? null,
      p_available_at: available_at || null,
      p_note: note ?? '',
      p_expected_version: existing ? existing.version : null
    }, 'update_product_status');

    if (result.error) {
      if (String(result.error.message || '').includes('CONFLICT')) {
        Utils.toast('تم تغيير حالة هذا الصنف من جهاز آخر، جرى تحديث البيانات.', 'error');
        await Sync.loadInitialData();
        this.render();
      } else {
        Utils.toast('تعذر حفظ التحديث، حاول مرة أخرى.', 'error');
      }
      return false;
    }

    if (result.queued) {
      Utils.toast('أنت غير متصل، سيتم حفظ التحديث عند عودة الاتصال.', 'warn');
      return false;
    }

    Sounds.success();                 // صوت تأكيد لطيف عند نجاح التغيير
    await Sync.loadInitialData();
    this.render();
    return true;
  },

  confirmBulk(status, dep) {
    const count = this.getDeptProducts(dep).length;
    const isDanger = status === 'out_of_stock';

    Modal.open({
      title: isDanger ? 'تأكيد إيقاف كل الأصناف' : 'تأكيد توفير كل الأصناف',
      bodyNode: Utils.el('div', {}, [
        Utils.el('p', { style: 'line-height:1.9;margin-top:0;' },
          `سيتم تطبيق هذا الإجراء على ${count} صنفًا في قسم ${dep.name}.`),
        isDanger
          ? Utils.el('div', { class: 'alert-box pressure' }, 'انتبه: ستظهر كل أصناف القسم كمنتهية لدى الكول سنتر فورًا.')
          : null
      ]),
      actions: [
        { label: 'إلغاء', className: 'btn-secondary', onClick: () => Modal.close() },
        {
          label: isDanger ? 'نعم، أوقف الكل' : 'نعم، وفّر الكل',
          className: isDanger ? 'btn-danger-solid' : 'btn-primary',
          onClick: async () => {
            Modal.close();
            const { error } = await supabaseClient.rpc('bulk_update_department_status', {
              p_session_token: STATE.session.token,
              p_status: status
            });
            if (error) { Utils.toast('تعذر تنفيذ الإجراء الجماعي.', 'error'); return; }
            Sounds.success();
            Utils.toast(
              isDanger ? `تم إيقاف جميع أصناف قسم ${dep.name}.` : `تم توفير جميع أصناف قسم ${dep.name}.`,
              isDanger ? 'error' : 'success'
            );
            await Sync.loadInitialData();
            this.render();
          }
        }
      ]
    });
  },

  async setWorkMode(mode, dep) {
    if (dep.work_mode === mode) return;
    const { error } = await supabaseClient.rpc('set_department_work_mode', {
      p_session_token: STATE.session.token,
      p_work_mode: mode
    });
    if (error) { Utils.toast('تعذر تحديث وضع القسم.', 'error'); return; }
    Utils.toast(
      mode === 'high_pressure'
        ? `تم تحويل قسم ${dep.name} إلى وضع ضغط عالٍ.`
        : `تم إعادة قسم ${dep.name} إلى الوضع العادي.`,
      mode === 'high_pressure' ? 'warn' : 'success'
    );
    await Sync.loadInitialData();
    this.render();
  },

  startCountdownTicker() {
    clearInterval(this.countdownTimer);
    this.countdownTimer = setInterval(() => {
      document.querySelectorAll('#app-main [data-target]').forEach(node => {
        const valueEl = node.querySelector('.countdown-value');
        if (valueEl) valueEl.textContent = Utils.formatCountdown(node.getAttribute('data-target'));
      });
    }, 1000);
  }
};
