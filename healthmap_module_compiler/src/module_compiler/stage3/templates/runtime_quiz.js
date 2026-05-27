// -------------------------
// Quiz Renderer (Stub)
// -------------------------

function renderQuiz(slide, container) {
  renderHeader(slide, container);

  const scope = slide.quiz_scope || "inline"; // "inline" or "final"

  const wrapper = document.createElement("div");
  wrapper.className = "quiz-wrapper";

  // Optional scope label (subtle)
  const scopeLabel = document.createElement("p");
  scopeLabel.className = "quiz-scope";
  scopeLabel.textContent = scope === "final" ? "Final Quiz" : "Knowledge Check";
  wrapper.appendChild(scopeLabel);

  const q = slide.questions?.[0];

  if (!q) {
    const p = document.createElement("p");
    p.textContent = "Quiz question missing.";
    wrapper.appendChild(p);
  } else {

    let effectiveSlideIndex = RuntimeState.currentIndex;

    if (scope === "final") {

      ensureFinalShufflePlan();

      const mapped = RuntimeState.final.questionOrder[RuntimeState.finalCursor];

      if (typeof mapped === "number") {
        effectiveSlideIndex = mapped;
      }
    }

    console.log("RENDER QUIZ -> finalCursor:", RuntimeState.finalCursor, "effectiveSlideIndex:", effectiveSlideIndex);

    const effectiveSlide = RuntimeState.slides[effectiveSlideIndex];
    const effectiveQ = effectiveSlide?.questions?.[0];

    const block = renderQuizQuestionBlock(
      effectiveSlide,
      effectiveQ,
      0,
      effectiveSlideIndex,
      scope
    );

    wrapper.appendChild(block);

  }

  // If final scope: show running score box
  if (scope === "final") {
    ensureFinalShufflePlan();
  }

  container.appendChild(wrapper);
}

function ensureQuizState(slideIndex, qIndex) {
  if (!RuntimeState.quizState[slideIndex]) RuntimeState.quizState[slideIndex] = {};
  if (!RuntimeState.quizState[slideIndex][qIndex]) {
    RuntimeState.quizState[slideIndex][qIndex] = {
      selectedOptionId: null,
      submitted: false,
      correct: false
    };
  }
  return RuntimeState.quizState[slideIndex][qIndex];
}
// -------------------------
// Question Block Renderer
// -------------------------
function renderQuizQuestionBlock(slide, q, qIndex, slideIndex, scope) {
  const state = ensureQuizState(slideIndex, qIndex);

  const block = document.createElement("div");
  block.className = "quiz-question";

  const prompt = document.createElement("p");
  prompt.className = "quiz-prompt";
  prompt.textContent = q.prompt || `Question ${qIndex + 1}`;
  block.appendChild(prompt);

  const optionsWrap = document.createElement("div");
  optionsWrap.className = "quiz-options";

  const options = normalizeOptions(slide, q);

  let orderedOptions = options;

  if (scope === "final") {
    ensureFinalShufflePlan();

    const key = finalKey(slideIndex, qIndex);
    const order = RuntimeState.final.optionOrder[key];

    if (order && order.length) {
      const byId = new Map(options.map(o => [o.id, o]));
      orderedOptions = order.map(id => byId.get(id)).filter(Boolean);
    }
  } else {
    ensureGlobalShufflePlan();

    const key = inlineKey(slideIndex, qIndex);
    const order = RuntimeState.shuffle.optionOrder[key];

    if (order && order.length) {
      const byId = new Map(options.map(o => [o.id, o]));
      orderedOptions = order.map(id => byId.get(id)).filter(Boolean);
    }
  }

  orderedOptions.forEach((opt) => {
    const label = document.createElement("label");
    label.className = "quiz-option";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = `q_${slideIndex}_${qIndex}`;
    input.value = opt.id;
    input.disabled = state.submitted || RuntimeState.reviewMode === true;

    if (state.selectedOptionId === opt.id) input.checked = true;

    input.addEventListener("change", () => {
      state.selectedOptionId = opt.id;
      saveProgress();
    });

    const span = document.createElement("span");
    span.textContent = opt.text;

    label.appendChild(input);
    label.appendChild(span);
    optionsWrap.appendChild(label);
  });

  block.appendChild(optionsWrap);

  const actions = document.createElement("div");
  actions.className = "quiz-actions";

  const submitBtn = document.createElement("button");
  submitBtn.className = "quiz-submit";
  submitBtn.textContent = state.submitted ? "Submitted" : "Submit";
  submitBtn.disabled = state.submitted || RuntimeState.reviewMode === true;

  const feedback = document.createElement("div");
  feedback.className = "quiz-feedback";

  submitBtn.addEventListener("click", () => {
    if (!state.selectedOptionId) {
      feedback.textContent = "Please select an answer, then submit.";
      feedback.className = "quiz-feedback quiz-feedback-warn";
      return;
    }

    // Validate
    const correctId = q.correct_option_id;
    state.correct = state.selectedOptionId === correctId;
    state.submitted = true;
    saveProgress();

    // Lock all radios
    Array.from(optionsWrap.querySelectorAll("input[type=radio]")).forEach(inp => {
      inp.disabled = true;
    });

    // Update submit
    submitBtn.textContent = "Submitted";
    submitBtn.disabled = true;

    // Feedback + explanation
    feedback.className = state.correct
      ? "quiz-feedback quiz-feedback-correct"
      : "quiz-feedback quiz-feedback-incorrect";

    const exp = q.explanation ? ` Explanation: ${q.explanation}` : "";
    feedback.textContent = (state.correct ? "Correct." : "Incorrect.") + exp;

    // If final: recompute score
    if (scope === "final") {
      recomputeFinalScoreAndRender();
    }

    updateNavigationUI();

    // Auto-scroll to feedback so learner sees explanation
    setTimeout(() => {
      feedback.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }, 100);
  });

  actions.appendChild(submitBtn);
  block.appendChild(actions);
  block.appendChild(feedback);

  // If already submitted (restored from storage), show feedback immediately
  if (state.submitted) {
    feedback.className = state.correct
      ? "quiz-feedback quiz-feedback-correct"
      : "quiz-feedback quiz-feedback-incorrect";
    const exp = q.explanation ? ` Explanation: ${q.explanation}` : "";
    feedback.textContent = (state.correct ? "Correct." : "Incorrect.") + exp;
  }

  return block;
}

function normalizeOptions(slide, q) {
  // MCQ: q.options provided
  if (Array.isArray(q.options) && q.options.length) return q.options;

  // True/False: generate standard options if missing
  if (slide.quiz_type === "true_false") {
    return [
      { id: "true", text: "True" },
      { id: "false", text: "False" }
    ];
  }

  // Fallback: empty
  return [];
}

// -------------------------
// Render Final Score
// -------------------------

function renderFinalScoreBox() {
  const box = document.getElementById("final-score-box");
  if (!box) return;

  const { total, correct, percent, completed } = RuntimeState.final;

  box.innerHTML = "";

  const scoreLine = document.createElement("div");
  scoreLine.textContent =
    `Final Quiz Score: ${correct}/${total} (${percent}%)`;

  box.appendChild(scoreLine);

  if (!completed) {
    const status = document.createElement("div");
    status.style.marginTop = "0.5rem";
    status.textContent = "Complete all questions to finish the final quiz.";
    box.appendChild(status);
  } else {
    const status = document.createElement("div");
    status.style.marginTop = "0.5rem";
    status.style.fontWeight = "600";
    status.textContent = "Final Quiz Complete. Ready to submit.";
    box.appendChild(status);
  }
}

// -------------------------
// Final Results Screen
// -------------------------

function renderFinalResults(container) {

  const { percent, correct, total } = RuntimeState.final;
  const passed = percent >= 80;

  const wrapper = document.createElement("div");
  wrapper.className = "results-wrapper";

  // Title
  const title = document.createElement("h2");
  title.textContent = "Results";
  wrapper.appendChild(title);

  // Grid container
  const grid = document.createElement("div");
  grid.className = "results-grid";

  const left = document.createElement("div");
  left.className = "results-left";

  const divider = document.createElement("div");
  divider.className = "results-divider";

  const right = document.createElement("div");
  right.className = "results-right";

  // -------------------------
  // LEFT SIDE
  // -------------------------

  // Completion icon
  const icon = document.createElement("div");
  icon.className = "results-icon";

  if (passed) {
    // ✅ GREEN CHECK
    icon.innerHTML = `
      <svg viewBox="0 0 52 52" class="checkmark">
        <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
        <path class="checkmark-check" fill="none" d="M14 27l7 7 16-16"/>
      </svg>
    `;
  } else {
    // ❌ RED X
    icon.innerHTML = `
      <svg viewBox="0 0 52 52" class="crossmark">
        <circle class="crossmark-circle" cx="26" cy="26" r="25" fill="none"/>
        <path class="crossmark-x" fill="none" d="M16 16 36 36 M36 16 16 36"/>
      </svg>
    `;
  }

  // Score
  const score = document.createElement("div");
  score.className = "results-score";

  const percentText = document.createElement("div");
  percentText.className = passed
    ? "results-percent pass"
    : "results-percent fail";

  percentText.textContent = `${percent}%`;

  const scoreLabel = document.createElement("div");
  scoreLabel.className = "results-label";
  scoreLabel.textContent = "Your Score";

  score.appendChild(percentText);
  score.appendChild(scoreLabel);

  // Add icon ABOVE score
  left.appendChild(icon);

  // ❌ Trigger shake if failed
  if (!passed) {
    setTimeout(() => {
      icon.classList.add("shake");
    }, 100);
  }
  left.appendChild(score);

  // Correct count
  const correctBox = document.createElement("div");
  correctBox.className = "results-correct";
  correctBox.textContent = `${correct} / ${total} Questions Correct`;

  // Passing score
  const passing = document.createElement("div");
  passing.className = "results-passmark";
  passing.textContent = "Passing Score: 80%";

  left.appendChild(correctBox);
  left.appendChild(passing);

  // -------------------------
  // RIGHT SIDE
  // -------------------------

  const message = document.createElement("div");
  message.className = passed ? "results-pass" : "results-fail";

  message.textContent = passed
    ? "🎉 Congratulations! You passed the quiz!"
    : "You did not reach the passing score.";

  // Buttons container
  const buttons = document.createElement("div");
  buttons.className = "results-buttons";

  const saveBtn = document.createElement("button");
  saveBtn.className = "results-btn primary";
  saveBtn.textContent = "Save Score for CME";
  saveBtn.onclick = saveScoreForCme;

  const reviewBtn = document.createElement("button");
  reviewBtn.className = "results-btn secondary";
  reviewBtn.textContent = "Review Quiz";
  reviewBtn.onclick = () => {
    RuntimeState.reviewMode = true;

    // ✅ Reset cursor so review starts at first question
    RuntimeState.finalCursor = 0;

    RuntimeState.currentIndex = findFirstFinalQuizSlide();

    saveProgress();
    renderSlide();
  };

  const retryBtn = document.createElement("button");
  retryBtn.className = "results-btn dark";
  retryBtn.textContent = "Retry Quiz";
  retryBtn.onclick = resetFinalQuizOnly;

  const backBtn = document.createElement("button");
  backBtn.className = "results-btn dark";
  backBtn.textContent = "Back to Module";
  backBtn.onclick = () => {
    RuntimeState.final.completed = false;
    RuntimeState.currentIndex = 0;
    saveProgress();
    renderSlide();
  };

  buttons.appendChild(saveBtn);
  buttons.appendChild(reviewBtn);
  buttons.appendChild(retryBtn);
  buttons.appendChild(backBtn);

  right.appendChild(message);
  right.appendChild(buttons);

  // -------------------------
  // Assemble Layout
  // -------------------------

  grid.appendChild(left);
  grid.appendChild(divider);
  grid.appendChild(right);

  wrapper.appendChild(grid);

  container.appendChild(wrapper);
}

function findFirstFinalQuizSlide() {
  for (let i = 0; i < RuntimeState.slides.length; i++) {
    const s = RuntimeState.slides[i];
    if (s.type === "quiz" && (s.quiz_scope || "inline") === "final") {
      return i;
    }
  }
  return 0;
}

function resetFinalQuizOnly() {

  RuntimeState.reviewMode = false;

  RuntimeState.final = {
    total: 0,
    correct: 0,
    percent: 0,
    completed: false,
    attemptSeed: null,
    questionOrder: [],
    optionOrder: {},
    cursorMap: []
  };

  RuntimeState.finalCursor = 0;

  RuntimeState.slides.forEach((slide, index) => {
    if (slide.type === "quiz" && (slide.quiz_scope || "inline") === "final") {
      delete RuntimeState.quizState[index];
    }
  });

  RuntimeState.currentIndex = findFirstFinalQuizSlide();

  saveProgress();
  renderSlide();
}

function buildFinalQuizIndex() {

  if (!Array.isArray(RuntimeState.final.questions)) {
    RuntimeState.final.questions = [];
  }

  if (RuntimeState.final.questions.length > 0) return;

  RuntimeState.slides.forEach((slide, slideIndex) => {

    if (slide.type !== "quiz") return;
    if ((slide.quiz_scope || "inline") !== "final") return;
    if (!Array.isArray(slide.questions)) return;

    slide.questions.forEach((q, qIndex) => {

      RuntimeState.final.questions.push({
        slideIndex,
        qIndex
      });

    });

  });
  console.log("FINAL QUESTIONS INDEX:", JSON.stringify(RuntimeState.final.questions, null, 2));
}

// -------------------------
// Notify Flutter
// -------------------------

function notifyFlutterIfComplete() {
  const { completed } = RuntimeState.final;
  if (!completed) return;

  if (window.flutter_inappwebview &&
      window.flutter_inappwebview.callHandler) {

    window.flutter_inappwebview.callHandler(
      "finalQuizCompleted",
      {
        moduleId: RuntimeState.moduleId,
        score: RuntimeState.final.percent,
        total: RuntimeState.final.total,
        correct: RuntimeState.final.correct
      }
    );
  }
}

// -------------------------
// Final Score Computation
// -------------------------

function recomputeFinalScoreAndRender() {
  if (!Array.isArray(RuntimeState.final.questions)) {
    buildFinalQuizIndex();
  }

  let total = 0;
  let correct = 0;
  let allSubmitted = true;

  const order = RuntimeState.final.questionOrder || [];

  order.forEach((slideIndex) => {

    const qIndex = 0; // your system uses single-question slides

    total++;

    const st = RuntimeState.quizState?.[slideIndex]?.[qIndex];

    if (!st || !st.submitted) {
      allSubmitted = false;
    }

    if (st && st.submitted && st.correct) {
      correct++;
    }

  });

  const percent = total === 0 ? 0 : Math.round((correct / total) * 100);

  RuntimeState.final.total = total;
  RuntimeState.final.correct = correct;
  RuntimeState.final.percent = percent;
  RuntimeState.final.completed = total > 0 && allSubmitted;

  saveProgress();

  notifyFlutterIfComplete();
  if (!RuntimeState.final.completed) {
    RuntimeUI.resultsShown = false;
  }

  // if (RuntimeState.final.completed && !RuntimeUI.resultsShown) {

  //   RuntimeUI.resultsShown = true;

  //   RuntimeState.currentIndex = getResultsSlideIndex();

  //   saveProgress();
  //   renderSlide();
  //   return;
  // }
}

function getResultsSlideIndex() {

  let lastFinal = -1;

  RuntimeState.slides.forEach((slide, index) => {
    if (slide.type === "quiz" && (slide.quiz_scope || "inline") === "final") {
      lastFinal = index;
    }
  });

  if (lastFinal === -1) return null;

  return lastFinal + 1; // virtual results slide
}

function getFinalSlideIndexByCursor(cursor) {
  const order = RuntimeState.final.questionOrder || [];
  return order[cursor] ?? null;
}

// -------------------------
// Save Score Confirmation
// -------------------------
function showCmeConfirmationModal() {
  // Remove existing modal if it somehow already exists
  document.getElementById("cme-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "cme-overlay";
  overlay.className = "active";

  const modal = document.createElement("div");
  modal.id = "cme-modal";

  const title = document.createElement("h3");
  title.textContent = "Score Saved";

  const message = document.createElement("p");
  message.innerHTML = `
    Your score has been successfully saved for CME credit.<br><br>
    You may now submit your score from the CME Credits Tracker Page on HealthMAP.
  `;

  const actions = document.createElement("div");
  actions.className = "cme-actions";

  const okBtn = document.createElement("button");
  okBtn.className = "results-btn primary";
  okBtn.textContent = "OK";

  okBtn.addEventListener("click", () => {
    overlay.remove();

    // ✅ Reset quiz + shuffle
    clearFinalQuizFromLocalStorage();

    // ✅ Exit review mode completely
    RuntimeState.reviewMode = false;

    // ✅ Send user to BEGINNING of module
    RuntimeState.currentIndex = 0;

    // (Optional but recommended)
    RuntimeUI.resultsShown = false;

    saveProgress();
    renderSlide();
  });

  actions.appendChild(okBtn);
  modal.appendChild(title);
  modal.appendChild(message);
  modal.appendChild(actions);
  overlay.appendChild(modal);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });

  document.body.appendChild(overlay);
}

// -------------------------
// Save CME Score
// -------------------------
async function saveScoreForCme() {
  if (!window.flutter_inappwebview?.callHandler) {
    console.warn("Flutter handler not available.");
    return;
  }

  const payload = {
    module_id: RuntimeState.moduleId,
    module_name: window.moduleName || "",
    quiz_score: RuntimeState.final.percent,
    passed: RuntimeState.final.percent >= 80,
    saved_at: new Date().toISOString()
  };

  try {
    const response = await window.flutter_inappwebview.callHandler(
      "saveCmeScore",
      payload
    );

    console.log("CME SAVE RESPONSE:", response);

    showCmeConfirmationModal();

  } catch (error) {
    console.error("Failed to save CME score:", error);
  }
}

function clearFinalQuizFromLocalStorage() {
  RuntimeState.finalCursor = 0;
  RuntimeUI.resultsShown = false;
  RuntimeState.reviewMode = false;

  // Reset inline quiz shuffle
  RuntimeState.shuffle = {
    seed: null,
    optionOrder: {}
  };

  // Clear only FINAL quiz state
  RuntimeState.final = {
    total: 0,
    correct: 0,
    percent: 0,
    completed: false,
    attemptSeed: null,
    questionOrder: [],
    optionOrder: {},
    questions: [] 
  };

  // Remove only final-scope quiz entries
  RuntimeState.slides.forEach((slide, index) => {
    if (slide.type === "quiz" && (slide.quiz_scope || "inline") === "final") {
      delete RuntimeState.quizState[index];
    }
  });

  saveProgress();
}

// -------------------------
// Seeded RNG + Shuffle
// -------------------------

// Mulberry32: small fast seeded RNG
function seededRng(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffleArray(arr, rand) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Creates a new attempt seed (changes every restart/reset)
function newAttemptSeed() {
  // stable enough + integer
  return Math.floor(Date.now() % 2147483647);
}

function finalKey(slideIndex, qIndex) {
  return `${slideIndex}:${qIndex}`;
}

function inlineKey(slideIndex, qIndex) {
  return `${slideIndex}:${qIndex}`;
}

function getOrderedFinalSlideIndices() {
  return RuntimeState.final.questionOrder || [];
}

function getNextOrderedFinalSlideIndex(currentIndex) {
  const order = getOrderedFinalSlideIndices();
  const pos = order.indexOf(currentIndex);

  if (pos === -1) return null;

  return order[pos + 1] ?? null;
}

function ensureGlobalShufflePlan() {
  if (typeof RuntimeState.shuffle?.seed === "number") return;

  RuntimeState.shuffle.seed = newAttemptSeed();

  const rand = seededRng(RuntimeState.shuffle.seed);

  RuntimeState.shuffle.optionOrder = {};

  RuntimeState.slides.forEach((slide, slideIndex) => {
    if (slide.type !== "quiz") return;
    if (!Array.isArray(slide.questions)) return;

    slide.questions.forEach((q, qIndex) => {
      const options = normalizeOptions(slide, q);
      const optionIds = options.map(o => o.id);

      RuntimeState.shuffle.optionOrder[inlineKey(slideIndex, qIndex)] =
        seededShuffleArray(optionIds, rand);
    });
  });

  saveProgress();
}

function ensureFinalShufflePlan() {
  // If we already have a plan, keep it (resume/review must NOT reshuffle)
  if (
    typeof RuntimeState.final.attemptSeed === "number" &&
    Array.isArray(RuntimeState.final.questionOrder) &&
    RuntimeState.final.questionOrder.length > 0
  ) {
    return;
  }

  // Make a new attempt seed
  RuntimeState.final.attemptSeed = newAttemptSeed();

  const rand = seededRng(RuntimeState.final.attemptSeed);

  // Collect ALL final questions across slides
  const finalSlides = [];

  RuntimeState.slides.forEach((s, slideIndex) => {
    if (s.type !== "quiz") return;
    if ((s.quiz_scope || "inline") !== "final") return;

    finalSlides.push(slideIndex);
  });

  // Shuffle question order
  RuntimeState.final.questionOrder = seededShuffleArray(finalSlides, rand);

  // Shuffle options per question (store option ID order)
  RuntimeState.final.optionOrder = {};

  RuntimeState.final.questionOrder.forEach((slideIndex) => {
    const qIndex = 0;

    const q = RuntimeState.slides[slideIndex]?.questions?.[qIndex];
    if (!q) return;

    const options = normalizeOptions(RuntimeState.slides[slideIndex], q);
    const optionIds = options.map(o => o.id);

    RuntimeState.final.optionOrder[finalKey(slideIndex, qIndex)] =
      seededShuffleArray(optionIds, rand);
  });

  // Build cursor map (index → slideIndex)
  RuntimeState.final.cursorMap = [];

  RuntimeState.final.questionOrder.forEach((slideIndex, i) => {
    RuntimeState.final.cursorMap[i] = slideIndex;
  });

  console.log("SHUFFLED ORDER:", RuntimeState.final.questionOrder);
  saveProgress();
}