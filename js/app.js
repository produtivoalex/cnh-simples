// CNH Simples - PWA App Core Engine (Offline-First, Zero AI dependency, 100% Deterministic)

(function() {
  'use strict';

  // State Management
  const state = {
    currentView: 'home',
    questions: window.QUESTIONS_DATABASE || [],
    plates: window.PLATES_DATABASE || {},
    stats: {
      totalAnswered: 0,
      totalCorrect: 0,
      simuladosCompleted: 0,
      simuladosPassed: 0,
      moduleProgress: {
        sinalizacao: { total: 0, correct: 0 },
        infracoes: { total: 0, correct: 0 },
        defensiva: { total: 0, correct: 0 },
        socorros_mecanica_meioambiente: { total: 0, correct: 0 }
      }
    },
    errorNotebook: [], // saved wrong question IDs
    
    // Active session
    session: null, // { mode: 'simulado' | 'modulo' | 'erros', questions: [], currentIndex: 0, answers: {}, timerSeconds: 0, intervalId: null }
    
    // Tinder de Placas state
    tinderList: [],
    tinderIndex: 0,
    tinderKnownCount: 0
  };

  // Load Saved State from LocalStorage
  function loadPersistedState() {
    try {
      const savedStats = localStorage.getItem('cnh_stats');
      if (savedStats) state.stats = JSON.parse(savedStats);

      const savedErrors = localStorage.getItem('cnh_errors');
      if (savedErrors) state.errorNotebook = JSON.parse(savedErrors);
    } catch (e) {
      console.warn('Could not read localStorage:', e);
    }
  }

  function savePersistedState() {
    try {
      localStorage.setItem('cnh_stats', JSON.stringify(state.stats));
      localStorage.setItem('cnh_errors', JSON.stringify(state.errorNotebook));
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  }

  // Navigation Controller
  function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) targetView.classList.add('active');

    const targetNav = document.querySelector(`.nav-item[data-view="${viewName}"]`);
    if (targetNav) targetNav.classList.add('active');

    state.currentView = viewName;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (viewName === 'home') renderDashboard();
    if (viewName === 'placas') renderPlacasView();
    if (viewName === 'erros') renderErrosView();
    if (viewName === 'stats') renderStatsView();
  }

  // Dashboard Rendering
  function renderDashboard() {
    const accuracy = state.stats.totalAnswered > 0 
      ? Math.round((state.stats.totalCorrect / state.stats.totalAnswered) * 100) 
      : 0;

    const termometroEl = document.getElementById('stat-termometro');
    if (termometroEl) {
      termometroEl.textContent = `${accuracy}%`;
      termometroEl.style.color = accuracy >= 70 ? '#10B981' : (accuracy >= 50 ? '#F59E0B' : '#EF4444');
    }

    const totalAnsweredEl = document.getElementById('stat-total-resp');
    if (totalAnsweredEl) totalAnsweredEl.textContent = state.stats.totalAnswered;

    const errorCountEl = document.getElementById('dash-error-count');
    if (errorCountEl) errorCountEl.textContent = state.errorNotebook.length;

    // Module Progress Bars
    const modules = [
      { id: 'sinalizacao', bar: 'prog-sinalizacao', text: 'txt-sinalizacao' },
      { id: 'infracoes', bar: 'prog-infracoes', text: 'txt-infracoes' },
      { id: 'defensiva', bar: 'prog-defensiva', text: 'txt-defensiva' },
      { id: 'socorros_mecanica_meioambiente', bar: 'prog-socorros', text: 'txt-socorros' }
    ];

    modules.forEach(m => {
      const data = state.stats.moduleProgress[m.id] || { total: 0, correct: 0 };
      const pct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
      const barEl = document.getElementById(m.bar);
      const txtEl = document.getElementById(m.text);
      if (barEl) barEl.style.width = `${pct}%`;
      if (txtEl) txtEl.textContent = `${pct}% acertos (${data.correct}/${data.total})`;
    });
  }

  // Start Simulado Oficial (30 Questions, Official Detran Distribution)
  // Detran Standard: 12 Legislação/Sinalização, 10 Direção Defensiva, 3 Primeiros Socorros, 3 Meio Ambiente, 2 Mecânica
  function startSimulado() {
    const qs = [...state.questions];
    if (qs.length === 0) return alert('Banco de questões ainda carregando...');

    // Filter by categories
    const catSinal = qs.filter(q => q.category === 'sinalizacao');
    const catInfrac = qs.filter(q => q.category === 'infracoes');
    const catDefens = qs.filter(q => q.category === 'defensiva');
    const catSocorro = qs.filter(q => q.category === 'socorros_mecanica_meioambiente');

    function shuffle(arr) {
      return arr.sort(() => Math.random() - 0.5);
    }

    // Pick 30 questions
    const selected = [
      ...shuffle(catSinal).slice(0, 6),
      ...shuffle(catInfrac).slice(0, 8),
      ...shuffle(catDefens).slice(0, 10),
      ...shuffle(catSocorro).slice(0, 6)
    ];

    setupQuizSession('Simulado Oficial Detran (30 questões)', shuffle(selected), true);
  }

  // Start Practice by Category Module
  function startModuleQuiz(catKey, catTitle) {
    const qs = state.questions.filter(q => q.category === catKey);
    if (qs.length === 0) return alert('Nenhuma questão para este módulo.');

    const shuffled = qs.sort(() => Math.random() - 0.5).slice(0, 20);
    setupQuizSession(catTitle, shuffled, false);
  }

  // Start Error Notebook Quiz
  function startErrorNotebookQuiz() {
    if (state.errorNotebook.length === 0) {
      return alert('Seu Caderno de Erros está vazio! Parabéns ou continue praticando.');
    }

    const wrongIds = new Set(state.errorNotebook);
    const qs = state.questions.filter(q => wrongIds.has(q.id));
    setupQuizSession('Revisão do Caderno de Erros', qs.sort(() => Math.random() - 0.5), false);
  }

  // Setup Quiz Session Engine
  function setupQuizSession(title, questionsList, isOfficialTimed) {
    if (state.session && state.session.intervalId) {
      clearInterval(state.session.intervalId);
    }

    state.session = {
      title,
      questions: questionsList,
      currentIndex: 0,
      answers: {}, // index -> { selectedAlt, isCorrect, options }
      isOfficialTimed,
      timerSeconds: 50 * 60, // 50 minutes for Detran
      intervalId: null
    };

    switchView('quiz');
    const titleEl = document.getElementById('quiz-title');
    if (titleEl) titleEl.textContent = title;

    const timerEl = document.getElementById('quiz-timer');
    if (timerEl) {
      timerEl.style.display = isOfficialTimed ? 'flex' : 'none';
    }

    if (isOfficialTimed) {
      state.session.intervalId = setInterval(() => {
        state.session.timerSeconds--;
        if (state.session.timerSeconds <= 0) {
          clearInterval(state.session.intervalId);
          finishQuiz();
        } else {
          updateTimerDisplay();
        }
      }, 1000);
      updateTimerDisplay();
    }

    renderCurrentQuestion();
  }

  function updateTimerDisplay() {
    const m = Math.floor(state.session.timerSeconds / 60);
    const s = state.session.timerSeconds % 60;
    const timeTxt = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    const timerTextEl = document.getElementById('timer-text');
    if (timerTextEl) timerTextEl.textContent = timeTxt;
  }

  // Render Question
  function renderCurrentQuestion() {
    const s = state.session;
    const q = s.questions[s.currentIndex];
    if (!q) return finishQuiz();

    // Progress bar & counter
    const pct = ((s.currentIndex) / s.questions.length) * 100;
    const bar = document.getElementById('quiz-progress-bar');
    if (bar) bar.style.width = `${pct}%`;

    const qNumEl = document.getElementById('quiz-q-num');
    if (qNumEl) qNumEl.textContent = `Questão ${s.currentIndex + 1} de ${s.questions.length}`;

    // Difficulty badge
    const diffEl = document.getElementById('quiz-diff-badge');
    if (diffEl) {
      diffEl.textContent = q.difficulty || 'Média';
      diffEl.className = 'tag-difficulty';
      if (q.difficulty === 'Fácil') diffEl.classList.add('diff-facil');
      else if (q.difficulty === 'Difícil') diffEl.classList.add('diff-dificil');
      else diffEl.classList.add('diff-inter');
    }

    // Plate Preview Box
    const plateBox = document.getElementById('quiz-plate-box');
    const plateImg = document.getElementById('quiz-plate-img');
    if (q.plate_image || (q.plate_code && state.plates[q.plate_code])) {
      const src = q.plate_image || state.plates[q.plate_code].image;
      plateImg.src = src;
      plateBox.style.display = 'block';
    } else {
      plateBox.style.display = 'none';
    }

    // Question Text
    const qTextEl = document.getElementById('quiz-question-text');
    if (qTextEl) qTextEl.textContent = q.question;

    // Explanation Box (Hidden until answer or shown if already answered)
    const expCard = document.getElementById('quiz-explanation-card');
    const expText = document.getElementById('quiz-exp-text');
    expCard.style.display = 'none';

    // Prepare randomized options if not already cached for this question
    if (!s.answers[s.currentIndex]) {
      const opts = [
        { text: q.correct, isCorrect: true },
        ...(q.incorrect || []).map(inc => ({ text: inc, isCorrect: false }))
      ];
      // Shuffle options deterministically for this run
      opts.sort(() => Math.random() - 0.5);
      s.answers[s.currentIndex] = {
        options: opts,
        selectedIdx: null,
        answered: false
      };
    }

    const currentAnswerState = s.answers[s.currentIndex];
    const letters = ['A', 'B', 'C', 'D'];
    const optsContainer = document.getElementById('quiz-options-list');
    optsContainer.innerHTML = '';

    currentAnswerState.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.innerHTML = `
        <span class="option-letter">${letters[idx]}</span>
        <span class="option-text">${opt.text}</span>
      `;

      if (currentAnswerState.answered) {
        btn.disabled = true;
        if (opt.isCorrect) btn.classList.add('correct');
        if (idx === currentAnswerState.selectedIdx && !opt.isCorrect) {
          btn.classList.add('wrong');
        }
      } else {
        btn.onclick = () => selectOption(idx);
      }

      optsContainer.appendChild(btn);
    });

    if (currentAnswerState.answered) {
      expCard.style.display = 'block';
      expText.textContent = q.explanation || 'Artigo do CTB e Resoluções vigentes do CONTRAN.';
    }

    // Update Action Button
    const nextBtn = document.getElementById('btn-quiz-next');
    if (nextBtn) {
      if (s.currentIndex === s.questions.length - 1) {
        nextBtn.textContent = currentAnswerState.answered ? 'Ver Resultado' : 'Confirmar';
      } else {
        nextBtn.textContent = currentAnswerState.answered ? 'Próxima Questão ➔' : 'Confirmar';
      }
    }
  }

  // Handle Option Selection
  function selectOption(selectedIdx) {
    const s = state.session;
    const ansState = s.answers[s.currentIndex];
    if (ansState.answered) return;

    ansState.selectedIdx = selectedIdx;
    ansState.answered = true;

    const q = s.questions[s.currentIndex];
    const chosen = ansState.options[selectedIdx];
    const isCorrect = chosen.isCorrect;

    // Update global stats
    state.stats.totalAnswered++;
    if (isCorrect) {
      state.stats.totalCorrect++;
      // remove from error notebook if answered correctly
      state.errorNotebook = state.errorNotebook.filter(id => id !== q.id);
    } else {
      // add to error notebook
      if (!state.errorNotebook.includes(q.id)) {
        state.errorNotebook.push(q.id);
      }
    }

    // Category stats
    const cat = q.category || 'defensiva';
    if (!state.stats.moduleProgress[cat]) {
      state.stats.moduleProgress[cat] = { total: 0, correct: 0 };
    }
    state.stats.moduleProgress[cat].total++;
    if (isCorrect) state.stats.moduleProgress[cat].correct++;

    savePersistedState();
    renderCurrentQuestion();
  }

  // Handle Next / Confirm Click
  function handleQuizNext() {
    const s = state.session;
    const ansState = s.answers[s.currentIndex];

    if (!ansState.answered) {
      // prompt user to select an answer
      alert('Selecione uma das alternativas antes de avançar.');
      return;
    }

    if (s.currentIndex < s.questions.length - 1) {
      s.currentIndex++;
      renderCurrentQuestion();
    } else {
      finishQuiz();
    }
  }

  // Finish Quiz and Display Results
  function finishQuiz() {
    const s = state.session;
    if (s.intervalId) clearInterval(s.intervalId);

    let correctCount = 0;
    s.questions.forEach((q, idx) => {
      const a = s.answers[idx];
      if (a && a.selectedIdx !== null && a.options[a.selectedIdx].isCorrect) {
        correctCount++;
      }
    });

    const total = s.questions.length;
    const pct = Math.round((correctCount / total) * 100);
    const passed = pct >= 70; // 70% Detran approval threshold

    if (s.isOfficialTimed) {
      state.stats.simuladosCompleted++;
      if (passed) state.stats.simuladosPassed++;
      savePersistedState();
    }

    document.getElementById('res-badge').innerHTML = passed ? '🎉' : '⚠️';
    document.getElementById('res-badge').className = `result-badge ${passed ? 'passed' : 'failed'}`;
    
    document.getElementById('res-title').textContent = passed 
      ? 'PARABÉNS! VOCÊ FOI APROVADO!' 
      : 'AINDA NÃO FOI DESSA VEZ!';
    
    document.getElementById('res-score').textContent = `${pct}%`;
    document.getElementById('res-score').style.color = passed ? '#10B981' : '#EF4444';

    document.getElementById('res-feedback').textContent = passed
      ? `Você acertou ${correctCount} de ${total} questões (${pct}%). Está apto para gabaritar a prova teórica do Detran!`
      : `Você acertou ${correctCount} de ${total} questões (${pct}%). A nota mínima exigida é 70% (21/30). Revise as questões que errou no Caderno de Erros!`;

    document.getElementById('res-acertos').textContent = `${correctCount}/${total}`;
    document.getElementById('res-erros').textContent = `${total - correctCount}`;

    switchView('result');
  }

  // Tinder de Placas Engine
  function initTinderPlacas() {
    const plateKeys = Object.keys(state.plates);
    if (plateKeys.length === 0) return alert('Nenhuma placa carregada no banco.');

    state.tinderList = plateKeys.map(k => state.plates[k]).sort(() => Math.random() - 0.5);
    state.tinderIndex = 0;
    state.tinderKnownCount = 0;

    switchView('tinder');
    renderTinderCard();
  }

  function renderTinderCard() {
    if (state.tinderIndex >= state.tinderList.length) {
      document.getElementById('tinder-card-body').innerHTML = `
        <div style="text-align: center; padding: 30px;">
          <h2 style="margin-bottom: 10px; color: #10B981;">Fantástico! 🏆</h2>
          <p style="color: var(--text-muted); margin-bottom: 20px;">Você revisou todas as 146 placas do trânsito brasileiro!</p>
          <button class="btn btn-primary" onclick="window.cnhApp.initTinderPlacas()">Reiniciar Treino</button>
        </div>
      `;
      return;
    }

    const p = state.tinderList[state.tinderIndex];
    document.getElementById('tinder-card-body').innerHTML = `
      <img src="${p.image}" class="tinder-plate-img" alt="${p.code}" />
      <span class="tinder-plate-code">${p.code}</span>
      <h3 class="tinder-plate-name">${p.name || 'Placa Oficial'}</h3>
      <span class="tinder-plate-category">${p.category}</span>
    `;

    const countEl = document.getElementById('tinder-counter');
    if (countEl) {
      countEl.textContent = `${state.tinderIndex + 1} / ${state.tinderList.length}`;
    }
  }

  function handleTinderVote(known) {
    const card = document.getElementById('tinder-card-body');
    card.style.transform = known ? 'translateX(60px) rotate(8deg)' : 'translateX(-60px) rotate(-8deg)';
    card.style.opacity = '0';

    if (known) state.tinderKnownCount++;

    setTimeout(() => {
      state.tinderIndex++;
      card.style.transform = 'none';
      card.style.opacity = '1';
      renderTinderCard();
    }, 200);
  }

  // Render Placas Catalog View
  function renderPlacasView(filterCat = 'todas') {
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
      card.className = 'plate-item-card';
      card.innerHTML = `
        <img src="${p.image}" class="plate-item-img" alt="${p.code}" loading="lazy"/>
        <div class="plate-item-code">${p.code}</div>
        <div class="plate-item-title">${p.name || ''}</div>
      `;
      card.onclick = () => {
        alert(`${p.code}: ${p.name}\nCategoria: ${p.category}`);
      };
      grid.appendChild(card);
    });
  }

  // Render Erros View (Caderno de Erros)
  function renderErrosView() {
    const container = document.getElementById('erros-list-container');
    if (!container) return;
    container.innerHTML = '';

    const errorCount = state.errorNotebook.length;
    const badge = document.getElementById('erros-badge-count');
    if (badge) badge.textContent = `${errorCount} questões`;

    if (errorCount === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎯</div>
          <h3>Caderno de Erros Limpo!</h3>
          <p>Você não tem nenhuma questão errada pendente de revisão. Excelente desempenho!</p>
        </div>
      `;
      return;
    }

    const wrongQuestions = state.questions.filter(q => state.errorNotebook.includes(q.id));
    wrongQuestions.forEach(q => {
      const item = document.createElement('div');
      item.className = 'error-item-card';
      item.innerHTML = `
        <div class="error-item-header">
          <span>${q.module}</span>
          <span class="tag-difficulty diff-${q.difficulty.toLowerCase().substring(0, 5)}">${q.difficulty}</span>
        </div>
        <div class="error-item-question">${q.question}</div>
        <div class="error-item-answer"><strong>Gabarito:</strong> ${q.correct}</div>
        <div class="error-item-exp"><strong>Explicação:</strong> ${q.explanation}</div>
      `;
      container.appendChild(item);
    });
  }

  // Render Stats View
  function renderStatsView() {
    const accuracy = state.stats.totalAnswered > 0 
      ? Math.round((state.stats.totalCorrect / state.stats.totalAnswered) * 100) 
      : 0;

    const scoreBig = document.getElementById('stat-big-acc');
    if (scoreBig) scoreBig.textContent = `${accuracy}%`;

    const totalResp = document.getElementById('stat-total-answered');
    if (totalResp) totalResp.textContent = state.stats.totalAnswered;

    const totalSim = document.getElementById('stat-sim-completed');
    if (totalSim) totalSim.textContent = state.stats.simuladosCompleted;

    const totalPassed = document.getElementById('stat-sim-passed');
    if (totalPassed) totalPassed.textContent = state.stats.simuladosPassed;
  }

  // Initialize PWA and App
  window.addEventListener('DOMContentLoaded', () => {
    loadPersistedState();
    renderDashboard();

    // Bottom Navigation bindings
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        switchView(view);
      });
    });

    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('ServiceWorker registered:', reg.scope))
        .catch(err => console.warn('ServiceWorker registration error:', err));
    }

    // PWA Install Prompt Banner
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      const banner = document.getElementById('pwa-install-banner');
      if (banner) banner.style.display = 'flex';

      const btn = document.getElementById('btn-pwa-install');
      if (btn) {
        btn.onclick = () => {
          if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(() => {
              deferredPrompt = null;
              banner.style.display = 'none';
            });
          }
        };
      }
    });
  });

  // Expose global methods for HTML onclick
  window.cnhApp = {
    switchView,
    startSimulado,
    startModuleQuiz,
    startErrorNotebookQuiz,
    handleQuizNext,
    finishQuiz,
    initTinderPlacas,
    handleTinderVote,
    renderPlacasView
  };
})();

