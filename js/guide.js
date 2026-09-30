// ============================================================================
// رسالة الترحيب + دليل الاستخدام السريع
// كلاهما عرض فقط: لا اتصال بقاعدة البيانات ولا تأثير على أي منطق خلفي.
// ============================================================================

const WELCOME_HIDDEN_KEY = 'halawany_welcome_hidden';

const Welcome = {
  /** هل اختار المستخدم إخفاء الرسالة نهائيًا على هذا الجهاز؟ */
  isHidden() {
    try { return localStorage.getItem(WELCOME_HIDDEN_KEY) === 'true'; }
    catch { return false; }
  },

  hideForever() {
    try { localStorage.setItem(WELCOME_HIDDEN_KEY, 'true'); } catch { /* تجاهل */ }
  },

  /** تُستدعى بعد الدخول الناجح عند فتح التطبيق */
  maybeShow() {
    if (this.isHidden()) return;
    this.show();
  },

  show() {
    const body = Utils.el('div', { class: 'welcome' });

    body.appendChild(Utils.el('div', { class: 'welcome__head' }, [
      Utils.el('img', { src: 'assets/logo.png', class: 'welcome__logo', alt: 'شعار الحلواني' }),
      Utils.el('h2', { class: 'welcome__title' }, 'أهلًا بكم يا عائلتي الثانية')
    ]));

    const paragraphs = [
      'رغم عودتي إلى سوريا لاستكمال دراستي، بقيت مشاعري وذكرياتي الجميلة مرتبطة بكم وبأيام العمل التي جمعتنا. اشتقت للعمل معكم، ولروح الفريق، وللحرص الذي كان يجمعنا دائمًا على أن تكون خدمة العملاء والعمل اليومي بأفضل صورة.',
      'خلال الفترة الماضية عملت على تطوير هذا النظام لما يقارب شهرين، رغبةً مني في تقديم شيء بسيط لكنه مفيد لكم. إن شاء الله كان هدفي أن يقلّ الجهد والتواصل المتكرر بين الأقسام والكول سنتر، وأن تصبح حالة الأصناف واضحة لحظة بلحظة، ليكون الرد على العملاء أسرع وأدق وأسهل للجميع.',
      'هذا المشروع ليس مجرد تطبيق أو كود برمجي للبيع والربح، بل هو رسالة محبة وتقدير لمكان عملت فيه وشعرت فيه بالانتماء. أتمنى أن يساعدكم في تنظيم العمل، وتخفيف الضغط، وتقليل الجهد والوقت، وتقديم خدمة تليق باسم الحلواني وفريقه.',
      'أتمنى لكم دائمًا النجاح والتوفيق، وأن تبقى روح التعاون والمحبة بينكم هي سر تميزكم.'
    ];
    const text = Utils.el('div', { class: 'welcome__body' });
    paragraphs.forEach(t => text.appendChild(Utils.el('p', {}, t)));
    body.appendChild(text);

    body.appendChild(Utils.el('div', { class: 'welcome__sign' }, [
      Utils.el('span', { class: 'welcome__sign-pre' }, 'بكل المحبة والاحترام،'),
      Utils.el('span', { class: 'welcome__sign-name' }, 'نجيب محمد ياسر عنداني')
    ]));

    Modal.open({
      title: 'رسالة ترحيب',
      bodyNode: body,
      large: true,
      dismissible: false,          // لا تُغلق إلا بخيار واضح من الأزرار
      actions: [
        {
          label: 'عدم إظهار الرسالة مرة أخرى',
          className: 'btn-secondary',
          onClick: () => {
            this.hideForever();
            Modal.close();
            Utils.toast('لن تظهر رسالة الترحيب مرة أخرى على هذا الجهاز.', 'info');
          }
        },
        {
          // إغلاق مؤقت فقط: تظهر الرسالة مجددًا عند فتح التطبيق لاحقًا
          label: 'ابدأ العمل',
          className: 'btn-primary',
          onClick: () => Modal.close()
        }
      ]
    });
  }
};

// ============================================================================
// دليل الاستخدام السريع — يُعرض من أيقونة المساعدة في كل الواجهات
// ============================================================================

const HelpGuide = {
  /** أقسام الدليل؛ لكل قسم مفتاح دور ليُقدَّم للمستخدم المناسب */
  sections: [
    {
      key: 'why',
      icon: 'lightbulb',
      title: 'لماذا نستخدم هذا النظام؟',
      paragraphs: [
        'هذا النظام ليس مجرد قائمة أصناف. هو وسيلة مشتركة تساعد الأقسام والكول سنتر على العمل من نفس المعلومة وفي نفس الوقت.',
        'عندما يحدّث مسؤول القسم حالة صنف، تصل المعلومة فورًا إلى الكول سنتر. بهذا لا يحتاج موظف الكول سنتر إلى الاتصال المتكرر بالأقسام، ولا يحصل العميل على معلومة قديمة أو غير دقيقة.',
        'يساعد النظام على تقليل الأخطاء، تسريع الرد على العملاء، معرفة البدائل عند نفاد الأصناف، وتنظيم العمل في أوقات الضغط.'
      ]
    },
    {
      key: 'department',
      icon: 'package',
      title: 'لمسؤولي الأقسام',
      paragraphs: ['مهمتك هي إبقاء حالة أصناف قسمك محدثة.'],
      bullets: [
        'اختر الصنف الذي تريد تعديل حالته.',
        'اختر <strong>متوفر</strong> عندما يكون الصنف جاهزًا، ثم حدّد الكمية التقريبية.',
        'اختر <strong>منتهي</strong> عند نفاد الصنف. أضف بدائل إن كانت متوفرة لتساعد الكول سنتر على اقتراحها للعميل.',
        'اختر <strong>لاحقًا</strong> عندما يكون الصنف غير جاهز الآن، ثم حدّد المدة المتوقعة حتى يتوفر.',
        'استخدم وضع <strong>ضغط عالٍ</strong> عند وجود تأخير أو كثرة طلبات، ليعرف الكول سنتر أن القسم يحتاج وقتًا إضافيًا.',
        'استخدم صندوق الرسائل لإرسال تنبيه أو معلومة مباشرة للكول سنتر.'
      ],
      footer: 'كل تحديث صحيح منك يساعد الكول سنتر على إعطاء العميل إجابة دقيقة ويمنع الوعود الخاطئة.'
    },
    {
      key: 'callcenter',
      icon: 'headset',
      title: 'للكول سنتر',
      paragraphs: ['شاشتك تعرض حالة الأصناف كما يحدّثها مسؤولو الأقسام في اللحظة نفسها.'],
      bullets: [
        'استخدم البحث للوصول إلى الصنف بسرعة.',
        'الأخضر يعني أن الصنف متوفر.',
        'الأحمر يعني أن الصنف منتهي.',
        'البرتقالي يعني أنه سيتوفر لاحقًا، مع ظهور الوقت المتبقي.',
        'اضغط على الصنف لرؤية الكمية المتوفرة أو البدائل المقترحة أو الوقت المتوقع.',
        'راقب شريط الرسائل للتنبيهات القادمة من الأقسام.',
        'استخدم المحادثة عند الحاجة لطلب توضيح سريع من قسم معيّن.'
      ],
      footer: 'بهذا تستطيع إعطاء العميل إجابة واضحة: ما هو المتوفر الآن، ما البديل المناسب، ومتى قد يصبح الصنف جاهزًا.'
    },
    {
      key: 'admin',
      icon: 'shield-check',
      title: 'للإدارة',
      paragraphs: ['تتيح لك الإدارة رؤية الصورة الكاملة للعمل اليومي.'],
      bullets: [
        'راجع سجل التغييرات لمعرفة ما حدث ومتى.',
        'راقب وضع الأقسام: عادي أو ضغط عالٍ.',
        'استخدم تقرير نهاية اليوم لمعرفة الأصناف التي نفدت مبكرًا أو تكرر تغير حالتها.',
        'استفد من هذه المعلومات لتخطيط الإنتاج والطلبات بشكل أفضل في اليوم التالي.'
      ]
    },
    {
      key: 'notes',
      icon: 'alert-circle',
      title: 'ملاحظات مهمة',
      bullets: [
        'تأكد من ظهور كلمة <strong>متصل</strong> قبل إجراء تحديث مهم.',
        'عند انقطاع الإنترنت، لا تفترض أن التعديل وصل حتى يعود الاتصال ويظهر إشعار الحفظ.',
        'لا تشارك رمز PIN الخاص بقسمك.',
        'استخدم الإجراءات الجماعية مثل «توفير كل الأصناف» أو «إيقاف كل الأصناف» فقط بعد التأكد.',
        'عند وجود مشكلة، تواصل مع الإدارة أو مسؤول النظام.'
      ]
    }
  ],

  /** ترتيب الأقسام بحيث يظهر القسم الخاص بدور المستخدم الحالي أولًا */
  orderedSections() {
    const kind = STATE.session ? STATE.session.department_kind : null;
    // المطور يرى كل شيء، فنقدّم له قسم الإدارة
    const mine = kind === 'developer' ? 'admin' : kind;
    const list = this.sections.slice();
    if (!mine) return list;
    const idx = list.findIndex(sec => sec.key === mine);
    if (idx > 0) {
      const [section] = list.splice(idx, 1);
      list.unshift(section);
    }
    return list;
  },

  open() {
    const mine = STATE.session
      ? (STATE.session.department_kind === 'developer' ? 'admin' : STATE.session.department_kind)
      : null;

    const body = Utils.el('div', { class: 'guide' });

    body.appendChild(Utils.el('p', { class: 'guide__intro' },
      'هذا الدليل يشرح باختصار كيف يعمل النظام وما هو دورك فيه. القسم الخاص بك موضّح في الأعلى، ويمكنك قراءة بقية الأقسام أيضًا.'));

    this.orderedSections().forEach(sec => {
      const isMine = sec.key === mine;
      const block = Utils.el('section', { class: 'guide__section' + (isMine ? ' is-mine' : '') });

      block.appendChild(Utils.el('h3', { class: 'guide__title' }, [
        Utils.el('span', { class: 'guide__icon', html: `<i data-lucide="${sec.icon}" width="17"></i>` }),
        Utils.el('span', {}, sec.title),
        isMine ? Utils.el('span', { class: 'guide__badge' }, 'يخصّك') : null
      ]));

      (sec.paragraphs || []).forEach(t => block.appendChild(Utils.el('p', { class: 'guide__p' }, t)));

      if (sec.bullets && sec.bullets.length) {
        const ul = Utils.el('ul', { class: 'guide__list' });
        sec.bullets.forEach(b => ul.appendChild(Utils.el('li', { html: b })));
        block.appendChild(ul);
      }

      if (sec.footer) block.appendChild(Utils.el('p', { class: 'guide__footer' }, sec.footer));

      body.appendChild(block);
    });

    Modal.open({
      title: 'دليل الاستخدام السريع',
      bodyNode: body,
      large: true,
      actions: [{ label: 'إغلاق', className: 'btn-primary', onClick: () => Modal.close() }]
    });
  }
};
