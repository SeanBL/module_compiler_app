// runtime_core.js

// -------------------------
// Theme Presets
// -------------------------

const MODULE_THEMES = [
  {
    name: "blue",
    bg: "#eef4ff",
    bgHover: "#e2edff",
    text: "#173b67",
    border: "#c7d7f5",
    activeBg: "#2f6fed"
  },
  {
    name: "green",
    bg: "#eef8ec",
    bgHover: "#e4f3e0",
    text: "#24512c",
    border: "#cfe6cc",
    activeBg: "#4b9b52"
  },
  {
    name: "teal",
    bg: "#eaf8f6",
    bgHover: "#dcf1ee",
    text: "#14534c",
    border: "#c7e8e2",
    activeBg: "#1f9d8b"
  },
  {
    name: "purple",
    bg: "#f3efff",
    bgHover: "#ebe4ff",
    text: "#4b3472",
    border: "#d8cdf5",
    activeBg: "#7b57d1"
  },
  {
    name: "orange",
    bg: "#fff3e8",
    bgHover: "#ffe8d6",
    text: "#7a4317",
    border: "#f5d2b8",
    activeBg: "#e6842a"
  }
];

function getThemeForModule(moduleId) {
  const themes = MODULE_THEMES;

  const numericId = parseInt(moduleId, 10);

  if (Number.isFinite(numericId)) {
    return themes[Math.abs(numericId) % themes.length];
  }

  console.warn("⚠️ Invalid moduleId for theme:", moduleId);
  return themes[0];
}

function applyModuleTheme(theme) {
  if (!theme) {
    console.error("❌ Theme is undefined — using fallback");
    theme = MODULE_THEMES[0];
  }

  const root = document.documentElement;

  root.style.setProperty("--engage-btn-bg", theme.bg);
  root.style.setProperty("--engage-btn-bg-hover", theme.bgHover);
  root.style.setProperty("--engage-btn-text", theme.text);
  root.style.setProperty("--engage-btn-border", theme.border);
  root.style.setProperty("--engage-btn-active-bg", theme.activeBg);
}

// -------------------------
// Load Module JSON
// -------------------------

function loadLocalJSON(path) {
  const xhr = new XMLHttpRequest();
  xhr.open("GET", path, false); // synchronous (safe for local)
  xhr.send(null);

  if (xhr.status === 200 || xhr.status === 0) {
    return JSON.parse(xhr.responseText);
  } else {
    throw new Error("Failed to load JSON");
  }
}

// -------------------------
// Menu Section Builder
// -------------------------

function getMenuSections() {
  const sections = [];
  let visibleIndex = 0;

  let inlineQuizCount = 0;

  RuntimeState.slides.forEach((slide, slideIndex) => {

    const isQuiz =
      typeof slide.type === "string" &&
      slide.type.toLowerCase() === "quiz";

    if (isQuiz) {
      const scope = (slide.quiz_scope || "inline").toLowerCase();

      const prevSlide = RuntimeState.slides[slideIndex - 1];

      const prevIsSameQuiz =
        prevSlide &&
        prevSlide.type === "quiz" &&
        (prevSlide.quiz_scope || "inline").toLowerCase() === scope;

      // 🚫 Skip if this is NOT the first in a group
      if (prevIsSameQuiz) return;

      let displayTitle = "";

      if (scope === "inline") {
        inlineQuizCount++;
        displayTitle = `Inline Quiz ${inlineQuizCount}`;
      } else if (scope === "application") {
        displayTitle = "Application Quiz";
      } else if (scope === "final") {
        displayTitle = "Final Quiz";
      } else {
        displayTitle = "Quiz";
      }

      sections.push({
        slideIndex,
        label: `1.${visibleIndex}`,
        title: displayTitle
      });

      visibleIndex++;
      return;
    }

    // -------------------------
    // NORMAL HEADER LOGIC
    // -------------------------

    const rawHeader = slide?.header;

    if (!rawHeader || typeof rawHeader !== "string") return;

    const header = rawHeader.trim();
    if (!header) return;

    const normalized = header.toLowerCase();

    const isContinuation =
      normalized.includes("(continue)") ||
      normalized.includes("(continued)") ||
      normalized.endsWith("continue") ||
      normalized.endsWith("continued");

    if (isContinuation) return;

    sections.push({
      slideIndex,
      label: `1.${visibleIndex}`,
      title: header
    });

    visibleIndex++;
  });

  sections.push({
    slideIndex: null,
    label: "",
    title: "Disclaimer",
    special: "disclaimer"
  });

  return sections;
}

// -------------------------
// Slide Index Safety
// -------------------------

function getMaxSlideIndex() {
  return RuntimeState.slides.length - 1;
}

// -------------------------
// Navigation Setup
// -------------------------

function setupNavigation() {

  if (RuntimeState._navSetupDone) return;
  RuntimeState._navSetupDone = true;

  document.body.addEventListener("click", (event) => {

    const btn = event.target.closest("[data-nav]");
    if (!btn) return;

    // Tiny improvement:
    // only allow clicks from the actual nav shells
    if (!btn.closest("[data-nav-root]")) return;

    const action = btn.dataset.nav;

    /* -------------------------
       PREVIOUS
    ------------------------- */

    if (action === "prev") {
      if (
        RuntimeState.slides[RuntimeState.currentIndex]?.type === "quiz" &&
        (RuntimeState.slides[RuntimeState.currentIndex].quiz_scope || "inline") === "final"
      ) {

        // Move backward using cursor
        if (RuntimeState.finalCursor > 0) {
          RuntimeState.finalCursor--;
        }

        closeDrawer();
        saveProgress();
        renderSlide();
        return;
      }

      if (RuntimeState.currentIndex > 0) {
        RuntimeState.currentIndex--;
        closeDrawer();
        saveProgress();
        renderSlide();
      }

      return;
    }

    /* -------------------------
       NEXT
    ------------------------- */

    if (action === "next") {

      const resultsIndex = getResultsSlideIndex();

      // Allow moving past results if there are more slides
      if (
        RuntimeState.currentIndex === resultsIndex &&
        resultsIndex === RuntimeState.slides.length - 1
      ) {
        return;
      }

      const slide = RuntimeState.slides[RuntimeState.currentIndex];

      // Prevent skipping unanswered FINAL quiz questions
      if (slide?.type === "quiz" && (slide.quiz_scope || "inline") === "final") {

        let effectiveSlideIndex = RuntimeState.currentIndex;

        if (slide?.type === "quiz" && (slide.quiz_scope || "inline") === "final") {
          const mapped = RuntimeState.final.questionOrder?.[RuntimeState.finalCursor];
          if (typeof mapped === "number") {
            effectiveSlideIndex = mapped;
          }
        }

        const state = RuntimeState.quizState?.[effectiveSlideIndex]?.[0];

        if (!state || !state.submitted) {
          alert("Please answer the quiz question before continuing.");
          return;
        }

        // ✅ Move cursor (NOT slide index)
        RuntimeState.finalCursor++;
        console.log("NEXT CLICK -> finalCursor:", RuntimeState.finalCursor, "currentIndex:", RuntimeState.currentIndex);

        const total = RuntimeState.final.questionOrder.length;

        if (RuntimeState.finalCursor >= total) {
          RuntimeState.currentIndex = getResultsSlideIndex();
        }

        closeDrawer();
        saveProgress();
        renderSlide();
        return;
      }

      const maxIndex = getMaxSlideIndex();

      if (RuntimeState.currentIndex < maxIndex) {
        RuntimeState.currentIndex++;
        closeDrawer();
        saveProgress();
        renderSlide();
      }

      return;
    }

    /* -------------------------
      EXIT
    ------------------------- */

    if (action === "exit") {
      RuntimeBridge.exit();
      return;
    }
    
    /* -------------------------
       MENU
    ------------------------- */

    if (action === "menu") {
      openDrawer("menu");
      return;
    }

  });

}

// -------------------------
// Slide Rendering Dispatcher
// -------------------------

async function renderSlide() {

  const container = document.getElementById("slide-container");

  /* -------------------------
     FADE OUT (start)
  ------------------------- */

  container.classList.add("slide-fade-out");

  setTimeout(() => {
    (async () => {

      closeDrawer();
      document.body.style.overflow = "";

      container.innerHTML = "";
      container.scrollTop = 0;

      const resultsIndex = getResultsSlideIndex();

      if (resultsIndex !== null && RuntimeState.currentIndex === resultsIndex) {
        renderFinalResults(container);
        updateNavigationUI();
        updateDrawerActiveState();
      } else {

        const slide = RuntimeState.slides[RuntimeState.currentIndex];
        if (!slide) return;

        await dispatchSlide(slide, container);
        updateNavigationUI();
        updateDrawerActiveState();
      }

      container.classList.remove("slide-fade-out");

    })().catch(err => {
      console.error("RENDER ERROR:", err);
    });

  }, 120);// small delay = smooth but fast
}

async function dispatchSlide(slide, container) {
  switch (slide.type) {

    case "panel":
      await renderPanel(slide, container);
      break;

    case "engage_1":
      renderEngage1(slide, container);
      break;

    case "engage_2":
      renderEngage2(slide, container);
      break;

    case "quiz":
      renderQuiz(slide, container);
      break;

    default:
      renderUnknown(slide, container);
  }
}

// -------------------------
// Update Navigation UI
// -------------------------

function updateNavigationUI() {

  const prevBtns = document.querySelectorAll('[data-nav="prev"]');
  const nextBtns = document.querySelectorAll('[data-nav="next"]');
  const counters = document.querySelectorAll('[data-role="counter"]');
  const progressFills = document.querySelectorAll('[data-role="progress-fill"]');

  const maxIndex = getMaxSlideIndex();

  /* -------------------------
     PREV BUTTON STATE
  ------------------------- */

  const disablePrev = RuntimeState.currentIndex === 0;

  prevBtns.forEach(btn => {
    btn.disabled = disablePrev;
  });

  /* -------------------------
     NEXT BUTTON STATE
  ------------------------- */

  let disableNext =
    RuntimeState.currentIndex === maxIndex;

  const slide = RuntimeState.slides[RuntimeState.currentIndex] || null;

  let effectiveSlideIndex = RuntimeState.currentIndex;

  if (slide?.type === "quiz" && (slide.quiz_scope || "inline") === "final") {
    const mapped = RuntimeState.final.questionOrder?.[RuntimeState.finalCursor];

    if (typeof mapped === "number") {
      effectiveSlideIndex = mapped;
    }

    const state = RuntimeState.quizState?.[effectiveSlideIndex]?.[0];

    if (!state || !state.submitted) {
      disableNext = true;
    }
  }

  nextBtns.forEach(btn => {
    btn.disabled = disableNext;
  });

  /* -------------------------
     SLIDE COUNT
  ------------------------- */

  const resultsIndex = getResultsSlideIndex();

  const totalSlides =
    resultsIndex !== null
      ? resultsIndex + 1
      : RuntimeState.slides.length;

  counters.forEach(counter => {
    counter.textContent =
      `${RuntimeState.currentIndex + 1} / ${totalSlides}`;
  });

  /* -------------------------
     PROGRESS BAR
  ------------------------- */

  const progress =
    totalSlides > 0
      ? ((RuntimeState.currentIndex + 1) / totalSlides) * 100
      : 0;

  progressFills.forEach(fill => {

    const parent = fill.parentElement;

    if (parent.classList.contains("vertical")) {

      /* sidebar progress */
      fill.style.height = progress + "%";
      fill.style.width = "100%";

    } else {

      /* bottom bar progress */
      fill.style.width = progress + "%";
      fill.style.height = "100%";

    }

  });

}

// -------------------------
// Shared Content Block Renderer
// -------------------------

async function renderContentBlock({
  textArray = [],
  imageSrc = null,
  alt = ""
}) {
  console.log("🚨 NEW renderContentBlock version running");
  console.log("🚨 TEST CHANGE WORKED");
  // 🔥 OUTER CONTAINER (THIS controls layout)
  const container = document.createElement("div");
  container.className = "panel-content";

  // -------------------------
  // RESOURCE BUTTONS (SHARED DATA SOURCE)
  // -------------------------
  if (RuntimeState.slides[RuntimeState.currentIndex]?.header === "Additional Resources") {

    const resources = RuntimeState.resources || [];

    const buttonContainer = document.createElement("div");
    buttonContainer.style.display = "flex";
    buttonContainer.style.flexDirection = "column";
    buttonContainer.style.gap = "0.6rem";

    resources.forEach(resource => {
      if (!resource || !resource.file) return;

      const filePath = `assets/resources/${resource.file}`;
      const label = resource.label || resource.file;

      const btn = document.createElement("a");
      btn.href = filePath;
      btn.textContent = `📄 ${label}`;
      btn.target = "_blank";

      const rootStyles = getComputedStyle(document.documentElement);
      // Theme styling
      btn.style.padding = "0.75rem 1rem";
      btn.style.background = rootStyles.getPropertyValue("--engage-btn-bg");
      btn.style.color = rootStyles.getPropertyValue("--engage-btn-text");
      btn.style.border = `1px solid ${rootStyles.getPropertyValue("--engage-btn-border")}`;
      btn.style.borderRadius = "8px";
      btn.style.textDecoration = "none";
      btn.style.fontWeight = "500";
      btn.style.transition = "all 0.15s ease";
      btn.style.cursor = "pointer";

      btn.addEventListener("mouseenter", () => {
        btn.style.background = rootStyles.getPropertyValue("--engage-btn-bg-hover");
      });

      btn.addEventListener("mouseleave", () => {
        btn.style.background = rootStyles.getPropertyValue("--engage-btn-bg");
      });

      btn.addEventListener("mousedown", () => {
        btn.style.transform = "scale(0.97)";
      });

      btn.addEventListener("mouseup", () => {
        btn.style.transform = "scale(1)";
      });

      buttonContainer.appendChild(btn);
    });

    return buttonContainer;
  }

  // -------------------------
  // TEXT BLOCK
  // -------------------------
  const textBlock = document.createElement("div");
  textBlock.className = "panel-content-block";

  if (textArray.length) {
    const textWrapper = document.createElement("div");
    textWrapper.className = "engage-text";

    textArray.forEach(item => {
      if (!item) return;

      if (typeof item === "string") {
        const p = document.createElement("p");
        p.textContent = item;
        textWrapper.appendChild(p);
        return;
      }

      if (item.type === "paragraph") {
        const p = document.createElement("p");
        p.textContent = item.text;
        textWrapper.appendChild(p);
      }

      else if (item.type === "bullets") {
        const ul = document.createElement("ul");

        item.items.forEach(liText => {
          const li = document.createElement("li");
          li.textContent = liText;
          ul.appendChild(li);
        });

        textWrapper.appendChild(ul);
      }
    });

    textBlock.appendChild(textWrapper);
  }

  // Always append text
  container.appendChild(textBlock);

  // -------------------------
  // IMAGE BLOCK (SEPARATE!)
  // -------------------------
  if (imageSrc) {
    const imageBlock = document.createElement("div");
    imageBlock.className = "panel-content-block";

    const img = await createReadyImage(imageSrc, alt, "");

    const wrapper = document.createElement("div");
    wrapper.className = "image-wrapper";

    const overlay = document.createElement("div");
    overlay.className = "image-overlay";
    overlay.textContent = "Tap to expand";

    wrapper.addEventListener("click", () => {
      openImageViewer(img.src);
    });

    wrapper.appendChild(img);
    wrapper.appendChild(overlay);

    imageBlock.appendChild(wrapper);

    container.appendChild(imageBlock);
  }

  return container;
}

// -------------------------
// Panel Renderer
// -------------------------

async function renderPanel(slide, container) {
  renderHeader(slide, container);

  const contentWrapper = document.createElement("div");
  contentWrapper.className = "panel-content";

  const block = await renderContentBlock({
    textArray: slide.body || [],
    imageSrc: slide.image ? `assets/${slide.image}` : null,
    alt: slide.header || "Slide image",
    imageClass: "panel-image"
  });

  contentWrapper.appendChild(block);
  container.appendChild(contentWrapper);
}

// -------------------------
// Disclaimer Page
// -------------------------
function renderDisclaimerPage() {
  const container = document.getElementById("slide-container");
  if (!container) return;

  closeDrawer();
  document.body.style.overflow = "";
  container.innerHTML = "";
  container.scrollTop = 0;

  const wrapper = document.createElement("div");
  wrapper.className = "panel-content disclaimer-content";

  // -------------------------
  // 🔙 BACK BUTTON
  // -------------------------
  const backBtn = document.createElement("button");
  backBtn.textContent = "← Back to Module";
  backBtn.className = "drawer-resource-btn";
  backBtn.style.marginBottom = "1rem";

  backBtn.addEventListener("click", () => {
    renderSlide();
  });

  wrapper.appendChild(backBtn);

  // -------------------------
  // HEADER
  // -------------------------
  const header = document.createElement("h2");
  header.textContent = "WiRED International Disclaimer";
  wrapper.appendChild(header);

  // -------------------------
  // TEXT CONTENT
  // -------------------------
  const textBlock = document.createElement("div");
  textBlock.className = "panel-content-block";

  const textWrapper = document.createElement("div");
  textWrapper.className = "engage-text";

  const paragraphs = [
    "Some WiRED Community Health Information modules may provide links to material prepared by other institutions. These are offered as a convenience. WiRED is not responsible for the content of this material, nor does WiRED endorse, warrant or guarantee the products, services or information described or offered.",
    "It is not WiRED's intention to provide specific medical advice to users of its modules. Instead we provide information to help users better understand health issues and the current approaches related to treatment, prevention, screening, and supportive care. WiRED urges users to consult with a qualified health care professional for diagnosis and answers to their personal medical questions.",
    "Use of This Information",
    "WiRED does not charge NGOs, community groups and other not-for-profit organizations for the use of this Community Health Information database. However, any individual or group wishing to use this material must receive written permission from WiRED before the material can be copied or displayed. Moreover, no individual or group using this material may charge for access. The material from the WiRED modules may not be revised, extracted or used outside the context of the modules as they appear in the original database.",
    "Contact Information",
    "WiRED International\nP.O. Box 371132\nMontara, CA 94037\nUSA\nEmail: CHIprogram@wiredinternational.org\nWeb: www.wiredinternational.org"
  ];

  paragraphs.forEach(text => {

    // -------------------------
    // 🧠 SECTION HEADERS
    // -------------------------
    if (
      text === "Use of This Information" ||
      text === "Contact Information"
    ) {
      const h3 = document.createElement("h3");
      h3.textContent = text;
      h3.style.marginTop = "1.2rem";
      h3.style.marginBottom = "0.4rem";
      h3.style.fontWeight = "600";
      textWrapper.appendChild(h3);
      return;
    }

    // -------------------------
    // NORMAL PARAGRAPH
    // -------------------------
    const p = document.createElement("p");
    p.textContent = text;
    p.style.marginBottom = "0.75rem";
    textWrapper.appendChild(p);
  });

  textBlock.appendChild(textWrapper);
  wrapper.appendChild(textBlock);
  container.appendChild(wrapper);

  // Disable navigation buttons (clean UX)
  document.querySelectorAll('[data-nav="prev"], [data-nav="next"]').forEach(btn => {
    btn.disabled = true;
  });
}

// -------------------------
// Unknown Slide Type
// -------------------------

function renderUnknown(slide, container) {
  const msg = document.createElement("p");
  msg.textContent = `Unsupported slide type: ${slide.type}`;
  container.appendChild(msg);
}

// -------------------------
// Shared Header Renderer
// -------------------------

function renderHeader(slide, container) {
  if (!slide.header) return;

  const header = document.createElement("h2");
  header.className = "slide-header"; 
  header.textContent = slide.header;
  container.appendChild(header);
}

// -------------------------
// Image Viewer (Fullscreen)
// -------------------------

function openImageViewer(src) {
  const overlay = document.getElementById("image-viewer-overlay");
  const img = document.getElementById("image-viewer-img");

  if (!overlay || !img) return;

  img.src = src;
  overlay.classList.add("active");

  // Prevent background scroll
  document.body.style.overflow = "hidden";
}

function closeImageViewer() {
  const overlay = document.getElementById("image-viewer-overlay");
  if (!overlay) return;

  overlay.classList.remove("active");

  document.body.style.overflow = "";
}

document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("image-viewer-overlay");
  const closeBtn = document.getElementById("image-viewer-close");

  if (overlay) {
    overlay.addEventListener("click", (e) => {
      // Only close if clicking background (not image)
      if (e.target === overlay) {
        closeImageViewer();
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeImageViewer);
  }
});