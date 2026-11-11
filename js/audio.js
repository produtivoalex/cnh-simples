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

    // 🏎️ Trilha Sonora Instigante & Motivadora: Synthwave / Retrowave Driving Beat (Eletrizante, ritmada e agradável)
    startBgMusic() {
      if (this.isMusicPlaying) return;
      this.init();
      if (!this.ctx) return;

      this.isMusicPlaying = true;
      const ctx = this.ctx;

      // Master gain: volume audível e presente, mas equilibrado para não incomodar
      const masterMusicGain = ctx.createGain();
      masterMusicGain.gain.setValueAtTime(0.095, ctx.currentTime);
      masterMusicGain.connect(ctx.destination);
      this.musicGain = masterMusicGain;

      // Linha de baixo instigante (Bassline Synthwave) em D Menor / F Maior
      // Notas: D2 (73.42Hz), F2 (87.31Hz), G2 (98.00Hz), A2 (110.00Hz), C3 (130.81Hz), D3 (146.83Hz)
      const bassSequence = [
        73.42, 73.42, 146.83, 73.42,   // D2, D2, D3, D2
        87.31, 87.31, 174.61, 87.31,   // F2, F2, F3, F2
        98.00, 98.00, 196.00, 98.00,   // G2, G2, G3, G2
        110.00, 98.00, 87.31, 73.42    // A2, G2, F2, D2 (drive descendente)
      ];

      // Arpeggio melódico vibrante e futurista
      const leadSequence = [
        293.66, 349.23, 440.00, 523.25, // D4, F4, A4, C5
        349.23, 440.00, 523.25, 587.33, // F4, A4, C5, D5
        392.00, 440.00, 523.25, 659.25, // G4, A4, C5, E5
        440.00, 523.25, 587.33, 440.00  // A4, C5, D5, A4
      ];

      let step = 0;
      const stepDuration = 0.22; // ~136 BPM - Ritmo perfeito de foco e desafio

      const playBeat = () => {
        if (!this.isMusicPlaying) return;
        const now = ctx.currentTime;
        const bassFreq = bassSequence[step % bassSequence.length];
        const leadFreq = leadSequence[step % leadSequence.length];
        step++;

        // 1. Synth Bass (Punch instigante)
        const bassOsc = ctx.createOscillator();
        const bassGain = ctx.createGain();
        const bassFilter = ctx.createBiquadFilter();

        bassOsc.type = 'sawtooth';
        bassOsc.frequency.setValueAtTime(bassFreq, now);

        bassFilter.type = 'lowpass';
        bassFilter.frequency.setValueAtTime(380, now);
        bassFilter.frequency.exponentialRampToValueAtTime(140, now + 0.18);

        bassGain.gain.setValueAtTime(0.24, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);

        bassOsc.connect(bassFilter);
        bassFilter.connect(bassGain);
        bassGain.connect(masterMusicGain);

        bassOsc.start(now);
        bassOsc.stop(now + 0.22);

        // 2. Chords / Lead Synthwave Arp (Aura moderna de videogame)
        if (step % 2 === 0) {
          const leadOsc = ctx.createOscillator();
          const leadGain = ctx.createGain();
          const leadFilter = ctx.createBiquadFilter();

          leadOsc.type = 'triangle';
          leadOsc.frequency.setValueAtTime(leadFreq, now);

          leadFilter.type = 'bandpass';
          leadFilter.frequency.setValueAtTime(1200, now);
          leadFilter.Q.setValueAtTime(1.5, now);

          leadGain.gain.setValueAtTime(0.12, now);
          leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

          leadOsc.connect(leadFilter);
          leadFilter.connect(leadGain);
          leadGain.connect(masterMusicGain);

          leadOsc.start(now);
          leadOsc.stop(now + 0.4);
        }

        // 3. Hi-Hat sutil e ritmado a cada contra-tempo
        if (step % 2 === 1) {
          const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
          const output = noiseBuffer.getChannelData(0);
          for (let i = 0; i < noiseBuffer.length; i++) {
            output[i] = Math.random() * 2 - 1;
          }
          const whiteNoise = ctx.createBufferSource();
          whiteNoise.buffer = noiseBuffer;

          const hatFilter = ctx.createBiquadFilter();
          hatFilter.type = 'highpass';
          hatFilter.frequency.setValueAtTime(7500, now);

          const hatGain = ctx.createGain();
          hatGain.gain.setValueAtTime(0.045, now);
          hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

          whiteNoise.connect(hatFilter);
          hatFilter.connect(hatGain);
          hatGain.connect(masterMusicGain);

          whiteNoise.start(now);
          whiteNoise.stop(now + 0.05);
        }
      };

      playBeat();
      this.musicInterval = setInterval(playBeat, stepDuration * 1000);
    },

    stopBgMusic() {
      this.isMusicPlaying = false;
      if (this.musicInterval) {
        clearInterval(this.musicInterval);
        this.musicInterval = null;
      }
      if (this.musicGain && this.ctx) {
        this.musicGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.3);
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

