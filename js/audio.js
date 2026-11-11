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

    // 🚗 Trilha Sonora: Deep Urban Drive (Cadenciada, madura, elegante e instigante)
    // Ritmo cadenciado (~92 BPM), pads aveludados, sub-bass encorpado e kick groove suave
    startBgMusic() {
      if (this.isMusicPlaying) return;
      this.init();
      if (!this.ctx) return;

      this.isMusicPlaying = true;
      const ctx = this.ctx;

      // Master gain: volume nítido, encorpado e confortável
      const masterMusicGain = ctx.createGain();
      masterMusicGain.gain.setValueAtTime(0.085, ctx.currentTime);
      masterMusicGain.connect(ctx.destination);
      this.musicGain = masterMusicGain;

      // Harmonia sofisticada e madura em Dó Menor / Mi Bemol (Cm9 -> Abmaj7 -> Bb6 -> Gm7)
      const chordBars = [
        {
          bass: 65.41, // C2
          pad: [130.81, 155.56, 196.00, 293.66], // C3, Eb3, G3, D4 (Cm9)
          accent: 293.66 // D4
        },
        {
          bass: 51.91, // Ab1
          pad: [130.81, 155.56, 207.65, 261.63], // C3, Eb3, Ab3, C4 (Abmaj7)
          accent: 261.63 // C4
        },
        {
          bass: 58.27, // Bb1
          pad: [116.54, 146.83, 174.61, 233.08], // Bb2, D3, F3, Bb3 (Bb6)
          accent: 233.08 // Bb3
        },
        {
          bass: 48.99, // G1
          pad: [98.00, 146.83, 174.61, 220.00],  // G2, D3, F3, A3 (Gm7)
          accent: 196.00 // G3
        }
      ];

      let barIdx = 0;
      let beatInBar = 0;
      const beatDuration = 0.65; // ~92 BPM (Cadência estável, foco e imersão)

      const playGroove = () => {
        if (!this.isMusicPlaying) return;
        const now = ctx.currentTime;
        const currentBar = chordBars[barIdx % chordBars.length];

        // 1. Warm Analog Pad (A cada início de compasso - beat 0)
        if (beatInBar === 0) {
          currentBar.pad.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc.type = 'triangle'; // Macio, não-estridente
            osc.frequency.setValueAtTime(freq, now);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(420 + i * 40, now);

            // Envelope longo e aveludado
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.exponentialRampToValueAtTime(0.14, now + 0.4);
            gain.gain.setValueAtTime(0.11, now + 1.8);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(masterMusicGain);

            osc.start(now);
            osc.stop(now + 2.55);
          });
        }

        // 2. Deep Sub-Bass (Beats 0 e 2 - cadência sólida de direção)
        if (beatInBar === 0 || beatInBar === 2) {
          const bassOsc = ctx.createOscillator();
          const bassGain = ctx.createGain();
          const bassFilter = ctx.createBiquadFilter();

          bassOsc.type = 'sine'; // Sub-bass puro e encorpado
          bassOsc.frequency.setValueAtTime(currentBar.bass, now);

          bassFilter.type = 'lowpass';
          bassFilter.frequency.setValueAtTime(180, now);

          bassGain.gain.setValueAtTime(0.28, now);
          bassGain.gain.exponentialRampToValueAtTime(0.001, now + (beatInBar === 0 ? 0.9 : 0.5));

          bassOsc.connect(bassFilter);
          bassFilter.connect(bassGain);
          bassGain.connect(masterMusicGain);

          bassOsc.start(now);
          bassOsc.stop(now + 1.0);
        }

        // 3. Kick / Batida Acústica Suave (Beat 0 e Beat 2.5)
        if (beatInBar === 0 || beatInBar === 2) {
          const kickOsc = ctx.createOscillator();
          const kickGain = ctx.createGain();

          kickOsc.type = 'sine';
          kickOsc.frequency.setValueAtTime(95, now);
          kickOsc.frequency.exponentialRampToValueAtTime(35, now + 0.12);

          kickGain.gain.setValueAtTime(0.22, now);
          kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

          kickOsc.connect(kickGain);
          kickGain.connect(masterMusicGain);

          kickOsc.start(now);
          kickOsc.stop(now + 0.16);
        }

        // 4. Subtle Shaker / Pincelada de ritmo no contratempo
        if (beatInBar === 1 || beatInBar === 3) {
          const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
          const data = noiseBuffer.getChannelData(0);
          for (let i = 0; i < noiseBuffer.length; i++) {
            data[i] = Math.random() * 2 - 1;
          }
          const noise = ctx.createBufferSource();
          noise.buffer = noiseBuffer;

          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(6000, now);
          filter.Q.setValueAtTime(2.0, now);

          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.04, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

          noise.connect(filter);
          filter.connect(gain);
          gain.connect(masterMusicGain);

          noise.start(now);
          noise.stop(now + 0.06);
        }

        // Avança o compasso (4 tempos por compasso)
        beatInBar = (beatInBar + 1) % 4;
        if (beatInBar === 0) {
          barIdx++;
        }
      };

      playGroove();
      this.musicInterval = setInterval(playGroove, beatDuration * 1000);
    },

    stopBgMusic() {
      this.isMusicPlaying = false;
      if (this.musicInterval) {
        clearInterval(this.musicInterval);
        this.musicInterval = null;
      }
      if (this.musicGain && this.ctx) {
        this.musicGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.4);
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

