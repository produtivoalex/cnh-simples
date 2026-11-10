// CNH Simples - Engine v2 (Duolingo-inspired, Smart Retry on Errors, Auto-save & Resume)

(function () {
  'use strict';

  const STORAGE_KEY_STATS = 'cnh_stats_v2';
  const STORAGE_KEY_SESSION = 'cnh_active_session_v2';
  const STORAGE_KEY_DIFFICULTY = 'cnh_user_difficulty_v2';

  // State
  const state = {
    questions: window.QUESTIONS_DATABASE || [],
    plates: window.PLATES_DATABASE || {},
    selectedSize: 20, // default 10, 20 or 30
    userStats: {
      streak: 1,
      totalAnswered: 0,
      totalCorrect: 0,
      sessionsCompleted: 0,
      hearts: 5
    },
    // Map of questionId -> failCount
    userDifficulty: {},
    // Current active session
    session: null
  };

  // Sound effects via Web Audio API (Zero external assets needed)
  const soundfx = {
    ctx: null,
    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) this.ctx = new AudioCtx();
      }
    },
    playCorrect() {
      try {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
        
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        
        osc.start(now);
        osc.stop(now + 0.4);
      } catch (e) {}
    },
    playWrong() {
      try {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, now); // A3
        osc.frequency.setValueAtTime(174.61, now + 0.15); // F3
        
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        
        osc.start(now);
        osc.stop(now + 0.35);
      } catch (e) {}
    }
  };

  // Persistence
  function loadPersisted() {
    try {
      const stats = localStorage.getItem(STORAGE_KEY_STATS);
      if (stats) state.userStats = { ...state.userStats, ...JSON.parse(stats) };

      const diff = localStorage.getItem(STORAGE_KEY_DIFFICULTY);
      if (diff) state.userDifficulty = JSON.parse(diff);

      const sess = localStorage.getItem(STORAGE_KEY_SESSION);
      if (sess) state.session = JSON.parse(sess);
    } catch (e) {
      console.warn('Persistence read error:', e);
    }
  }

  function savePersisted() {
    try {
      localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(state.userStats));
      localStorage.setItem(STORAGE_KEY_DIFFICULTY, JSON.stringify(state.userDifficulty));
      if (state.session) {
        localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(state.session));
      } else {
        localStorage.removeItem(STORAGE_KEY_SESSION);
      }
    } catch (e) {
      console.warn('Persistence save error:', e);
    }
  }

  // Smart Question Selector
  // Prioritizes: 1. Previous User Failures, 2. Pegadinhas / Traps, 3. High Frequency Exam questions
  function generateSessionQueue(size, filterCategory = null) {
    let pool = [...state.questions];
    if (filterCategory) {
      pool = pool.filter(q => q.category === filterCategory);
    }

    // Calculate score for each question
    const scoredPool = pool.map(q => {
      let priorityScore = q.weight || 1;
      
      // If user failed this question previously, heavily boost priority so it repeats!
      const userFails = state.userDifficulty[q.id] || 0;
      if (userFails > 0) {
        priorityScore += userFails * 10;
      }
      
      // Add slight randomness for variety
      const randomJitter = Math.random() * 3;

      return {
        question: q,
        score: priorityScore + randomJitter
      };
    });

    // Sort descending by score
    scoredPool.sort((a, b) => b.score - a.score);

    // Pick top items
    const selected = scoredPool.slice(0, size).map(item => item.question);

    // Shuffle the selected so traps and retries are distributed smoothly
    return selected.sort(() => Math.random() - 0.5);
  }

  // Navigation
  function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (viewName === 'home') checkResumeBanner();
  }

  function checkResumeBanner() {
    const banner = document.getElementById('resume-card');
    if (!banner) return;

    if (state.session && !state.session.completed) {
      const q = state.session.queue;
      const cur = state.session.currentIndex;
      document.getElementById('resume-title').textContent = `${state.session.title}`;
      document.getElementById('resume-desc').textContent = `Questão ${cur + 1} de ${q.length} • Salvo automaticamente`;
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }

    // Update streak and hearts
    const streakEl = document.getElementById('stat-streak');
    if (streakEl) streakEl.textContent = state.userStats.streak;
  }

  // Selector Size Choice (10, 20, 30)
  function selectSize(size) {
    state.selectedSize = size;
    document.querySelectorAll('.selector-btn').forEach(b => {
      const bSize = parseInt(b.getAttribute('data-size'), 10);
      if (bSize === size) b.classList.add('active');
      else b.classList.remove('active');
    });
  }

  // Start Session
  function startSession(title, filterCategory = null) {
    const queue = generateSessionQueue(state.selectedSize, filterCategory);

    state.session = {
      title: title || `Treino (${state.selectedSize} questões)`,
      queue: queue,
      currentIndex: 0,
      totalInitial: queue.length,
      correctCount: 0,
      mistakesCount: 0,
      completed: false,
      answeredMap: {} // index -> { selectedIdx, isCorrect }
    };

    savePersisted();
    switchView('quiz');
    renderQuestion();
  }

  // Resume Existing Session
  function resumeSession() {
    if (state.session && !state.session.completed) {
      switchView('quiz');
      renderQuestion();
    }
  }

  // Render Current Question in Game View
  function renderQuestion() {
    const sess = state.session;
    if (!sess || sess.currentIndex >= sess.queue.length) {
      finishSession();
      return;
    }

    const q = sess.queue[sess.currentIndex];
    const total = sess.queue.length;
    const current = sess.currentIndex + 1;

    // Progress Bar
    const pct = ((current - 1) / total) * 100;
    const bar = document.getElementById('quiz-bar-fill');
    if (bar) bar.style.width = `${pct}%`;

    const counter = document.getElementById('quiz-counter');
    if (counter) counter.textContent = `${current}/${total}`;

    // Badges
    const badgeContainer = document.getElementById('q-badges');
    badgeContainer.innerHTML = '';

    if (q.is_trap) {
      badgeContainer.innerHTML += `<span class="badge-tag badge-trap">🚨 Pegadinha Comum</span>`;
    } else if (q.is_high_freq) {
      badgeContainer.innerHTML += `<span class="badge-tag badge-freq">⭐ Cai Muito na Prova</span>`;
    }

    // If this question is being repeated because of a previous error
    if ((state.userDifficulty[q.id] || 0) > 0) {
      badgeContainer.innerHTML += `<span class="badge-tag" style="background: rgba(139, 92, 246, 0.2); color: #A78BFA; border: 1px solid rgba(139, 92, 246, 0.4);">🔄 Revisando Erro</span>`;
    }

    badgeContainer.innerHTML += `<span class="badge-tag badge-module">${q.module.split('-')[0].trim()}</span>`;

    // Plate Image
    const plateWrapper = document.getElementById('q-plate-wrapper');
    const plateImg = document.getElementById('q-plate-img');
    const imgSrc = q.plate_image || (q.plate_code && state.plates[q.plate_code] ? state.plates[q.plate_code].image : null);

    if (imgSrc) {
      plateImg.src = imgSrc;
      plateWrapper.style.display = 'block';
    } else {
      plateWrapper.style.display = 'none';
    }

    // Question Text
    document.getElementById('q-text').textContent = q.question;

    // Hide feedback drawer
    const fbBox = document.getElementById('feedback-box');
    fbBox.style.display = 'none';

    // Prepare Alternatives
    const answersContainer = document.getElementById('answers-stack');
    answersContainer.innerHTML = '';

    if (!q.cachedOptions) {
      const opts = [
        { text: q.correct, isCorrect: true },
        ...(q.incorrect || []).map(inc => ({ text: inc, isCorrect: false }))
      ];
      q.cachedOptions = opts.sort(() => Math.random() - 0.5);
    }

    const letters = ['A', 'B', 'C', 'D'];
    q.cachedOptions.forEach((opt, idx) => {
      const card = document.createElement('div');
      card.className = 'answer-card';
      card.innerHTML = `
        <span class="ans-letter">${letters[idx]}</span>
        <span class="ans-text">${opt.text}</span>
      `;
      card.onclick = () => selectAnswer(idx);
      answersContainer.appendChild(card);
    });
  }

  // User Selects an Answer
  function selectAnswer(selectedIdx) {
    const sess = state.session;
    const q = sess.queue[sess.currentIndex];
    const opts = q.cachedOptions;
    const chosen = opts[selectedIdx];
    const isCorrect = chosen.isCorrect;

    // Disable all options clicks
    const cards = document.querySelectorAll('.answer-card');
    cards.forEach((c, i) => {
      c.style.pointerEvents = 'none';
      if (opts[i].isCorrect) c.classList.add('correct');
      if (i === selectedIdx && !isCorrect) c.classList.add('wrong');
    });

    state.userStats.totalAnswered++;
    if (isCorrect) {
      state.userStats.totalCorrect++;
      sess.correctCount++;
      soundfx.playCorrect();

      // Lower difficulty for this question since user succeeded
      if (state.userDifficulty[q.id]) {
        state.userDifficulty[q.id] = Math.max(0, state.userDifficulty[q.id] - 1);
      }
    } else {
      sess.mistakesCount++;
      soundfx.playWrong();

      // Track failure to repeat!
      state.userDifficulty[q.id] = (state.userDifficulty[q.id] || 0) + 1;

      // GAME MECHANIC: RE-INSERT QUESTION AT THE END UNTIL USER MASTER IT!
      // This guarantees the candidate leaves the round knowing the answer
      const clonedQuestion = { ...q, cachedOptions: null };
      sess.queue.push(clonedQuestion);
    }

    savePersisted();

    // Show Feedback Drawer
    showFeedback(isCorrect, q, !isCorrect);
  }

  function showFeedback(isCorrect, q, willRepeat) {
    const fbBox = document.getElementById('feedback-box');
    const fbStatus = document.getElementById('feedback-status');
    const fbExp = document.getElementById('feedback-explanation');
    const fbRepeat = document.getElementById('feedback-repeat-notice');

    fbStatus.className = `feedback-status ${isCorrect ? 'correct' : 'wrong'}`;
    fbStatus.innerHTML = isCorrect ? '✨ Resposta Correta!' : '❌ Não foi dessa vez!';

    fbExp.innerHTML = `<strong>Fundamentação:</strong> ${q.explanation || 'Conforme as normas do CTB e Resoluções vigentes do CONTRAN.'}`;

    if (willRepeat) {
      fbRepeat.style.display = 'block';
      fbRepeat.textContent = '🔄 Esta questão foi adicionada ao final da fila para você tentar de novo até acertar!';
    } else {
      fbRepeat.style.display = 'none';
    }

    fbBox.style.display = 'block';
    fbBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function nextQuestion() {
    const sess = state.session;
    sess.currentIndex++;
    savePersisted();
    renderQuestion();
  }

  // Finish Session & Show Result
  function finishSession() {
    const sess = state.session;
    sess.completed = true;
    state.userStats.sessionsCompleted++;
    state.session = null; // Clear active session so banner disappears
    savePersisted();

    const total = sess.totalInitial;
    const correct = sess.correctCount;
    const pct = Math.round((correct / (correct + sess.mistakesCount)) * 100) || 0;
    const passed = pct >= 70;

    document.getElementById('res-heading').textContent = passed ? 'Mandou Bem Demais! 🚀' : 'Treino Concluído! 🎯';
    document.getElementById('res-subheading').textContent = passed 
      ? `Você teve ${pct}% de aproveitamento. Mantendo esse ritmo você é aprovado com louvor no Detran!`
      : `Você repetiu até fixar as que errou! A cada treino seu cérebro grava os detalhes do CTB.`;

    document.getElementById('kpi-acertos').textContent = `${correct}`;
    document.getElementById('kpi-erros').textContent = `${sess.mistakesCount}`;
    document.getElementById('kpi-pct').textContent = `${pct}%`;

    switchView('result');
  }

  // Initialize
  window.addEventListener('DOMContentLoaded', () => {
    loadPersisted();
    checkResumeBanner();

    // Size selector buttons
    document.querySelectorAll('.selector-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const size = parseInt(btn.getAttribute('data-size'), 10);
        selectSize(size);
      });
    });
  });

  // Export public API
  window.cnhApp = {
    switchView,
    selectSize,
    startSession,
    resumeSession,
    nextQuestion
  };
})();
