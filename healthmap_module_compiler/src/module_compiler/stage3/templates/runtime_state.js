// -------------------------
// Runtime State
// -------------------------

const RuntimeState = window.RuntimeState = {
  moduleId: null,
  title: "",
  slides: [],
  resources: [],
  currentIndex: 0,

  currentIndex: 0,
  finalCursor: 0, 

  // quizState[slideIndex][questionIndex] = { selectedOptionId, submitted, correct }
  quizState: {},
    shuffle: {
    seed: null,
    optionOrder: {}
  },

  // we will store computed final quiz results here too
  final: {
    total: 0,
    correct: 0,
    percent: 0,
    completed: false,

    // seeded shuffle
    attemptSeed: null,     // number
    questionOrder: [],     // array of { slideIndex, qIndex } in shuffled order
    optionOrder: {},
    questions: []         // key `${slideIndex}:${qIndex}` -> array of optionIds in shuffled order
  },

  engageState: {}
};

function storageKey() {
  return `healthmap_runtime::${RuntimeState.moduleId || "unknown"}`;
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return;
    const saved = JSON.parse(raw);

    if (typeof saved.currentIndex === "number") RuntimeState.currentIndex = saved.currentIndex;
    if (typeof saved.finalCursor === "number") {
      RuntimeState.finalCursor = saved.finalCursor;
    }
    if (saved.quizState) RuntimeState.quizState = saved.quizState;
    if (saved.final) {
      RuntimeState.final = {
        ...RuntimeState.final,
        ...saved.final
      };
    }

    if (saved.engageState) RuntimeState.engageState = saved.engageState;

  } catch (e) {
    console.warn("Progress load failed:", e);
  }
}

function saveProgress() {
  try {
    const payload = {
      currentIndex: RuntimeState.currentIndex,
      finalCursor: RuntimeState.finalCursor,
      quizState: RuntimeState.quizState,
      final: RuntimeState.final,

      engageState: RuntimeState.engageState
    };
    localStorage.setItem(storageKey(), JSON.stringify(payload));
  } catch (e) {
    console.warn("Progress save failed:", e);
  }
}

function hasSavedProgress() {
  const saved = localStorage.getItem(storageKey());
  if (!saved) return false;

  try {
    const data = JSON.parse(saved);

    if (data.currentIndex > 0) return true;
    if (data.quizState && Object.keys(data.quizState).length > 0) return true;
    if (data.engageState && Object.keys(data.engageState).length > 0) return true;

    return false;
  } catch {
    return false;
  }
}

function ensureEngageState(slideIndex) {
  if (!RuntimeState.engageState[slideIndex]) {
    RuntimeState.engageState[slideIndex] = {};
  }
  return RuntimeState.engageState[slideIndex];
}

window.storageKey = storageKey;
window.loadProgress = loadProgress;
window.saveProgress = saveProgress;
window.hasSavedProgress = hasSavedProgress;
window.ensureEngageState = ensureEngageState;

// -------------------------
// Runtime UI State
// -------------------------

const RuntimeUI = window.RuntimeUI = {
  resultsShown: false
};