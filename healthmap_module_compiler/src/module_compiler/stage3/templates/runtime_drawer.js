// runtime_drawer.js

// -------------------------
// Drawer UI State
// -------------------------

if (!window.RuntimeUI) {
  window.RuntimeUI = {
    drawerOpen: false,
    drawerInitialized: false,
    resultsShown: false, 
  };
}

// -------------------------
// Drawer Setup (Bind Once)
// -------------------------

function setupDrawer() {
  if (RuntimeUI.drawerInitialized) return;

  const closeBtn = document.getElementById("drawer-close");
  const overlay = document.getElementById("drawer-overlay");
  const content = document.getElementById("drawer-content");

  console.log("[Drawer] closeBtn:", !!closeBtn, "overlay:", !!overlay, "content:", !!content);

  if (!closeBtn || !overlay) {
    console.warn("Drawer elements missing.");
    return;
  }

  closeBtn.addEventListener("click", closeDrawer);

  // Click outside content closes drawer
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeDrawer();
    }
  });

  RuntimeUI.drawerInitialized = true;
  console.log("[Drawer] Initialized");

  // -------------------------
  // Drawer Tabs (Menu / Resources)
  // -------------------------

  const menuTab = document.getElementById("tab-menu");
  const resourcesTab = document.getElementById("tab-resources");

  if (menuTab && resourcesTab) {

    menuTab.addEventListener("click", () => {
      const content = document.getElementById("drawer-content");
      if (!content) return;

      content.innerHTML = "";
      renderDrawerMenu(content);

      menuTab.classList.add("active");
      resourcesTab.classList.remove("active");
    });

    resourcesTab.addEventListener("click", () => {
      const content = document.getElementById("drawer-content");
      if (!content) return;

      content.innerHTML = "";
      renderDrawerResources(content);

      resourcesTab.classList.add("active");
      menuTab.classList.remove("active");
    });
  }
}

// -------------------------
// Drawer Controls
// -------------------------

function openDrawer(mode = "menu") {
  const resumeOverlay = document.getElementById("resume-overlay");
  if (resumeOverlay && resumeOverlay.classList.contains("active")) {
    console.log("Drawer blocked by resume");
    return;
  }

  if (RuntimeUI.drawerOpen) {
    console.log("Already open");
    return;
  }

  const overlay = document.getElementById("drawer-overlay");
  const content = document.getElementById("drawer-content");

  if (!overlay || !content) {
    console.log("Missing overlay or content");
    return;
  }

  content.innerHTML = "";

  // ✅ NEW: mode switch
  if (mode === "menu") {
    renderDrawerMenu(content);
  } else {
    renderDrawerResources(content);
  }

  overlay.classList.add("active");
  document.body.style.overflow = "hidden";
  RuntimeUI.drawerOpen = true;
}

function closeDrawer() {
  if (!RuntimeUI.drawerOpen) return;

  const overlay = document.getElementById("drawer-overlay");
  if (!overlay) return;

  overlay.classList.remove("active");
  document.body.style.removeProperty("overflow");
  RuntimeUI.drawerOpen = false;
}

// -------------------------
// Resource Handling
// -------------------------

function getResourceUrl(resource) {
  let file = resource.file;

  if (!file.toLowerCase().endsWith(".pdf")) {
    file += ".pdf";
  }

  return `assets/resources/${file}`;
}

function isFlutterWebView() {
  return !!(
    window.flutter_inappwebview &&
    typeof window.flutter_inappwebview.callHandler === "function"
  );
}

function openResource(resource) {
  const url = getResourceUrl(resource);
  const type = (resource.type || "").toLowerCase();

  if (type === "pdf" || url.toLowerCase().endsWith(".pdf")) {
    openPdfResource(resource, url);
    return;
  }

  // fallback (future-proof)
  if (isFlutterWebView()) {
    window.flutter_inappwebview.callHandler("openGenericResource", {
      title: resource.title,
      url,
      file: resource.file,
      type: resource.type || null
    });
    return;
  }

  window.open(url, "_blank", "noopener");
}

function openPdfResource(resource, url) {
  if (isFlutterWebView()) {
    console.log("[Resource] Opening PDF via Flutter:", resource.file);

    window.flutter_inappwebview.callHandler("openPdfResource", {
      title: resource.title,
      url,
      file: resource.file,
      type: "pdf"
    });

    return;
  }

  console.log("[Resource] Opening PDF in browser:", url);
  window.open(url, "_blank", "noopener");
}

// -------------------------
// Drawer Renderer
// -------------------------

function renderDrawerResources(container) {
  console.log("renderDrawerResources CALLED", RuntimeState.resources);
  if (!Array.isArray(RuntimeState.resources) || RuntimeState.resources.length === 0) {
    const p = document.createElement("p");
    p.textContent = "No resources available.";
    container.appendChild(p);
    return;
  }

  const list = document.createElement("div");
  list.className = "drawer-resource-list";

  RuntimeState.resources.forEach(resource => {
    const item = document.createElement("div");
    item.className = "drawer-resource-item";

    const title = document.createElement("div");
    title.className = "drawer-resource-title";
    title.textContent = resource.title || resource.file;

    const actions = document.createElement("div");
    actions.className = "drawer-resource-actions";

    // View Button
    const viewBtn = document.createElement("button");
    viewBtn.textContent = "View";
    viewBtn.className = "drawer-resource-btn";
    viewBtn.type = "button";

    viewBtn.addEventListener("click", () => {
      openResource(resource);
    });

    // Download Button (browser only fallback)
    const downloadBtn = document.createElement("a");
    downloadBtn.textContent = "Download";
    downloadBtn.href = getResourceUrl(resource);
    downloadBtn.setAttribute("download", resource.file);
    downloadBtn.className = "drawer-resource-btn";

    actions.appendChild(viewBtn);
    actions.appendChild(downloadBtn);

    item.appendChild(title);
    item.appendChild(actions);

    list.appendChild(item);
  });

  container.appendChild(list);
}

// -------------------------
// Drawer Menu Renderer
// -------------------------

function renderDrawerMenu(container) {

  const sections = getMenuSections();

  if (!sections.length) {
    const p = document.createElement("p");
    p.textContent = "No sections available.";
    container.appendChild(p);
    return;
  }

  const list = document.createElement("div");
  list.className = "drawer-menu-list";

  sections.forEach(section => {

    const item = document.createElement("button");
    item.className = "drawer-menu-item";
    item.type = "button";

    const number = document.createElement("span");
    number.className = "drawer-menu-number";
    number.textContent = section.label;

    const title = document.createElement("span");
    title.className = "drawer-menu-title";
    title.textContent = section.title;

    item.appendChild(number);
    item.appendChild(title);

    // ✅ Navigation behavior
    item.addEventListener("click", () => {

      // 🔥 HANDLE DISCLAIMER (special case)
      if (section.special === "disclaimer") {
        closeDrawer();
        renderDisclaimerPage();
        return;
      }

      // Normal slide navigation
      RuntimeState.currentIndex = section.slideIndex;
      closeDrawer();
      renderSlide();
    });

    list.appendChild(item);
  });

  container.appendChild(list);
  updateDrawerActiveState();
}

// -------------------------
// Drawer Active State
// -------------------------

function updateDrawerActiveState() {
  const items = document.querySelectorAll(".drawer-menu-item");
  if (!items.length) return;

  const sections = getMenuSections();

  let activeSectionIndex = -1;

  // Find the LAST section that is <= current slide
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].slideIndex <= RuntimeState.currentIndex) {
      activeSectionIndex = i;
    } else {
      break;
    }
  }

  items.forEach((item, index) => {
    if (index === activeSectionIndex) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });
}