// runtime.js (bootstrap only)
// -------------------------
// Initialization
// -------------------------

document.addEventListener("DOMContentLoaded", async () => {
  await loadModule();
  setupNavigation();
  setupDrawer();
  setupResume();

  if (RuntimeState.moduleId && hasSavedProgress()) {
    openResume();
  } else {
    renderSlide();
  }
});


// -------------------------
// Slide Type Label (Temporary)
// -------------------------

function renderTypeLabel(text, container) {
  const label = document.createElement("p");
  label.style.fontStyle = "italic";
  label.style.opacity = "0.6";
  label.textContent = text;
  container.appendChild(label);
}

window.HealthMAPRuntime = {
  getModuleId: () => RuntimeState.moduleId,
  getFinalScore: () => RuntimeState.final,
  isFinalComplete: () => RuntimeState.final.completed,
  getProgress: () => ({
    currentIndex: RuntimeState.currentIndex,
    quizState: RuntimeState.quizState,
    engageState: RuntimeState.engageState,
    final: RuntimeState.final
  })
};

// -------------------------
// Global Button Press Handler
// -------------------------

document.addEventListener("pointerdown", (e) => {
  if (
    e.target.classList.contains("engage1-btn") ||
    e.target.classList.contains("engage2-btn")
  ) {
    e.target.classList.add("pressed");
  }
});

document.addEventListener("pointerup", (e) => {
  if (
    e.target.classList.contains("engage1-btn") ||
    e.target.classList.contains("engage2-btn")
  ) {
    e.target.classList.remove("pressed");
  }
});

document.addEventListener("pointercancel", (e) => {
  if (
    e.target.classList.contains("engage1-btn") ||
    e.target.classList.contains("engage2-btn")
  ) {
    e.target.classList.remove("pressed");
  }
});

RuntimeState.resources = [
  {
    title: "PHCFM PDF",
    file: "PHCFM-15-3204.pdf"
  }
];