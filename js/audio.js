// CNH Simples - Audio Engine (Realistic Brazilian Traffic SFX via Web Audio API Synthesis)

(function () {
  'use strict';

  const trafficAudio = {
    ctx: null,
    isMusicPlaying: false,
    musicInterval: null,
    musicGain: null,

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    },

    // 🎵 Música de Fundo: Lo-Fi Chords relaxantes de direção noturna (suave, calma e baixinha)
    toggleBgMusic() {
      this.init();
      if (!this.ctx) return false;

      if (this.isMusicPlaying) {
        this.stopBgMusic();
        return false;
      } else {
        this.startBgMusic();
        return true;
      }
    },

    startBgMusic() {
      if (this.isMusicPlaying) return;
      this.init();
      if (!this.ctx) return;

      this.isMusicPlaying = true;
      const ctx = this.ctx;

      // Master gain for music: bem baixinha (-24dB aprox) para relaxar sem atrapalhar o raciocínio
      const masterMusicGain = ctx.createGain();
      masterMusicGain.gain.setValueAtTime(0.035, ctx.currentTime);
      masterMusicGain.connect(ctx.destination);
      this.musicGain = masterMusicGain;

      // Progressão harmônica relaxante (Fmaj7 -> Gsus4 -> Em7 -> Am7)
      const chordProgression = [
        [174.61, 220.00, 261.63, 329.63], // F, A, C, E (Fmaj7)
        [196.00, 246.94, 293.66, 392.00], // G, B, D, G (G)
        [164.81, 196.00, 246.94, 329.63], // E, G, B, E (Em7)
        [220.00, 261.63, 329.63, 440.00]  // A, C, E, A (Am7)
      ];

      let chordIdx = 0;

      const playChord = () => {
        if (!this.isMusicPlaying) return;
        const now = ctx.currentTime;
        const chord = chordProgression[chordIdx % chordProgression.length];
        chordIdx++;

        chord.forEach((freq, noteIdx) => {
          const osc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          osc.type = 'sine'; // Som aveludado e macio
          osc.frequency.setValueAtTime(freq, now + noteIdx * 0.08); // Leve arpeggio natural

          // Filtro quente para tirar agudos estidentes
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(480, now);

          // Fade in lento e fade out longo
          noteGain.gain.setValueAtTime(0.001, now);
          noteGain.gain.exponentialRampToValueAtTime(0.3, now + 0.6);
          noteGain.gain.exponentialRampToValueAtTime(0.001, now + 3.4);

          osc.connect(filter);
          filter.connect(noteGain);
          noteGain.connect(masterMusicGain);

          osc.start(now);
          osc.stop(now + 3.5);
        });
      };

      // Toca o primeiro acorde e agenda os seguintes a cada 3.6 segundos
      playChord();
      this.musicInterval = setInterval(playChord, 3600);
    },

    stopBgMusic() {
      this.isMusicPlaying = false;
      if (this.musicInterval) {
        clearInterval(this.musicInterval);
        this.musicInterval = null;
      }
      if (this.musicGain && this.ctx) {
        this.musicGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.5);
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

