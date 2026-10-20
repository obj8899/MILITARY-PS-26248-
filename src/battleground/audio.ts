// Native Web Audio cues — no files, no licences. Starts only after a user gesture.
export class Sfx {
  private ctx?: AudioContext;
  private master?: GainNode;
  private staticGain?: GainNode;
  muted = true;
  onCaption?: (text: string) => void;

  start() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor(); this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.35; this.master.connect(this.ctx.destination);
    // static bed whose level follows link degradation
    const len = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = this.ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 2600; bp.Q.value = 0.6;
    this.staticGain = this.ctx.createGain(); this.staticGain.gain.value = 0;
    src.connect(bp).connect(this.staticGain).connect(this.master); src.start();
  }
  setMuted(m: boolean) { this.muted = m; if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.35, this.ctx.currentTime, 0.05); }
  setLinkDegradation(q: number) { if (this.staticGain && this.ctx) this.staticGain.gain.setTargetAtTime(Math.max(0, (1 - q) * 0.09), this.ctx.currentTime, 0.2); }

  private cap(t: string) { if (!this.muted) this.onCaption?.(t); }
  private tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.2, when = 0) {
    if (!this.ctx || !this.master) return; const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  squelch() {
    if (!this.ctx || !this.master) return; this.cap("[radio squelch]");
    const len = this.ctx.sampleRate * 0.18, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = this.ctx.createBufferSource(); s.buffer = buf; const bp = this.ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 1.2;
    const g = this.ctx.createGain(); g.gain.value = 0.4; s.connect(bp).connect(g).connect(this.master); s.start();
  }
  flash() { this.cap("[FLASH tone]"); this.tone(880, 0.14, "square", 0.12); this.tone(660, 0.18, "square", 0.12, 0.16); }
  tick() { this.tone(1400, 0.04, "sine", 0.08); }
  ui() { this.tone(520, 0.05, "triangle", 0.06); }
  heartbeat() { this.cap("[low heartbeat]"); this.tone(58, 0.16, "sine", 0.35); this.tone(52, 0.2, "sine", 0.3, 0.2); }
  jam() { this.cap("[static burst]"); this.squelch(); this.tone(120, 0.4, "sawtooth", 0.08); }
  ping() { this.cap("[marker ping]"); this.tone(980, 0.12, "sine", 0.14); this.tone(1470, 0.2, "sine", 0.1, 0.1); }
  drop() { this.cap("[deployment horn]"); this.tone(110, 0.9, "sawtooth", 0.1); }
}
