// CNH Simples - Engine v5 (Dual Timers: Progressive + Regressive, Cross-Device Sync, Brazilian Traffic Palette & SFX)

(function () {
  'use strict';

  const STORAGE_KEY_STATS = 'cnh_stats_v4';
  const STORAGE_KEY_SESSION = 'cnh_active_session_v4';
  const STORAGE_KEY_DIFFICULTY = 'cnh_user_difficulty_v4';
  const STORAGE_KEY_ACHIEVEMENTS = 'cnh_achievements_v4';
  const STORAGE_KEY_MASTERED = 'cnh_mastered_qs_v4';
  const STORAGE_KEY_ONLY_UNMASTERED = 'cnh_only_unmastered_v4';

  const state = {
    questions: window.QUESTIONS_DATABASE || [],
    plates: window.PLATES_DATABASE || {},
    selectedSize: 20,
    onlyUnmastered: true,
    userStats: {
      streak: 1,
      xp: 0,
      level: 1,
      totalAnswered: 0,
      totalCorrect: 0,
      sessionsCompleted: 0,
      categoryStats: {
        sinalizacao: { totalAttempts: 0, correctAttempts: 0 },
        infracoes: { totalAttempts: 0, correctAttempts: 0 },
        defensiva: { totalAttempts: 0, correctAttempts: 0 },
        socorros_mecanica_meioambiente: { totalAttempts: 0, correctAttempts: 0 }
      }
    },
    userDifficulty: {},
    masteredQuestionIds: [],
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

  // Sounds
  const soundfx = {
    playCorrect() {
      if (window.trafficAudio) window.trafficAudio.playCarHorn();
    },
    playWrong() {
      if (window.trafficAudio) window.trafficAudio.playBrakeScreech();
    },
    playStart() {
      if (window.trafficAudio) window.trafficAudio.playEngineStart();
    }
  };

  function loadPersisted() {
    try {
      // 1. Tenta carregar v4, com fallback transparente para v3
      let stats = localStorage.getItem(STORAGE_KEY_STATS);
      if (!stats) stats = localStorage.getItem('cnh_stats_v3');
      if (stats) state.userStats = { ...state.userStats, ...JSON.parse(stats) };

      if (!state.userStats.categoryStats) {
        state.userStats.categoryStats = {
          sinalizacao: { totalAttempts: 0, correctAttempts: 0 },
          infracoes: { totalAttempts: 0, correctAttempts: 0 },
          defensiva: { totalAttempts: 0, correctAttempts: 0 },
          socorros_mecanica_meioambiente: { totalAttempts: 0, correctAttempts: 0 }
        };
      }

      let diff = localStorage.getItem(STORAGE_KEY_DIFFICULTY);
      if (!diff) diff = localStorage.getItem('cnh_user_difficulty_v3');
      if (diff) state.userDifficulty = JSON.parse(diff);

      let ach = localStorage.getItem(STORAGE_KEY_ACHIEVEMENTS);
      if (!ach) ach = localStorage.getItem('cnh_achievements_v3');
      if (ach) state.achievements = JSON.parse(ach);

      const mastered = localStorage.getItem(STORAGE_KEY_MASTERED);
      if (mastered) {
        state.masteredQuestionIds = JSON.parse(mastered);
      } else {
        state.masteredQuestionIds = [];
      }

      // MIGRAÇÃO / RECONSTITUIÇÃO INTELIGENTE DO HISTÓRICO:
      reconstitutePastProgress();

      const unmasteredPref = localStorage.getItem(STORAGE_KEY_ONLY_UNMASTERED);
      if (unmasteredPref !== null) {
        state.onlyUnmastered = JSON.parse(unmasteredPref);
      }

      let sess = localStorage.getItem(STORAGE_KEY_SESSION);
      if (!sess) sess = localStorage.getItem('cnh_active_session_v3');
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
      localStorage.setItem(STORAGE_KEY_MASTERED, JSON.stringify(state.masteredQuestionIds));
      localStorage.setItem(STORAGE_KEY_ONLY_UNMASTERED, JSON.stringify(state.onlyUnmastered));
      if (state.session) {
        localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(state.session));
      } else {
        localStorage.removeItem(STORAGE_KEY_SESSION);
      }
    } catch (e) {
      console.warn('Persistence save error:', e);
    }
  }

  // Reconstrói o progresso por módulo caso o usuário venha de versões anteriores
  function reconstitutePastProgress() {
    const totalCorrect = state.userStats.totalCorrect || 0;
    const totalAnswered = state.userStats.totalAnswered || 0;
    const answeredFromDiff = Object.keys(state.userDifficulty || {}).map(k => parseInt(k, 10));

    // Se a lista de mastered estiver vazia mas houver acertos ou questões praticadas:
    if (state.masteredQuestionIds.length === 0 && (totalCorrect > 0 || totalAnswered > 0 || answeredFromDiff.length > 0)) {
      const qById = {};
      state.questions.forEach(q => { qById[q.id] = q; });

      // 1. As questões que estão com falha zerada (resolvidas/aprendidas) são consideradas acertadas
      const recoveredSet = new Set();
      answeredFromDiff.forEach(qid => {
        if ((state.userDifficulty[qid] || 0) === 0) {
          recoveredSet.add(qid);
        }
      });

      // 2. Se o totalCorrect for maior que o número recuperado acima, pegamos as primeiras questões
      // que o app costumava servir nos treinos para preencher os acertos que o usuário realizou
      let needed = Math.max(0, totalCorrect - recoveredSet.size);
      if (needed > 0) {
        for (let i = 0; i < state.questions.length && needed > 0; i++) {
          const qid = state.questions[i].id;
          if (!recoveredSet.has(qid) && (!state.userDifficulty[qid] || state.userDifficulty[qid] === 0)) {
            recoveredSet.add(qid);
            needed--;
          }
        }
      }

      state.masteredQuestionIds = Array.from(recoveredSet);

      // Recompõe também a distribuição proporcional nos categoryStats
      if (!state.userStats.categoryStats || 
          (state.userStats.categoryStats.sinalizacao.totalAttempts === 0 &&
           state.userStats.categoryStats.infracoes.totalAttempts === 0 &&
           state.userStats.categoryStats.defensiva.totalAttempts === 0 &&
           state.userStats.categoryStats.socorros_mecanica_meioambiente.totalAttempts === 0)) {
        
        state.userStats.categoryStats = {
          sinalizacao: { totalAttempts: 0, correctAttempts: 0 },
          infracoes: { totalAttempts: 0, correctAttempts: 0 },
          defensiva: { totalAttempts: 0, correctAttempts: 0 },
          socorros_mecanica_meioambiente: { totalAttempts: 0, correctAttempts: 0 }
        };

        state.masteredQuestionIds.forEach(qid => {
          const q = qById[qid];
          if (q && state.userStats.categoryStats[q.category]) {
            state.userStats.categoryStats[q.category].correctAttempts++;
            state.userStats.categoryStats[q.category].totalAttempts++;
          }
        });

        // Adiciona os erros registrados nas categorias corretas
        Object.entries(state.userDifficulty || {}).forEach(([qidStr, fails]) => {
          const qid = parseInt(qidStr, 10);
          const q = qById[qid];
          if (q && fails > 0 && state.userStats.categoryStats[q.category]) {
            state.userStats.categoryStats[q.category].totalAttempts += fails;
          }
        });
      }

      savePersisted();
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

  function renderModuleProgress() {
    const modules = [
      { id: 1, key: 'sinalizacao', total: 411 },
      { id: 2, key: 'infracoes', total: 205 },
      { id: 3, key: 'defensiva', total: 623 },
      { id: 4, key: 'socorros_mecanica_meioambiente', total: 261 }
    ];

    const masteredSet = new Set(state.masteredQuestionIds || []);

    modules.forEach(m => {
      // Questions mastered in this module
      const modQs = state.questions.filter(q => q.category === m.key);
      const totalCount = modQs.length || m.total;
      const masteredInMod = modQs.filter(q => masteredSet.has(q.id)).length;
      
      const pctDone = Math.min(100, Math.round((masteredInMod / totalCount) * 100));
      const pctRemaining = 100 - pctDone;

      const catStats = (state.userStats.categoryStats && state.userStats.categoryStats[m.key]) || { totalAttempts: 0, correctAttempts: 0 };
      const pctAcc = catStats.totalAttempts > 0 
        ? Math.round((catStats.correctAttempts / catStats.totalAttempts) * 100) 
        : 0;

      const accEl = document.getElementById(`mod${m.id}-acc`);
      const doneEl = document.getElementById(`mod${m.id}-done`);
      const barDone = document.getElementById(`mod${m.id}-bar-done`);
      const barAcc = document.getElementById(`mod${m.id}-bar-acc`);

      if (accEl) accEl.textContent = `${pctAcc}% acerto`;
      if (doneEl) {
        doneEl.textContent = pctRemaining === 0 ? '🏆 Fechado!' : `Falta ${pctRemaining}% (${totalCount - masteredInMod} q.)`;
        doneEl.style.color = pctRemaining === 0 ? 'var(--brazil-green)' : 'var(--brazil-yellow)';
      }
      if (barDone) barDone.style.width = `${pctDone}%`;
      if (barAcc) barAcc.style.width = `${pctAcc}%`;
    });

    const chk = document.getElementById('chk-only-unmastered');
    if (chk) chk.checked = !!state.onlyUnmastered;
  }

  function toggleOnlyUnmastered() {
    state.onlyUnmastered = !state.onlyUnmastered;
    const chk = document.getElementById('chk-only-unmastered');
    if (chk) chk.checked = state.onlyUnmastered;
    savePersisted();
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

  // DUAL TIMERS: Progressive (tempo decorrido) + Regressive (tempo restante oficial)
  function startTimer() {
    stopTimer();
    state.timerInterval = setInterval(() => {
      if (!state.session || state.session.completed) return;
      state.session.timerSeconds++;
      if (state.session.remainingSeconds > 0) {
        state.session.remainingSeconds--;
      }
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
    
    // 1. Progressive Timer (Elapsed)
    const s = state.session.timerSeconds || 0;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const elapsedTxt = `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;

    // 2. Regressive Timer (Countdown)
    const rem = Math.max(0, state.session.remainingSeconds || 0);
    const remM = Math.floor(rem / 60);
    const remSec = rem % 60;
    const remTxt = `${remM.toString().padStart(2, '0')}:${remSec.toString().padStart(2, '0')}`;

    const timerProgEl = document.getElementById('timer-prog');
    if (timerProgEl) timerProgEl.textContent = elapsedTxt;

    const timerRegrEl = document.getElementById('timer-regr');
    if (timerRegrEl) timerRegrEl.textContent = remTxt;
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

    const masteredSet = new Set(state.masteredQuestionIds || []);

    // Filter or deprioritize already mastered questions if user opted to skip them
    let candidatePool = pool;
    if (state.onlyUnmastered) {
      const unmastered = pool.filter(q => !masteredSet.has(q.id) || (state.userDifficulty[q.id] || 0) > 0);
      if (unmastered.length >= size) {
        candidatePool = unmastered;
      } else if (unmastered.length > 0) {
        // Use all unmastered first, then fill remainder with least recently seen
        candidatePool = pool;
      }
    }

    // Deduplication within the session: avoid picking questions with identical answers or questions in the same run
    const scoredPool = candidatePool.map(q => {
      let priorityScore = q.weight || 1;
      const isMastered = masteredSet.has(q.id);
      const userFails = state.userDifficulty[q.id] || 0;

      // Heavy priority to questions user got wrong previously
      if (userFails > 0) priorityScore += userFails * 15;

      // If user hasn't mastered this question yet, prioritize it heavily
      if (!isMastered) priorityScore += 20;
      else priorityScore -= 10; // De-prioritize already mastered questions

      return { question: q, score: priorityScore + (Math.random() * 5) };
    });

    scoredPool.sort((a, b) => b.score - a.score);

    // Pick unique questions and ensure varied concepts in one session
    const selected = [];
    const seenAnswers = new Set();

    for (const item of scoredPool) {
      if (selected.length >= size) break;
      const q = item.question;
      const normAns = (q.correct || '').toLowerCase().trim();
      
      // If answer is short generic like "Gravíssima." or "O veículo que vem pela direita.", allow only 1 per session
      if (seenAnswers.has(normAns) && normAns.length < 50 && scoredPool.length > size * 2) {
        continue;
      }
      seenAnswers.add(normAns);
      selected.push(q);
    }

    // If needed to reach requested size, fill remainder
    if (selected.length < size) {
      for (const item of scoredPool) {
        if (selected.length >= size) break;
        if (!selected.includes(item.question)) {
          selected.push(item.question);
        }
      }
    }

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
      renderModuleProgress();
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

    // Initial countdown based on question count (10 qs = 15m, 20 qs = 30m, 30 qs = 50m oficial Detran)
    const defaultCountdown = state.selectedSize === 10 ? 15 * 60 : (state.selectedSize === 20 ? 30 * 60 : 50 * 60);

    state.session = {
      title: title || `Treino (${state.selectedSize} questões)`,
      queue: queue,
      currentIndex: 0,
      totalInitial: queue.length,
      correctCount: 0,
      mistakesCount: 0,
      timerSeconds: 0,
      remainingSeconds: defaultCountdown,
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

    // Track category statistics
    const cat = q.category || 'sinalizacao';
    if (!state.userStats.categoryStats) {
      state.userStats.categoryStats = {
        sinalizacao: { totalAttempts: 0, correctAttempts: 0 },
        infracoes: { totalAttempts: 0, correctAttempts: 0 },
        defensiva: { totalAttempts: 0, correctAttempts: 0 },
        socorros_mecanica_meioambiente: { totalAttempts: 0, correctAttempts: 0 }
      };
    }
    if (!state.userStats.categoryStats[cat]) {
      state.userStats.categoryStats[cat] = { totalAttempts: 0, correctAttempts: 0 };
    }
    state.userStats.categoryStats[cat].totalAttempts++;

    if (isCorrect) {
      state.userStats.totalCorrect++;
      state.userStats.categoryStats[cat].correctAttempts++;
      sess.correctCount++;
      sess.consecutiveCorrect = (sess.consecutiveCorrect || 0) + 1;
      addXP(10);
      soundfx.playCorrect();

      // Mark as mastered (answered correctly)
      if (!state.masteredQuestionIds.includes(q.id)) {
        state.masteredQuestionIds.push(q.id);
      }

      if (sess.consecutiveCorrect >= 10) checkAchievement('master_10');
      if (q.is_trap) checkAchievement('trap_slayer');

      if (state.userDifficulty[q.id]) {
        state.userDifficulty[q.id] = Math.max(0, state.userDifficulty[q.id] - 1);
      }
    } else {
      sess.mistakesCount++;
      sess.consecutiveCorrect = 0;
      soundfx.playWrong();

      // If answered incorrectly, remove from mastered list so user practices it again
      const mIdx = state.masteredQuestionIds.indexOf(q.id);
      if (mIdx !== -1) {
        state.masteredQuestionIds.splice(mIdx, 1);
      }

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

    // Sync Section
    const syncCodeEl = document.getElementById('user-sync-code');
    if (syncCodeEl && window.cnhSync) {
      syncCodeEl.textContent = window.cnhSync.getUserCode();
    }
  }

  // Cross-device sync actions
  function copySyncPayload() {
    if (!window.cnhSync) return;
    const str = window.cnhSync.exportProgressPayload();
    navigator.clipboard.writeText(str).then(() => {
      alert('Código de progresso copiado! Cole no seu outro aparelho para sincronizar.');
    }).catch(() => {
      prompt('Copie o código abaixo:', str);
    });
  }

  function applySyncPayload() {
    const code = prompt('Cole aqui o código de progresso copiado do seu outro aparelho:');
    if (code && window.cnhSync) {
      const ok = window.cnhSync.importProgressPayload(code);
      if (ok) {
        alert('Progresso sincronizado com sucesso! Recarregando...');
        window.location.reload();
      } else {
        alert('Código inválido ou corrompido.');
      }
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    loadPersisted();
    renderStatsHeader();
    renderModuleProgress();
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
    renderPlacasCatalog,
    toggleOnlyUnmastered,
    copySyncPayload,
    applySyncPayload
  };
})();
