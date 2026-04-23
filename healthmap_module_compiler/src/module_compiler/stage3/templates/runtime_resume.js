// runtime_resume.js

// -------------------------
// Resume/Reset Option Prompt
// -------------------------
function resetModuleProgress() {

  RuntimeState.currentIndex = 0;

  RuntimeState.quizState = {};
  RuntimeState.engageState = {};

  // ✅ Reset cursor
  RuntimeState.finalCursor = 0;

  // ✅ Reset final quiz completely
  RuntimeState.final = {
    total: 0,
    correct: 0,
    percent: 0,
    completed: false,
    attemptSeed: null,
    questionOrder: [],
    optionOrder: {},
    questions: []   // ✅ IMPORTANT
  };

  // ✅ Reset UI flags
  RuntimeUI.resultsShown = false;
  RuntimeState.reviewMode = false;

  // Optional (safe)
  RuntimeState.shuffle = {
    seed: null,
    optionOrder: {}
  };

  localStorage.removeItem(storageKey());
}

function setupResume() {
  const overlay = document.getElementById("resume-overlay");
  const continueBtn = document.getElementById("resume-continue");
  const restartBtn = document.getElementById("resume-restart");

  if (!overlay || !continueBtn || !restartBtn) return;

  continueBtn.addEventListener("click", () => {
    closeResume();
    renderSlide();
  });

  restartBtn.addEventListener("click", () => {
    resetModuleProgress();
    closeResume();
    renderSlide();
  });
}

function openResume() {
  const overlay = document.getElementById("resume-overlay");
  if (!overlay) return;

  overlay.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeResume() {
  const overlay = document.getElementById("resume-overlay");
  if (!overlay) return;

  overlay.classList.remove("active");
  document.body.style.overflow = "";
}