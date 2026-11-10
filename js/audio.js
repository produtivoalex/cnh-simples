// CNH Simples - Audio Engine (Realistic Brazilian Traffic SFX via Web Audio API Synthesis)

(function () {
  'use strict';

  const trafficAudio = {
    ctx: null,

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    },

    // 🚗 Buzina Rápida e Suave de Trânsito Brasileiro (Bi-bi amigável de acerto / aprovação)
    playCarHorn() {
      try {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        // Two dual-tone car horn frequencies (F4 and A4)
        [349.23, 440.0].forEach(freq => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now);

          // Dual short friendly beep (Bi-bi!)
          gain.gain.setValueAtTime(0.12, now);
          gain.gain.setValueAtTime(0.01, now + 0.08);
          gain.gain.setValueAtTime(0.12, now + 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

          // Lowpass filter to muffle harsh harmonics like inside a vehicle
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(1400, now);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(now);
          osc.stop(now + 0.25);
        });
      } catch (e) {}
    },

    // 🛑 Frenagem de Pneu no Asfalto (Tire screech sutil de erro / parada brusca)
    playBrakeScreech() {
      try {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        // White noise buffer for asphalt friction
        const bufferSize = this.ctx.sampleRate * 0.28;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        // Bandpass filter to make it sound like rubber skidding on pavement
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1800, now);
        filter.frequency.exponentialRampToValueAtTime(700, now + 0.28);
        filter.Q.setValueAtTime(3.0, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        noise.start(now);
        noise.stop(now + 0.28);
      } catch (e) {}
    },

    // 🚦 Som de Ignição / Aceleração de Motor (Início do Simulado / Treino)
    playEngineStart() {
      try {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(65, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.18);
        osc.frequency.exponentialRampToValueAtTime(95, now + 0.35);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, now);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.38);
      } catch (e) {}
    }
  };

  window.trafficAudio = trafficAudio;
})();
