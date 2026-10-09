(() => {
  "use strict";

  const DATA = window.VITAMISSION_DATA;
  const STORAGE_KEY = "vitamission-save-v1";
  const screens = [...document.querySelectorAll(".screen")];
  const dialog = document.querySelector("#vitamin-dialog");
  const textDialog = document.querySelector("#text-dialog");
  const toast = document.querySelector("#toast");
  let toastTimer;
  let diceTimer;
  let audioContext;
  let tutorialStep = 0;
  let save;
  let viewBeforeDialog = "home";

  const emptyRun = () => ({
    active: false,
    position: 0,
    hearts: 5,
    score: 0,
    coins: 0,
    xp: 0,
    correct: 0,
    answered: 0,
    discoveries: [],
    completedTiles: [],
    visitedTiles: [],
    completedZones: [],
    questionIds: [],
    hintedQuestions: [],
    review: [],
    visionBadge: false,
    overloadSeen: false,
    pendingQuestionId: null,
    startedAt: 0,
    gameOver: false
  });

  function readSave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw)       return { version: 1, alias: "", coins: 0, xp: 0, games: 0, best: 0, average: 0, discoveries: [], badges: [], history: [], activeRun: null, sound: false, tutorialSeen: false };
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1) throw new Error("Formato de progreso incompatible.");
      return {
        version: 1,
        alias: typeof parsed.alias === "string" ? parsed.alias.slice(0, 18) : "",
        coins: Number.isFinite(parsed.coins) ? parsed.coins : 0,
        xp: Number.isFinite(parsed.xp) ? parsed.xp : 0,
        games: Number.isFinite(parsed.games) ? parsed.games : 0,
        best: Number.isFinite(parsed.best) ? parsed.best : 0,
        average: Number.isFinite(parsed.average) ? parsed.average : 0,
        discoveries: Array.isArray(parsed.discoveries) ? parsed.discoveries.filter((id) => DATA.vitamins.some((vitamin) => vitamin.id === id)) : [],
        badges: Array.isArray(parsed.badges) ? parsed.badges : [],
        history: Array.isArray(parsed.history) ? parsed.history.slice(0, 30) : [],
        activeRun: parsed.activeRun && typeof parsed.activeRun === "object" ? parsed.activeRun : null,
        sound: Boolean(parsed.sound),
        tutorialSeen: Boolean(parsed.tutorialSeen)
      };
    } catch (error) {
      console.error("No se pudo leer el progreso guardado.", error);
      return { version: 1, alias: "", coins: 0, xp: 0, games: 0, best: 0, average: 0, discoveries: [], badges: [], history: [], activeRun: null, sound: false, loadError: true };
    }
    document.querySelector("#challenge-category").textContent = tile.category;
  }

  save = readSave();
  let run = save.activeRun && save.activeRun.active ? { ...emptyRun(), ...save.activeRun } : emptyRun();

  function persist() {
    save.activeRun = run.active ? run : null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
    } catch (error) {
      console.error("No se pudo guardar el progreso en este dispositivo.", error);
      announce("No se pudo guardar el progreso. Comprueba el espacio disponible o la privacidad del navegador.");
    }
  }

  function announce(message) {
    toast.textContent = message;
    toast.classList.remove("hidden");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.add("hidden"), 3600);
  }

  function goTo(name) {
    screens.forEach((screen) => screen.classList.toggle("hidden", screen.id !== `screen-${name}`));
    document.querySelectorAll(".nav-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.action === name);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (name === "game") renderGame();
    if (name === "learn") renderVitamins();
    if (name === "profile") renderProfile();
    if (name === "ranking") renderRanking();
    if (name === "results") renderResults();
  }

  function setAlias(value) {
    const alias = value.trim().replace(/\s+/g, " ").slice(0, 18);
    save.alias = alias || "Explorador";
    document.querySelector("#player-alias").value = save.alias;
    persist();
    return save.alias;
  }

  function setMascot(state, message, target = "#viti-message") {
    const text = document.querySelector(target);
    if (!text) return;
    text.textContent = message;
    const face = text.parentElement?.querySelector(".viti");
    if (face) {
      face.classList.remove("mood-happy", "mood-thinking", "mood-worried", "mood-motivating", "mood-excited", "mood-surprised");
      face.classList.add(`mood-${state}`);
    }
  }

  function startRun() {
    const alias = setAlias(document.querySelector("#player-alias").value);
    run = { ...emptyRun(), active: true, startedAt: Date.now() };
    setMascot("thinking", `¡Hola, ${alias}! Lanza el dado y te acompaño en tu misión.`);
    document.querySelector("#challenge-body").innerHTML = '<div class="challenge-placeholder"><span>🧭</span><strong>Tu ficha está en la salida</strong><p>Lanza el dado. Cada movimiento activa una pregunta de la categoría de la casilla.</p></div>';
    document.querySelector("#challenge-feedback").classList.add("hidden");
    document.querySelector("#continue-button").classList.add("hidden");
    document.querySelector("#balance-alert").classList.add("hidden");
    document.querySelector("#dice").textContent = "?";
    persist();
    goTo("game");
    if (!save.tutorialSeen) showTutorial();
  }

  const tutorialSteps = [
    ["1 · MUÉVETE POR EL TABLERO", "Lanza el dado virtual. Avanzas de una a tres casillas y el tablero actualiza tu posición. La categoría de esa casilla determina el reto."],
    ["2 · APRENDE CON CADA RESPUESTA", "Un acierto suma experiencia y monedas y puede descubrir una vitamina. Un error muestra la explicación y cuesta un corazón; en retos de deficiencia, dos."],
    ["3 · COMPLETA LA MISIÓN", "Tienes cinco corazones. Llega a la casilla de visión para terminar. Si se agotan, la partida finaliza. Tu avance se guarda en este dispositivo."]
  ];

  function showTutorial() {
    tutorialStep = 0;
    renderTutorial();
    document.querySelector("#tutorial-dialog").showModal();
  }

  function renderTutorial() {
    const [title, text] = tutorialSteps[tutorialStep];
    document.querySelector("#tutorial-content").innerHTML = `<p class="eyebrow"><span class="pulse"></span> TUTORIAL · ${tutorialStep + 1} / ${tutorialSteps.length}</p><h2>${title}</h2><p>${text}</p>`;
    document.querySelector('[data-action="tutorial-next"]').textContent = tutorialStep === tutorialSteps.length - 1 ? "¡A jugar! ↗" : "Siguiente ↗";
  }

  function closeTutorial() {
    save.tutorialSeen = true;
    persist();
    document.querySelector("#tutorial-dialog").close();
  }

  function vitaminById(id) {
    return DATA.vitamins.find((vitamin) => vitamin.id === id);
  }

  function renderBoard() {
    const board = document.querySelector("#game-board");
    const places = [[1, 1], [2, 1], [3, 1], [4, 1], [4, 2], [3, 2], [2, 2], [1, 2], [1, 3], [2, 3], [3, 3], [4, 3], [4, 4]];
    board.innerHTML = '<svg class="board-route" viewBox="0 0 400 400" preserveAspectRatio="none" aria-hidden="true"><path d="M50 50H350V150H50V250H350V350" /></svg>' +
      `<div class="board-tile start-tile ${run.position === 0 ? "current" : "completed"}" style="grid-column:${places[0][0]};grid-row:${places[0][1]}" aria-label="Salida${run.position === 0 ? ", tu posición" : ""}"><span class="tile-number">INICIO</span><span class="tile-icon">🚀</span><span class="tile-label">Salida</span>${run.position === 0 ? `<span class="board-player">${escapeHtml((save.alias || "E").slice(0, 1).toUpperCase())}</span>` : ""}</div>` + DATA.board.map((tile, index) => {
      const position = index + 1;
      const status = run.position === position ? "current" : run.completedTiles.includes(position) ? "completed" : "";
      const player = run.position === position ? `<span class="board-player" aria-label="Tu ficha">${escapeHtml((save.alias || "E").slice(0, 1).toUpperCase())}</span>` : "";
      const [column, row] = places[position];
      return `<div class="board-tile ${status} ${tile.final ? "goal-tile" : ""}" style="grid-column:${column};grid-row:${row}" data-zone="${tile.zone}" aria-label="Casilla ${position}: ${tile.label}${run.position === position ? ", tu posición" : ""}">
        <span class="tile-number">${String(position).padStart(2, "0")}</span><span class="tile-icon">${tile.icon}</span><span class="tile-label">${tile.label}</span>${player}
      </div>`;
    }).join("");
    document.querySelector("#board-progress").textContent = `${run.completedTiles.length} / ${DATA.board.length} CASILLAS`;
  }

  function renderVitals() {
    document.querySelector("#hearts").innerHTML = `${"♥ ".repeat(run.hearts)}<span class="heart-lost">${"♡ ".repeat(5 - run.hearts)}</span>`;
    document.querySelector("#game-score").textContent = run.score;
    document.querySelector("#game-coins").textContent = run.coins;
    document.querySelector("#game-level").textContent = `${Math.floor((save.xp + run.xp) / 250) + 1} · ${save.xp + run.xp}`;
    const discovered = run.discoveries.map(vitaminById).filter(Boolean);
    const lipoCount = discovered.filter((vitamin) => vitamin.type === "liposoluble").length;
    document.querySelector("#lipo-count").textContent = `${lipoCount} / 3`;
    document.querySelector("#lipo-meter").style.width = `${Math.min(100, lipoCount / 3 * 100)}%`;
    if (lipoCount >= 3 && !run.overloadSeen) {
      run.overloadSeen = true;
      document.querySelector("#balance-alert").classList.remove("hidden");
      setMascot("worried", "Recuerda: cada vitamina tiene funciones diferentes. Más no siempre significa mejor.");
      persist();
    }
    const mini = document.querySelector("#mini-collection");
    mini.innerHTML = discovered.length
      ? discovered.slice(0, 8).map((vitamin) => `<button class="mini-vitamin" data-vitamin="${vitamin.id}" aria-label="Ver ${escapeHtml(vitamin.name)}">${vitamin.icon}<span>${vitamin.id}</span></button>`).join("")
      : '<span class="empty-mini">Resuelve retos para descubrir vitaminas.</span>';
  }

  function renderGame() {
    renderBoard();
    renderVitals();
    const roll = document.querySelector("#roll-button");
    roll.disabled = !run.active || run.gameOver || Boolean(document.querySelector("#continue-button").offsetParent);
    document.querySelector("#board-hint").textContent = run.position ? `Ficha en la casilla ${run.position} de ${DATA.board.length}.` : "Tu ficha te espera en la salida.";
    if (run.pendingQuestionId && run.active) {
      renderPendingQuestion(run.pendingQuestionId, run.position);
      roll.disabled = true;
    }
    if (run.gameOver && run.active) finishRun(true);
  }

  function pickQuestion(category) {
    let candidates = DATA.questions.filter((question) => question.category === category && !run.questionIds.includes(question.id));
    if (!candidates.length) candidates = DATA.questions.filter((question) => question.category === category);
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function landOnTile(position) {
    const tile = DATA.board[position - 1];
    run.visitedTiles = [...new Set([...run.visitedTiles, position])];
    document.querySelector("#challenge-category").textContent = tile.category;
    if (tile.category === "BONIFICACIÓN") {
      const before = run.hearts;
      run.hearts = Math.min(5, run.hearts + 1);
      run.coins += 2;
      run.score += 15;
      run.xp += 15;
      run.completedTiles = [...new Set([...run.completedTiles, position])];
      document.querySelector("#challenge-body").innerHTML = `<div class="bonus-card"><span>🎁</span><h3>Casilla de bonificación</h3><p>${before < 5 ? "Recuperaste un corazón." : "Ya tienes todos tus corazones: guardas la recompensa para tu próxima partida."} +2 monedas y +15 XP. Las vidas no superan cinco.</p></div>`;
      setMascot("happy", "¡Un respiro para la expedición! Guarda energía para los retos.");
      document.querySelector("#challenge-feedback").classList.add("hidden");
      document.querySelector("#continue-button").classList.remove("hidden");
      document.querySelector("#continue-button").textContent = "Continuar por el tablero ↗";
      renderGame();
      persist();
      return;
    }
    const question = pickQuestion(tile.category === "VISIÓN" ? "VISIÓN" : tile.category);
    if (!question) {
      announce(`No hay preguntas disponibles para la categoría ${tile.category}.`);
      return;
    }
    run.questionIds.push(question.id);
    run.pendingQuestionId = question.id;
    renderPendingQuestion(question.id, position);
    renderGame();
    persist();
  }

  function renderPendingQuestion(questionId, position) {
    const question = DATA.questions.find((item) => item.id === questionId);
    const tile = DATA.board[position - 1];
    if (!question || !tile) {
      run.pendingQuestionId = null;
      return;
    }
    setMascot("thinking", tile.category === "VISIÓN"
      ? "¡La meta visual está cerca! Piensa en qué nutriente participa directamente en el ciclo visual."
      : "¡Casilla nueva! Lee con atención y elige la respuesta que mejor encaje.");
    document.querySelector("#challenge-body").innerHTML = `
      <div class="question-meta"><span>${question.difficulty}</span><span>${tile.icon} ${tile.label.toUpperCase()}</span><span>+${tile.bonus || 25} XP</span></div>
      <h3 class="question-text">${escapeHtml(question.question)}</h3>
      <div class="answer-options" role="group" aria-label="Opciones de respuesta">${question.options.map((option, index) => `<button class="answer-choice" data-answer-index="${index}" type="button"><span>${String.fromCharCode(65 + index)}</span>${escapeHtml(option)}</button>`).join("")}</div>
      <button class="hint-button" data-action="hint" type="button" ${run.coins < 3 || run.hintedQuestions.includes(question.id) ? "disabled" : ""}>Usar 3 monedas · pedir pista</button>
      <p class="hint-feedback hidden" id="hint-feedback" role="status"></p>
      <p class="difficulty-note">${tile.penalty === 2 ? "Reto de deficiencia: un error cuesta dos corazones." : "Un error cuesta un corazón. La explicación aparecerá al responder."}</p>`;
    document.querySelector("#challenge-feedback").classList.add("hidden");
    document.querySelector("#continue-button").classList.add("hidden");
    document.querySelector("#continue-button").dataset.questionId = question.id;
    document.querySelector("#continue-button").dataset.tilePosition = position;
  }

  function rollDice() {
    if (!run.active || run.gameOver || document.querySelector("#continue-button").offsetParent) return;
    const button = document.querySelector("#roll-button");
    button.disabled = true;
    const dice = document.querySelector("#dice");
    dice.classList.add("rolling");
    let ticks = 0;
    window.clearInterval(diceTimer);
    diceTimer = window.setInterval(() => {
      dice.textContent = String(1 + Math.floor(Math.random() * 3));
      ticks += 1;
      if (ticks >= 8) {
        window.clearInterval(diceTimer);
        dice.classList.remove("rolling");
        const roll = 1 + Math.floor(Math.random() * 3);
        dice.textContent = String(roll);
        run.position = Math.min(DATA.board.length, run.position + roll);
        playTone("roll");
        renderBoard();
        landOnTile(run.position);
        persist();
      }
    }, 80);
  }

  function answerQuestion(button) {
    if (button.disabled) return;
    const question = DATA.questions.find((item) => item.id === document.querySelector("#continue-button").dataset.questionId);
    const position = Number(document.querySelector("#continue-button").dataset.tilePosition);
    const tile = DATA.board[position - 1];
    if (!question || !tile) {
      announce("No se pudo validar esta pregunta. Lanza el dado para continuar.");
      return;
    }
    const selected = Number(button.dataset.answerIndex);
    const correct = selected === question.answer;
    run.answered += 1;
    run.pendingQuestionId = null;
    if (correct) {
      run.correct += 1;
      const gained = 25 + (tile.bonus || 0);
      run.score += gained;
      run.xp += gained;
      run.coins += tile.category === "DESAFÍO" ? 5 : 2;
      if (question.vitamin && !run.discoveries.includes(question.vitamin)) {
        run.discoveries.push(question.vitamin);
        if (!save.discoveries.includes(question.vitamin)) save.discoveries.push(question.vitamin);
        setMascot("surprised", `¡Encontraste ${vitaminById(question.vitamin)?.name}! Ya está en tu laboratorio.`);
      } else {
        setMascot("happy", "¡Excelente respuesta! Tu conocimiento ayuda a restaurar el equilibrio.");
      }
      playTone("correct");
    } else {
      run.hearts = Math.max(0, run.hearts - (tile.penalty || 1));
      setMascot("motivating", "No te preocupes; equivocarse también forma parte de aprender. Lee la explicación.");
      playTone("wrong");
    }
    run.review.push({ questionId: question.id, selected, correct });
    run.completedTiles = [...new Set([...run.completedTiles, position])];
    const choices = [...document.querySelectorAll(".answer-choice")];
    choices.forEach((choice, index) => {
      choice.disabled = true;
      if (index === question.answer) choice.classList.add("answer-correct");
      else if (index === selected) choice.classList.add("answer-wrong");
    });
    const feedback = document.querySelector("#challenge-feedback");
    feedback.classList.remove("hidden");
    feedback.classList.toggle("feedback-good", correct);
    feedback.classList.toggle("feedback-bad", !correct);
    feedback.innerHTML = `<strong>${correct ? "¡Bien hecho!" : "Respuesta para recordar"}</strong><p>${escapeHtml(question.explanation)}</p>${correct ? `<small>+${25 + (tile.bonus || 0)} XP · +${tile.category === "DESAFÍO" ? 5 : 2} monedas</small>` : `<small>−${tile.penalty || 1} corazón${(tile.penalty || 1) > 1 ? "es" : ""}</small>`}`;
    const nextButton = document.querySelector("#continue-button");
    nextButton.classList.remove("hidden");
    nextButton.textContent = run.hearts === 0 ? "Ver resultados" : position >= DATA.board.length ? "Completar misión" : "Continuar por el tablero ↗";
    document.querySelector("#board-hint").textContent = correct ? "Casilla completada. ¡Sigue avanzando!" : "Casilla completada. La explicación queda en tu registro.";
    completeBoardZone(position);
    renderVitals();
    persist();
    if (run.hearts === 0) nextButton.dataset.action = "game-over";
    else if (position >= DATA.board.length) nextButton.dataset.action = "finish-run";
    else nextButton.dataset.action = "continue";
  }

  function useHint() {
    const questionId = document.querySelector("#continue-button").dataset.questionId;
    const question = DATA.questions.find((item) => item.id === questionId);
    if (!question || run.hintedQuestions.includes(questionId)) return;
    if (run.coins < 3) {
      announce("Necesitas 3 monedas para pedir una pista.");
      return;
    }
    const hints = {
      ALIMENTO: "Pista: compara si las fuentes más conocidas son frutas, hojas verdes, frutos secos o alimentos de origen animal.",
      ABSORCIÓN: "Pista: identifica primero si esta vitamina es liposoluble o hidrosoluble.",
      TRANSPORTE: "Pista: piensa si viaja disuelta en la sangre o empaquetada con lípidos.",
      FUNCIÓN: "Pista: relaciona la vitamina con su papel fisiológico más conocido.",
      DEFICIENCIA: "Pista: busca el nutriente cuya función encaja mejor con el síntoma descrito. No sirve para diagnosticar una carencia real.",
      DESAFÍO: "Pista: vuelve a la función o al proceso bioquímico que estudiaste en la ficha.",
      VISIÓN: "Pista: distingue el papel directo de vitamina A del apoyo metabólico de B₂."
    };
    run.coins -= 3;
    run.hintedQuestions.push(questionId);
    const hint = document.querySelector("#hint-feedback");
    hint.textContent = hints[question.category] || "Pista: revisa el nombre y la función de las vitaminas implicadas.";
    hint.classList.remove("hidden");
    const button = document.querySelector(".hint-button");
    button.disabled = true;
    button.textContent = "Pista utilizada";
    setMascot("thinking", "Te doy una pista, pero la respuesta final sigue siendo tuya.");
    renderVitals();
    persist();
  }

  function completeBoardZone(position) {
    const zones = [
      { id: "ALIMENTACIÓN", end: 2, label: "Explorador de alimentos" },
      { id: "ABSORCIÓN", end: 4, label: "Experto en absorción" },
      { id: "TRANSPORTE", end: 6, label: "Guardián del transporte" },
      { id: "FUNCIÓN", end: 10, label: "Maestro de las funciones" },
      { id: "VISIÓN", end: 12, label: "Vision Mode" }
    ];
    const passedZones = zones.filter((item) => item.end <= position && !run.completedZones.includes(item.id));
    passedZones.forEach((zone) => {
      run.completedZones.push(zone.id);
      const badge = zone.id === "VISIÓN" ? "Misión visual" : zone.label;
      if (!save.badges.includes(badge)) save.badges.push(badge);
      run.score += 20;
      run.xp += 20;
      run.coins += 3;
      setMascot("excited", "¡Zona completada! Ganaste una insignia y 3 monedas.");
      if (zone.id === "VISIÓN") run.visionBadge = true;
    });
  }

  function continueGame() {
    if (run.hearts <= 0) {
      finishRun(true);
      return;
    }
    if (run.position >= DATA.board.length) {
      finishRun(false);
      return;
    }
    document.querySelector("#challenge-feedback").classList.add("hidden");
    document.querySelector("#continue-button").classList.add("hidden");
    document.querySelector("#challenge-category").textContent = "SIGUIENTE TURNO";
    document.querySelector("#challenge-body").innerHTML = '<div class="challenge-placeholder"><span>🎲</span><strong>¿Qué habrá en la siguiente casilla?</strong><p>Lanza el dado para avanzar por la ruta del organismo.</p></div>';
    renderGame();
  }

  function finishRun(outOfHearts = false) {
    if (!run.active) {
      goTo("results");
      return;
    }
    run.active = false;
    run.gameOver = outOfHearts;
    save.coins += run.coins;
    save.xp += run.xp;
    const percent = run.answered ? Math.round(run.correct / run.answered * 100) : null;
    save.games += 1;
    save.best = Math.max(save.best, run.score);
    if (percent !== null) save.average = Math.round((save.average * (save.games - 1) + percent) / save.games);
    const achieved = run.visionBadge ? "Insignia Visual" : null;
    if (achieved && !save.badges.includes(achieved)) save.badges.push(achieved);
    save.history.unshift({ alias: save.alias || "Explorador", score: run.score, correct: run.correct, answered: run.answered, percent, date: new Date().toISOString(), discoveries: [...run.discoveries], hearts: run.hearts, zones: run.completedZones.length, visionBadge: run.visionBadge, review: [...run.review] });
    save.history = save.history.slice(0, 30);
    persist();
    goTo("results");
  }

  function startVision() {
    document.querySelector("#vision-intro").classList.add("hidden");
    document.querySelector("#vision-game").classList.remove("hidden");
    setMascot("thinking", "Elige A por su función directa y B₂ por su contribución a la visión normal; distingue sus papeles.", "#vision-viti-message");
    const options = DATA.vitamins.map((vitamin) => `<label class="vision-option ${vitamin.id === "A" ? "direct-option" : vitamin.id === "B2" ? "support-option" : ""}"><input type="checkbox" value="${vitamin.id}" /><span class="vision-code">${vitamin.id}</span><span><strong>${escapeHtml(vitamin.name)}</strong><small>${vitamin.id === "A" ? "Función directa en el ciclo visual" : vitamin.id === "B2" ? "Contribuye al mantenimiento de la visión normal" : "No es una función visual directa establecida en este reto"}</small></span></label>`).join("");
    document.querySelector("#vision-options").innerHTML = options;
  }

  function checkVision() {
    const selected = [...document.querySelectorAll("#vision-options input:checked")].map((input) => input.value).sort();
    const isCorrect = selected.length === 2 && selected[0] === "A" && selected[1] === "B2";
    const feedback = document.querySelector("#vision-feedback");
    feedback.classList.remove("hidden", "feedback-good", "feedback-bad");
    feedback.classList.add(isCorrect ? "feedback-good" : "feedback-bad");
    feedback.innerHTML = isCorrect
      ? "<strong>¡Selección precisa!</strong><p>La vitamina A participa directamente en el ciclo visual. La riboflavina (B₂) contribuye a la visión normal mediante sus funciones metabólicas. Son relaciones distintas.</p>"
      : "<strong>Revisa la distinción</strong><p>Selecciona A y B₂: la vitamina A tiene función directa en el ciclo visual; B₂ contribuye a mantener la visión normal. No marques todas las vitaminas como igualmente esenciales.</p>";
    if (isCorrect) {
      save.badges = [...new Set([...save.badges, "Explorador/a visual"])];
      document.querySelector("#vision-finish").classList.remove("hidden");
      setMascot("excited", "¡Lo lograste! Has distinguido una función directa de una contribución metabólica.", "#vision-viti-message");
      if (run.active) run.visionBadge = true;
      persist();
      playTone("correct");
    }
  }

  function finishVision() {
    document.querySelector("#vision-game").classList.add("hidden");
    const result = document.querySelector("#vision-result");
    result.classList.remove("hidden");
    result.innerHTML = '<div class="vision-award"><span>🏅</span><div><strong>Insignia: Explorador/a visual</strong><p>Completaste Vision Mode con una explicación científicamente matizada.</p></div></div><button class="button button-primary" data-action="return-game">Volver a la expedición</button>';
  }

  function vitaminCard(vitamin, discovered) {
    const locked = !discovered;
    return `<button class="vitamin-card ${locked ? "locked-card" : ""}" data-vitamin="${vitamin.id}" ${locked ? 'data-locked="true"' : ""} type="button" aria-label="Consultar ficha de ${escapeHtml(vitamin.name)}">
      <span class="vitamin-icon">${locked ? "🔒" : vitamin.icon}</span><span class="vitamin-code">${vitamin.id}</span>
      <strong>${escapeHtml(vitamin.name)}</strong><small>${vitamin.type.toUpperCase()}</small>
      <span class="discovery-mark">${locked ? "NO DESCUBIERTA EN MI LABORATORIO" : "DESCUBIERTA"}</span></button>`;
  }

  let currentFilter = "all";
  function renderVitamins() {
    document.querySelector("#learn-discovered").textContent = `${save.discoveries.length} / ${DATA.vitamins.length}`;
    document.querySelectorAll(".filter-chip").forEach((chip) => {
    const selected = chip.dataset.filter === currentFilter;
    chip.classList.toggle("selected", selected);
    chip.setAttribute("aria-pressed", String(selected));
    });
    const list = DATA.vitamins.filter((vitamin) => {
      if (currentFilter === "liposoluble" || currentFilter === "hidrosoluble") return vitamin.type === currentFilter;
      if (currentFilter === "discovered") return save.discoveries.includes(vitamin.id);
      return true;
    });
    const grid = document.querySelector("#vitamin-grid");
    grid.innerHTML = list.length ? list.map((vitamin) => vitaminCard(vitamin, save.discoveries.includes(vitamin.id))).join("") : '<div class="empty-state"><span>🧪</span><h2>Aún no has descubierto vitaminas</h2><p>Juega una partida para llenar tu laboratorio.</p><button class="button button-primary" data-action="play">Jugar ahora</button></div>';
  }

  function openVitamin(id, allowLocked = false) {
    const vitamin = vitaminById(id);
    if (!vitamin) return;
    if (!allowLocked && !save.discoveries.includes(id)) {
      announce("Ficha bloqueada: descubre esta vitamina al responder correctamente en el tablero.");
      return;
    }
    viewBeforeDialog = screens.find((screen) => !screen.classList.contains("hidden"))?.id.replace("screen-", "") || "learn";
    const dialogContent = document.querySelector("#vitamin-detail");
    dialogContent.innerHTML = `<div class="detail-heading"><span class="detail-icon">${vitamin.icon}</span><div><p class="eyebrow">FICHA DE LABORATORIO</p><h2>${escapeHtml(vitamin.name)}</h2><span class="small-label">${escapeHtml(vitamin.scientific)}</span></div></div>
      <div class="detail-facts"><div><span>CLASIFICACIÓN</span><p>${vitamin.type}</p></div><div><span>FUENTES ALIMENTARIAS</span><p>${escapeHtml(vitamin.sources)}</p></div><div><span>ABSORCIÓN</span><p>${escapeHtml(vitamin.absorption)}</p></div><div><span>FUNCIONES</span><p>${escapeHtml(vitamin.functions)}</p></div><div><span>DEFICIENCIA</span><p>${escapeHtml(vitamin.deficiency)}</p></div><div><span>RELACIÓN CON LA VISIÓN</span><p>${escapeHtml(vitamin.vision)}</p></div><div><span>DATO CURIOSO</span><p>${escapeHtml(vitamin.curious)}</p></div></div>
      <section class="knowledge-check"><h3>Comprueba lo aprendido</h3><p>${escapeHtml(vitamin.quiz)}</p><div class="answer-options">${vitamin.quizOptions.map((option, index) => `<button class="answer-choice mini-quiz" data-vitamin-quiz="${vitamin.id}" data-option="${index}"><span>${String.fromCharCode(65 + index)}</span>${escapeHtml(option)}</button>`).join("")}</div><div class="challenge-feedback hidden" id="vitamin-quiz-feedback"></div></section>
      <p class="medical-note">Contenido educativo: los síntomas pueden tener múltiples causas y no permiten diagnosticar una deficiencia.</p>`;
    dialog.showModal();
  }

  function renderProfile() {
    const alias = save.alias || "Explorador";
    document.querySelector("#profile-alias").textContent = alias;
    document.querySelector("#profile-level").textContent = `Nivel ${Math.floor(save.xp / 250) + 1} · ${save.xp} XP · ${save.coins} monedas`;
    document.querySelector("#profile-best").textContent = save.best;
    const stats = [
      ["Partidas completadas", save.games], ["Acierto medio", save.games ? `${save.average}%` : "—"],
      ["Vitaminas descubiertas", `${save.discoveries.length} / ${DATA.vitamins.length}`], ["Monedas", save.coins],
      ["Experiencia total", save.xp], ["Insignias", save.badges.length]
    ];
    document.querySelector("#profile-stats").innerHTML = stats.map(([label, value]) => `<div class="profile-stat panel"><span>${label}</span><strong>${value}</strong></div>`).join("");
    renderBadges(document.querySelector("#badge-list"));
  }

  function renderBadges(element) {
    element.innerHTML = save.badges.length
      ? save.badges.map((badge) => `<span class="badge-item"><span>🏅</span>${escapeHtml(badge)}</span>`).join("")
      : '<span class="muted">Completa zonas y Vision Mode para conseguir insignias.</span>';
  }

  function renderRanking() {
    const list = document.querySelector("#ranking-list");
    const empty = document.querySelector("#ranking-empty");
    const records = [...save.history].sort((a, b) => b.score - a.score || (b.percent || 0) - (a.percent || 0));
    empty.classList.toggle("hidden", records.length !== 0);
    list.innerHTML = records.slice(0, 20).map((record, index) => `<div class="ranking-row"><span class="rank-number">${index + 1}</span><strong>${escapeHtml(record.alias || "Explorador")}</strong><span>${record.percent === null ? "Sin preguntas" : `${record.percent}% (${record.correct}/${record.answered})`}</span><b>${record.score} XP</b><time>${new Date(record.date).toLocaleDateString("es", { day: "2-digit", month: "short" })}</time></div>`).join("");
  }

  function elapsedTime() {
    if (!run.startedAt) return "—";
    const seconds = Math.max(0, Math.floor((Date.now() - run.startedAt) / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function renderResults() {
    const latest = save.history[0];
    if (!latest) {
      document.querySelector("#result-rank").textContent = "Aún no hay resultados";
      document.querySelector("#result-message").textContent = "Completa una partida para ver resultados reales.";
      document.querySelector("#result-grid").innerHTML = "";
      return;
    }
    const percent = latest.percent;
    const classification = percent === null ? "Sin respuestas todavía" : percent >= 85 ? "VITAMIN MASTER ✨" : percent >= 60 ? "CASI EXPERTO 🌱" : "NECESITAS REPASAR 🧪";
    document.querySelector("#result-rank").textContent = classification;
    document.querySelector("#result-grid").innerHTML = [
      ["Aciertos", percent === null ? "—" : `${percent}% (${latest.correct}/${latest.answered})`], ["Puntuación", `${latest.score} XP`],
      ["Descubiertas", `${latest.discoveries.length} / 10`], ["Zonas completadas", `${latest.zones} / 5`],
      ["Corazones restantes", `${"♥".repeat(latest.hearts)}${"♡".repeat(5 - latest.hearts)}`],
      ["Desafío visual", latest.visionBadge ? "Insignia obtenida" : "Aún por completar"], ["Tiempo", elapsedTime()]
    ].map(([label, value]) => `<div class="result-stat"><span>${label}</span><strong>${value}</strong></div>`).join("");
    const summary = percent === null
      ? "No se registraron respuestas en esta partida. Vuelve a jugar para obtener un porcentaje real."
      : percent >= 85
        ? "¡Misión completada! Reconociste funciones importantes y las distintas relaciones entre nutrientes y visión. Sigue explorando las fichas."
        : percent >= 60
          ? "¡Buen trabajo! Ya manejas varias funciones y fuentes. Repasa las explicaciones que te resultaron difíciles para seguir avanzando."
          : "Cada reto es una oportunidad de aprender. Revisa tus respuestas y las fichas del laboratorio; los síntomas no diagnostican carencias.";
    const discoveredCount = latest.discoveries.length;
    const wrongCategories = [...new Set((latest.review || []).filter((item) => !item.correct).map((item) => DATA.questions.find((question) => question.id === item.questionId)?.category).filter(Boolean))];
    const personalized = `${summary} En esta partida descubriste ${discoveredCount} de 10 vitaminas.${wrongCategories.length ? ` Si quieres repasar, vuelve a ${wrongCategories.join(", ").toLowerCase()}.` : ""}`;
    document.querySelector("#result-message").textContent = personalized;
    renderBadges(document.querySelector("#result-badges"));
    document.querySelector("#review-list").classList.add("hidden");
  }

  function showReview() {
    const review = document.querySelector("#review-list");
    const latest = save.history[0];
    if (!latest || !latest.answered) {
      review.innerHTML = "<p>No hay respuestas registradas para revisar.</p>";
    } else {
      const currentReview = latest.review || run.review;
      review.innerHTML = currentReview.length ? currentReview.map((item) => {
        const question = DATA.questions.find((entry) => entry.id === item.questionId);
        return question ? `<article class="review-item ${item.correct ? "review-right" : "review-wrong"}"><strong>${item.correct ? "✓" : "↺"} ${escapeHtml(question.category)} · ${escapeHtml(question.question)}</strong><p>Tu respuesta: ${escapeHtml(question.options[item.selected] || "No registrada")}${item.correct ? "" : ` · Respuesta correcta: ${escapeHtml(question.options[question.answer])}`}</p><p>${escapeHtml(question.explanation)}</p></article>` : "";
      }).join("") : "<p>El detalle de esta partida ya no está en memoria. Las puntuaciones se conservan localmente.</p>";
    }
    review.classList.toggle("hidden");
    review.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function playTone(kind) {
    if (!save.sound) return;
    try {
      audioContext ||= new window.AudioContext();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.frequency.value = kind === "correct" ? 660 : kind === "wrong" ? 180 : 320;
      gain.gain.setValueAtTime(0.07, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.18);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.18);
    } catch (error) {
      save.sound = false;
      persist();
      console.error("El audio no está disponible en este navegador.", error);
      announce("El audio no está disponible. El juego continúa sin sonido.");
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function openEditAlias() {
    viewBeforeDialog = "profile";
    document.querySelector("#text-dialog-content").innerHTML = `<h2>Edita tu alias</h2><p>El nombre solo se guarda en este dispositivo.</p><form id="alias-form"><label for="alias-edit">Alias</label><input id="alias-edit" maxlength="18" value="${escapeHtml(save.alias || "Explorador")}" required /><button class="button button-primary">Guardar alias</button></form>`;
    textDialog.showModal();
  }

  document.addEventListener("click", (event) => {
    const actionElement = event.target.closest("[data-action]");
    if (actionElement) {
      const action = actionElement.dataset.action;
      if (action === "home") goTo("home");
      else if (action === "learn") { currentFilter = "all"; goTo("learn"); }
      else if (action === "collection") { currentFilter = "discovered"; goTo("learn"); }
      else if (action === "vision") goTo("vision");
      else if (action === "ranking") goTo("ranking");
      else if (action === "profile") goTo("profile");
      else if (action === "play") startRun();
      else if (action === "resume") goTo("game");
      else if (action === "roll") rollDice();
      else if (action === "hint") useHint();
      else if (action === "continue") continueGame();
      else if (action === "finish-run" || action === "game-over") finishRun(action === "game-over");
      else if (action === "end-run") finishRun(false);
      else if (action === "dismiss-warning") { run.overloadSeen = true; document.querySelector("#balance-alert").classList.add("hidden"); persist(); }
      else if (action === "start-vision") startVision();
      else if (action === "check-vision") checkVision();
      else if (action === "finish-vision") finishVision();
      else if (action === "game") { if (run.active) goTo("game"); else startRun(); }
      else if (action === "return-game") { if (run.active) goTo("game"); else goTo("home"); }
      else if (action === "tutorial-next") {
        if (tutorialStep < tutorialSteps.length - 1) { tutorialStep += 1; renderTutorial(); }
        else closeTutorial();
      } else if (action === "tutorial-skip") closeTutorial();
      else if (action === "review") showReview();
      else if (action === "edit-alias") openEditAlias();
      else if (action === "reset-data") {
        if (window.confirm("¿Borrar el progreso, las partidas y las vitaminas descubiertas guardadas en este dispositivo?")) {
          localStorage.removeItem(STORAGE_KEY);
          save = readSave();
          run = emptyRun();
          document.querySelector("#player-alias").value = "";
          goTo("home");
          announce("Progreso local borrado.");
        }
      } else if (action === "close-dialog") {
        const parent = actionElement.closest("dialog");
        parent?.close();
        if (viewBeforeDialog === "learn") renderVitamins();
      }
    }

    const answer = event.target.closest(".answer-choice:not(.mini-quiz)");
    if (answer && !answer.classList.contains("disabled")) answerQuestion(answer);

    const vitamin = event.target.closest("[data-vitamin]");
    if (vitamin) openVitamin(vitamin.dataset.vitamin, currentFilter !== "discovered");

    const quizOption = event.target.closest("[data-vitamin-quiz]");
    if (quizOption) {
      const item = vitaminById(quizOption.dataset.vitaminQuiz);
      const feedback = document.querySelector("#vitamin-quiz-feedback");
      const correct = Number(quizOption.dataset.option) === item.quizAnswer;
      feedback.classList.remove("hidden", "feedback-good", "feedback-bad");
      feedback.classList.add(correct ? "feedback-good" : "feedback-bad");
      feedback.innerHTML = `<strong>${correct ? "¡Correcto!" : "Repasa la ficha"}</strong><p>${escapeHtml(item.quizOptions[item.quizAnswer])} es la respuesta adecuada.</p>`;
    }
  });

  document.querySelector(".filter-row").addEventListener("click", (event) => {
    const filter = event.target.closest("[data-filter]");
    if (!filter) return;
    currentFilter = filter.dataset.filter;
    document.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.toggle("selected", chip === filter));
    renderVitamins();
  });

  document.querySelector("#sound-toggle").addEventListener("click", (event) => {
    save.sound = !save.sound;
    event.currentTarget.innerHTML = `${save.sound ? "🔊" : "🔇"} <span>Sonido ${save.sound ? "activado" : "desactivado"}</span>`;
    persist();
    if (save.sound) playTone("correct");
  });

  document.querySelector("#text-dialog").addEventListener("submit", (event) => {
    if (event.target.id !== "alias-form") return;
    event.preventDefault();
    setAlias(document.querySelector("#alias-edit").value);
    textDialog.close();
    renderProfile();
    announce("Alias actualizado.");
  });

  document.querySelector("#player-alias").value = save.alias;
  document.querySelector("#sound-toggle").innerHTML = `${save.sound ? "🔊" : "🔇"} <span>Sonido ${save.sound ? "activado" : "desactivado"}</span>`;
  renderBoard();
  renderVitamins();
  if (save.loadError) announce("No se pudo leer el progreso guardado; puedes seguir jugando y se intentará guardar una partida nueva.");
  if (run.active) {
    const resume = document.createElement("button");
    resume.className = "button button-secondary resume-button";
    resume.dataset.action = "resume";
    resume.textContent = "Continuar partida guardada";
    resume.addEventListener("click", () => goTo("game"));
    document.querySelector(".alias-row").after(resume);
  }
})();
