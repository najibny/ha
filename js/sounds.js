// ============================================================================
// الأصوات — نستخدم Web Audio API لتوليد نغمات قصيرة بدل ملفات صوتية كبيرة
// لا نشغّل أي صوت قبل أول تفاعل من المستخدم (متطلب سياسات المتصفحات)
// ============================================================================

const Sounds = {
  ctx: null,
  unlocked: false,

  unlock() {
    if (this.unlocked) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.unlocked = true;
  },

  _tone(freq, duration, type = 'sine', gainValue = 0.08, delay = 0) {
    if (!STATE.soundEnabled || !this.unlocked || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = gainValue;
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    const start = this.ctx.currentTime + delay;
    osc.start(start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.stop(start + duration);
  },

  /** صوت تأكيد نجاح تحديث الحالة */
  success() {
    this._tone(660, 0.12, 'sine', 0.09);
    this._tone(880, 0.14, 'sine', 0.07, 0.1);
  },

  /** صوت وصول رسالة جديدة */
  message() {
    this._tone(520, 0.1, 'triangle', 0.08);
    this._tone(660, 0.12, 'triangle', 0.08, 0.12);
  },

  /** صوت انتهاء عداد "سيتوفر لاحقًا" */
  timerDone() {
    this._tone(440, 0.15, 'square', 0.06);
    this._tone(587, 0.15, 'square', 0.06, 0.16);
    this._tone(740, 0.2, 'square', 0.06, 0.32);
  },

  toggle() {
    STATE.soundEnabled = !STATE.soundEnabled;
    localStorage.setItem('soundEnabled', String(STATE.soundEnabled));
    return STATE.soundEnabled;
  }
};

// تفعيل الصوت عند أول نقرة/لمسة من المستخدم في أي مكان بالصفحة
['click', 'touchstart'].forEach(evt => {
  window.addEventListener(evt, () => Sounds.unlock(), { once: true, passive: true });
});
