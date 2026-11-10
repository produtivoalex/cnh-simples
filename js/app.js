// CNH Simples - Engine v4 (Brazilian Traffic Palette, Traffic Audio SFX, Achievements, Pausable Timer)

(function () {
  'use strict';

  const STORAGE_KEY_STATS = 'cnh_stats_v4';
  const STORAGE_KEY_SESSION = 'cnh_active_session_v4';
  const STORAGE_KEY_DIFFICULTY = 'cnh_user_difficulty_v4';
  const STORAGE_KEY_ACHIEVEMENTS = 'cnh_achievements_v4';

  const state = {
    questions: window.QUESTIONS_DATABASE || [],
    plates: window.PLATES_DATABASE || {},
    selectedSize: 20,
    userStats: {
      streak: 1,
      xp: 0,
      level: 1,
      totalAnswered: 0,
      totalCorrect: 0,
      sessionsCompleted: 0
    },
    userDifficulty: {},
    achievements: [],
    session: null,
    timerInterval: null
  };

  const ACHIEVEMENTS_DEF = [
    { id: 'first_play', title: 'Primeira Partida', desc: 'Completou seu primeiro treino', icon: '🎯', xp: 50 },
    { id: 'streak_3', title: 'Foco Total', desc: 'Manteve 3 dias seguidos de estudo', icon: '🔥', xp: 100 },
    { id: 'master_10', title: 'Gabaritando', desc: 'Acertou 10 questões seguidas', icon: '⚡', xp: 150 },
    { id: 'plates_explorer', title: 'Mestre das Placas', desc: 'Estudou no modo exclusivo de placas', icon: '🛑', xp: 100 },
    { id: 'trap_slayer', title: 'Caçador de Pegadinhas', desc: 'Acertou 15 pegadinhas do Detran', icon: '🛡️', xp: 200 },
    { id: 'speed_demon', title: 'Rápido no Gatilho', desc: 'Completou um treino de 10 questões', icon: '⏱️', xp: 80 }
  ];

  // Sounds (Uses trafficAudio if available, fallback to WebAudio)
  const soundfx = {
    playCorrect() {
      if (window.trafficAudio) {
        window.trafficAudio.playCarHorn();
      }
    },
    playWrong() {
      if (window.trafficAudio) {
        window.trafficAudio.playBrakeScreech();
      }
    },
    playStart() {
      if (window.trafficAudio) {
        window.trafficAudio.playEngineStart();
      }
    }
  };

  function loadPersisted() {
    try {
      const stats = localStorage.getItem(STORAGE_KEY_STATS);
      if (stats) state.userStats = { ...state.userStats, ...JSON.parse(stats) };

      const diff = localStorage.getItem(STORAGE_KEY_DIFFICULTY);
      if (diff) state.userDifficulty = JSON.parse(diff);

      const ach = localStorage.getItem(STORAGE_KEY_ACHIEVEMENTS);
      if (ach) state.achievements = JSON.parse(ach);

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
      localStorage.setItem(STORAGE_KEY_ACHIEVEMENTS, JSON.stringify(state.achievements));
      if (state.session) {
        localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(state.session));
      } else {
        localStorage.removeItem(STORAGE_KEY_SESSION);
      }
    } catch (e) {
      console.warn('Persistence save error:', e);
    }
  }

  function addXP(amount) {
    state.userStats.xp += amount;
    const newLevel = Math.floor(Math.sqrt(state.userStats.xp / 100)) + 1;
    state.userStats.level = newLevel;
    savePersisted();
    renderStatsHeader();
  }

  function checkAchievement(id) {
    if (!state.achievements.includes(id)) {
      state.achievements.push(id);
      const def = ACHIEVEMENTS_DEF.find(a => a.id === id);
      if (def) addXP(def.xp);
      savePersisted();
    }
  }

  function renderStatsHeader() {
    const xpEl = document.getElementById('stat-xp');
    if (xpEl) xpEl.textContent = `${state.userStats.xp} XP`;

    const streakEl = document.getElementById('stat-streak');
    if (streakEl) streakEl.textContent = state.userStats.streak;

    const lvlNum = document.getElementById('level-num');
    if (lvlNum) lvlNum.textContent = state.userStats.level;

    const lvlTitle = document.getElementById('level-title');
    const titles = ['Novato do Asfalto', 'Condutor Consciente', 'Piloto Defensivo', 'Mestre do CTB', 'Gabaritador Detran'];
    const titleIdx = Math.min(titles.length - 1, state.userStats.level - 1);
    if (lvlTitle) lvlTitle.textContent = titles[titleIdx];

    const currentLvlBaseXP = Math.pow(state.userStats.level - 1, 2) * 100;
    const nextLvlXP = Math.pow(state.userStats.level, 2) * 100;
    const xpInLevel = state.userStats.xp - currentLvlBaseXP;
    const needed = nextLvlXP - currentLvlBaseXP;
    const pct = Math.min(100, Math.round((xpInLevel / (needed || 100)) * 100));

    const xpFill = document.getElementById('xp-fill');
    if (xpFill) xpFill.style.width = `${pct}%`;

    const xpText = document.getElementById('xp-text');
    if (xpText) xpText.textContent = `${state.userStats.xp} / ${nextLvlXP} XP`;
  }

  // Timer Management
  function startTimer() {
    stopTimer();
    state.timerInterval = setInterval(() => {
      if (!state.session || state.session.completed) return;
      state.session.timerSeconds++;
      updateTimerDisplay();
      if (state.session.timerSeconds % 5 === 0) savePersisted();
    }, 1000);
  }

  function stopTimer() {
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
    }
  }

  function updateTimerDisplay() {
    if (!state.session) return;
    const s = state.session.timerSeconds || 0;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const timerEl = document.getElementById('quiz-timer');
    if (timerEl) {
      timerEl.textContent = `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopTimer();
      savePersisted();
    } else {
      if (state.session && !state.session.completed && document.getElementById('view-quiz').classList.contains('active')) {
        startTimer();
      }
    }
  });

  function generateSessionQueue(size, filterCategory = null, onlyPlates = false) {
    let pool = [...state.questions];

    if (onlyPlates) {
      pool = pool.filter(q => q.plate_code || q.plate_image || (q.category === 'sinalizacao' && q.question.toLowerCase().includes('placa')));
    } else if (filterCategory) {
      pool = pool.filter(q => q.category === filterCategory);
    }

    const scoredPool = pool.map(q => {
      let priorityScore = q.weight || 1;
      const userFails = state.userDifficulty[q.id] || 0;
      if (userFails > 0) priorityScore += userFails * 10;
      return { question: q, score: priorityScore + (Math.random() * 2) };
    });

    scoredPool.sort((a, b) => b.score - a.score);
    const selected = scoredPool.slice(0, size).map(item => item.question);
    return selected.sort(() => Math.random() - 0.5);
  }

  function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.add('active');

    const targetTab = document.querySelector(`.nav-tab[data-tab="${viewName}"]`);
    if (targetTab) targetTab.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (viewName === 'home') {
      stopTimer();
      checkResumeBanner();
      renderStatsHeader();
    } else if (viewName === 'placas') {
      stopTimer();
      renderPlacasCatalog('todas');
    } else if (viewName === 'conquistas') {
      stopTimer();
      renderMissionsView();
    }
  }

  function checkResumeBanner() {
    const banner = document.getElementById('resume-card');
    if (!banner) return;

    if (state.session && !state.session.completed) {
      const q = state.session.queue;
      const cur = state.session.currentIndex;
      document.getElementById('resume-title').textContent = `${state.session.title}`;
      document.getElementById('resume-desc').textContent = `Questão ${cur + 1} de ${q.length} • Pausado em ${Math.floor(state.session.timerSeconds / 60)}m ${state.session.timerSeconds % 60}s`;
      banner.style.display = 'flex';
    } else {
      banner.style.display = 'none';
    }
  }

  function selectSize(size) {
    state.selectedSize = size;
    document.querySelectorAll('.selector-btn').forEach(b => {
      const bSize = parseInt(b.getAttribute('data-size'), 10);
      if (bSize === size) b.classList.add('active');
      else b.classList.remove('active');
    });
  }

  function startSession(title, filterCategory = null, onlyPlates = false) {
    soundfx.playStart();
    const queue = generateSessionQueue(state.selectedSize, filterCategory, onlyPlates);

    state.session = {
      title: title || `Treino (${state.selectedSize} questões)`,
      queue: queue,
      currentIndex: 0,
      totalInitial: queue.length,
      correctCount: 0,
      mistakesCount: 0,
      timerSeconds: 0,
      completed: false,
      consecutiveCorrect: 0
    };

    savePersisted();
    switchView('quiz');
    startTimer();
    renderQuestion();
  }

  function resumeSession() {
    if (state.session && !state.session.completed) {
      soundfx.playStart();
      switchView('quiz');
      startTimer();
      renderQuestion();
    }
  }

  function renderQuestion() {
    const sess = state.session;
    if (!sess || sess.currentIndex >= sess.queue.length) {
      finishSession();
      return;
    }

    const q = sess.queue[sess.currentIndex];
    const total = sess.queue.length;
    const current = sess.currentIndex + 1;

    const pct = ((current - 1) / total) * 100;
    const bar = document.getElementById('quiz-bar-fill');
    if (bar) bar.style.width = `${pct}%`;

    const counter = document.getElementById('quiz-counter');
    if (counter) counter.textContent = `${current}/${total}`;

    updateTimerDisplay();

    const badgeContainer = document.getElementById('q-badges');
    badgeContainer.innerHTML = '';

    if (q.is_trap) {
      badgeContainer.innerHTML += `<span class="badge-tag badge-trap">🚨 Pegadinha Comum</span>`;
    } else if (q.is_high_freq) {
      badgeContainer.innerHTML += `<span class="badge-tag badge-freq">⭐ Cai Muito na Prova</span>`;
    }

    if ((state.userDifficulty[q.id] || 0) > 0) {
      badgeContainer.innerHTML += `<span class="badge-tag" style="background: rgba(245, 158, 11, 0.2); color: #FBBF24; border: 1px solid rgba(245, 158, 11, 0.4);">🔄 Revisando Erro</span>`;
    }

    badgeContainer.innerHTML += `<span class="badge-tag badge-module">${(q.module || 'Geral').split('-')[0].trim()}</span>`;

    const plateWrapper = document.getElementById('q-plate-wrapper');
    const plateImg = document.getElementById('q-plate-img');
    const imgSrc = q.plate_image || (q.plate_code && state.plates[q.plate_code] ? state.plates[q.plate_code].image : null);

    if (imgSrc) {
      plateImg.src = imgSrc;
      plateWrapper.style.display = 'block';
    } else {
      plateWrapper.style.display = 'none';
    }

    document.getElementById('q-text').textContent = q.question;
    document.getElementById('feedback-box').style.display = 'none';

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

  function selectAnswer(selectedIdx) {
    const sess = state.session;
    const q = sess.queue[sess.currentIndex];
    const opts = q.cachedOptions;
    const chosen = opts[selectedIdx];
    const isCorrect = chosen.isCorrect;

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
      sess.consecutiveCorrect = (sess.consecutiveCorrect || 0) + 1;
      addXP(10);
      soundfx.playCorrect();

      if (sess.consecutiveCorrect >= 10) checkAchievement('master_10');
      if (q.is_trap) checkAchievement('trap_slayer');

      if (state.userDifficulty[q.id]) {
        state.userDifficulty[q.id] = Math.max(0, state.userDifficulty[q.id] - 1);
      }
    } else {
      sess.mistakesCount++;
      sess.consecutiveCorrect = 0;
      soundfx.playWrong();

      state.userDifficulty[q.id] = (state.userDifficulty[q.id] || 0) + 1;

      const cloned = { ...q, cachedOptions: null };
      sess.queue.push(cloned);
    }

    savePersisted();
    showFeedback(isCorrect, q, !isCorrect);
  }

  function showFeedback(isCorrect, q, willRepeat) {
    const fbBox = document.getElementById('feedback-box');
    const fbStatus = document.getElementById('feedback-status');
    const fbExp = document.getElementById('feedback-explanation');
    const fbRepeat = document.getElementById('feedback-repeat-notice');

    fbStatus.className = `feedback-status ${isCorrect ? 'correct' : 'wrong'}`;
    fbStatus.innerHTML = isCorrect ? '🚗 Bi-bi! Resposta Correta! (+10 XP)' : '🛑 Frenagem! Não foi dessa vez!';

    fbExp.innerHTML = `<strong>Fundamentação:</strong> ${q.explanation || 'Conforme as normas do CTB e Resoluções vigentes do CONTRAN.'}`;

    if (willRepeat) {
      fbRepeat.style.display = 'block';
      fbRepeat.textContent = '🔄 Esta questão voltará ao final da rodada para você repetir até acertar!';
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

  function finishSession() {
    stopTimer();
    const sess = state.session;
    sess.completed = true;
    state.userStats.sessionsCompleted++;

    checkAchievement('first_play');
    if (sess.totalInitial === 10) checkAchievement('speed_demon');

    addXP(30);

    const timeSpent = sess.timerSeconds;
    const m = Math.floor(timeSpent / 60);
    const s = timeSpent % 60;
    const timeFormatted = `${m}m ${s}s`;

    state.session = null;
    savePersisted();

    const total = sess.totalInitial;
    const correct = sess.correctCount;
    const pct = Math.round((correct / (correct + sess.mistakesCount)) * 100) || 0;
    const passed = pct >= 70;

    document.getElementById('res-heading').textContent = passed ? 'Gabaritou! 🚗💨' : 'Treino Concluído! 🎯';
    document.getElementById('res-subheading').textContent = passed 
      ? `Você teve ${pct}% de precisão em ${timeFormatted}. Se fizer a prova hoje, está aprovado!`
      : `Você repetiu todas as questões que errou até fixar o conteúdo. Tempo: ${timeFormatted}.`;

    document.getElementById('kpi-acertos').textContent = `${correct}`;
    document.getElementById('kpi-erros').textContent = `${sess.mistakesCount}`;
    document.getElementById('kpi-tempo').textContent = timeFormatted;

    switchView('result');
  }

  function renderPlacasCatalog(filterCat = 'todas') {
    const grid = document.getElementById('plates-catalog-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const list = Object.values(state.plates).filter(p => {
      if (filterCat === 'regulamentacao') return p.code.startsWith('R-');
      if (filterCat === 'advertencia') return p.code.startsWith('A-');
      if (filterCat === 'indicacao') return !p.code.startsWith('R-') && !p.code.startsWith('A-');
      return true;
    });

    list.forEach(p => {
      const card = document.createElement('div');
      card.className = 'plate-card-item';
      card.innerHTML = `
        <img src="${p.image}" class="plate-card-img" alt="${p.code}" loading="lazy"/>
        <div class="plate-card-code">${p.code}</div>
        <div class="plate-card-title">${p.name || ''}</div>
      `;
      card.onclick = () => {
        startSession(`Treino da Placa ${p.code}`, null, false);
      };
      grid.appendChild(card);
    });
  }

  function renderMissionsView() {
    const container = document.getElementById('missions-list');
    if (!container) return;
    container.innerHTML = '';

    ACHIEVEMENTS_DEF.forEach(ach => {
      const isClaimed = state.achievements.includes(ach.id);
      const card = document.createElement('div');
      card.className = `mission-card ${isClaimed ? 'mission-claimed' : ''}`;
      card.innerHTML = `
        <div class="mission-icon">${ach.icon}</div>
        <div class="mission-info">
          <div class="mission-title">${ach.title} ${isClaimed ? '✓' : ''}</div>
          <div class="mission-desc">${ach.desc}</div>
        </div>
        <div class="mission-reward">+${ach.xp} XP</div>
      `;
      container.appendChild(card);
    });
  }

  window.addEventListener('DOMContentLoaded', () => {
    loadPersisted();
    renderStatsHeader();
    checkResumeBanner();

    document.querySelectorAll('.selector-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const size = parseInt(btn.getAttribute('data-size'), 10);
        selectSize(size);
      });
    });

    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        switchView(tabName);
      });
    });
  });

  window.cnhApp = {
    switchView,
    selectSize,
    startSession,
    resumeSession,
    nextQuestion,
    renderPlacasCatalog
  };
})();
