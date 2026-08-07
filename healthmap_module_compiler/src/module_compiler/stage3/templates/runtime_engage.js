// -------------------------
// Engage 1 Renderer
// -------------------------

function renderEngage1(slide, container) {
  renderHeader(slide, container);

  const wrapper = document.createElement("div");
  wrapper.className = "engage1-wrapper";

  const layout = document.createElement("div");
  layout.className = "engage1-layout";

  const leftColumn = document.createElement("div");
  leftColumn.className = "engage1-left";

  const rightColumn = document.createElement("div");
  rightColumn.className = "engage1-right";

  const buttonContainer = document.createElement("div");
  buttonContainer.className = "engage1-buttons";

  const introArea = document.createElement("div");
  introArea.className = "engage1-intro";

  const detailArea = document.createElement("div");
  detailArea.className = "engage1-content";

  const imageArea = document.createElement("div");
  imageArea.className = "engage1-image-area";

  const items = Array.isArray(slide.items) ? slide.items : [];

  async function renderIntro() {

    // -------------------------
    // Intro Text
    // -------------------------

    const nextContent = document.createDocumentFragment();

    const wrapper = document.createElement("div");
    wrapper.className = "engage-fade-in";

    const block = document.createElement("div");
    block.className = "engage-content-block";

    const introBlock = await renderContentBlock({
      textArray: slide.intro || [],
      imageSrc: null,
      alt: "Intro image",
      itemPdf: slide.intro_pdf || null
    });

    block.appendChild(introBlock);

    wrapper.appendChild(block);
    nextContent.appendChild(wrapper);

    replaceContent(introArea, nextContent);

    // -------------------------
    // Persistent Landscape Image
    // -------------------------

    imageArea.innerHTML = "";

    if (slide.intro_image) {

      const img = await createReadyImage(
        `assets/${slide.intro_image}`,
        "Intro image",
        "engage1-side-image"
      );

      imageArea.appendChild(img);
    }
  }

  items.forEach((item, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = item.label || `Item ${index + 1}`;
    btn.className = "engage1-btn";

    btn.addEventListener("click", async () => {
      await renderEngage1Item(item, detailArea);

      buttonContainer.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      window.scrollBy({
        top: -40,
        behavior: "smooth"
      });

      Array.from(buttonContainer.children).forEach(b =>
        b.classList.remove("active")
      );
      btn.classList.add("active");
    });

    buttonContainer.appendChild(btn);
  });

  leftColumn.appendChild(introArea);
  leftColumn.appendChild(buttonContainer);
  leftColumn.appendChild(detailArea);

  rightColumn.appendChild(imageArea);

  layout.appendChild(leftColumn);
  layout.appendChild(rightColumn);

  wrapper.appendChild(layout);

  container.appendChild(wrapper);

  renderIntro();
}

// -------------------------
// Render Engage1 Item Content
// -------------------------

async function renderEngage1Item(item, contentArea) {
  const nextContent = document.createDocumentFragment();

  const wrapper = document.createElement("div");
  wrapper.className = "engage-fade-in";

  const block = document.createElement("div");
  block.className = "engage-content-block";

  const contentBlock = await renderContentBlock({
  textArray: item.text || [],
  imageSrc: item.image ? `assets/${item.image}` : null,
  alt: item.label || "Item image",
  itemPdf: item.pdf || null
});

  block.appendChild(contentBlock);

  wrapper.appendChild(block);
  nextContent.appendChild(wrapper);

  replaceContent(contentArea, nextContent);
}

// -------------------------
// Engage 2 Renderer
// -------------------------

function renderEngage2(slide, container) {
  renderHeader(slide, container);

  const slideIndex = RuntimeState.currentIndex;
  const engage = ensureEngageState(slideIndex);

  const mode = slide.mode || "build";
  const isReplaceMode = mode === "replace";

  const wrapper = document.createElement("div");
  wrapper.className = "engage2-wrapper";

  const layout = document.createElement("div");
  layout.className = "engage2-layout";

  const left = document.createElement("div");
  left.className = "engage2-left";

  const introArea = document.createElement("div");
  introArea.className = "engage2-intro";

  const right = document.createElement("div");
  right.className = "engage2-right";

  const imageArea = document.createElement("div");
  imageArea.className = "engage2-image-area";

  // Intro (async-safe image)
  async function renderIntro() {

    const introBlock = await renderContentBlock({
      textArray: slide.intro || [],
      imageSrc: null,
      alt: "Intro image"
    });

    introArea.replaceChildren(introBlock);

    imageArea.innerHTML = "";

    if (slide.intro_image) {

      const img = await createReadyImage(
        `assets/${slide.intro_image}`,
        "Intro image",
        "engage2-side-image"
      );

      imageArea.appendChild(img);
    }

  }

  // Previous Button
  const prevLayerBtn = document.createElement("button");
  prevLayerBtn.type = "button";
  prevLayerBtn.textContent = "Previous";
  prevLayerBtn.className = "engage2-btn";

  // Reveal Button
  const revealBtn = document.createElement("button");
  revealBtn.type = "button";
  revealBtn.textContent = slide.button_label || "Continue";
  revealBtn.className = "engage2-btn";

  // Content Stack Area
  const stackArea = document.createElement("div");
  stackArea.className = "engage2-stack";

  const layers = Array.isArray(slide.layers) ? slide.layers : [];

  // -------------------------
  // Restore State
  // -------------------------

  if (typeof engage.currentLayer !== "number") {
    engage.currentLayer = 0;
  }

  if (typeof engage.revealedCount !== "number") {
    engage.revealedCount = 0;
  }

  let currentLayerIndex = Math.min(
    engage.currentLayer,
    layers.length
  );

  let revealedCount = Math.min(
    engage.revealedCount,
    layers.length
  );

  async function restoreLayers() {

    // -------------------------
    // Replace Mode
    // -------------------------

    if (isReplaceMode) {

      if (
        currentLayerIndex > 0 &&
        currentLayerIndex <= layers.length
      ) {
        await showReplaceLayer(
          layers[currentLayerIndex - 1],
          stackArea
        );
      }

      return;
    }

    // -------------------------
    // Build Mode (existing behavior)
    // -------------------------

    for (let i = 0; i < revealedCount; i++) {
      await appendEngage2Layer(layers[i], stackArea);
    }

    if (currentLayerIndex >= layers.length) {
      revealBtn.disabled = true;
    }

  }

  // -------------------------
  // Update Button State
  // -------------------------

  function updateButtonState() {

    if (!isReplaceMode) {
      return;
    }

    prevLayerBtn.disabled = currentLayerIndex <= 1;

    const buttonLabel =
      currentLayerIndex >= layers.length
        ? "Finish"
        : (slide.button_label || "Continue");

    revealBtn.textContent = buttonLabel;

    engage2Status.innerHTML = "";

  }

  revealBtn.addEventListener("click", async () => {

    if (mode === "build") {

      if (currentLayerIndex >= layers.length) return;

      revealBtn.disabled = true;

      await appendEngage2Layer(layers[currentLayerIndex], stackArea);
      engage2Controls.scrollIntoView({
        behavior: "smooth",
        block: "end"
      });
      currentLayerIndex++;

      engage.currentLayer = currentLayerIndex;
      engage.revealedCount = currentLayerIndex;

      if (currentLayerIndex >= layers.length) {

        engage.completed = true;

        saveProgress();

        revealBtn.style.display = "none";

        const completeMsg = document.createElement("div");
        completeMsg.className = "engage2-complete-message";
        completeMsg.textContent =
          "✓ Section complete. You may continue.";

        stackArea.appendChild(completeMsg);

        updateNavigationUI();

        return;
      }

      saveProgress();

      revealBtn.disabled = false;

      return;
    }

    if (mode === "replace") {

      if (currentLayerIndex >= layers.length) {

        engage.completed = true;

        engage2Status.innerHTML = "";

        saveProgress();

        revealBtn.style.display = "none";
        prevLayerBtn.style.display = "none";

        const completeMsg = document.createElement("div");
        completeMsg.className = "engage2-complete-message";
        completeMsg.textContent = "✓ Section complete. You may continue.";

        stackArea.appendChild(completeMsg);

        updateNavigationUI();

        return;
      }

      revealBtn.disabled = true;

      await showReplaceLayer(
        layers[currentLayerIndex],
        stackArea
      );

      currentLayerIndex++;

      engage.currentLayer = currentLayerIndex;

      saveProgress();

      updateButtonState();

      revealBtn.disabled = false;

      return;
    }

  });

  prevLayerBtn.addEventListener("click", async () => {

    // Build mode doesn't use Previous
    if (!isReplaceMode) {
      return;
    }

    // Already at the first layer
    if (currentLayerIndex <= 1) {
      return;
    }

    currentLayerIndex--;

    engage.currentLayer = currentLayerIndex;

    await showReplaceLayer(
      layers[currentLayerIndex - 1],
      stackArea
    );

    saveProgress();
    updateButtonState();

  });

  const engage2Controls = document.createElement("div");
  engage2Controls.className = "engage2-controls";

  engage2Controls.appendChild(prevLayerBtn);
  engage2Controls.appendChild(revealBtn);

  if (!isReplaceMode) {
    prevLayerBtn.style.display = "none";
  }

  const engage2Status = document.createElement("div");
  engage2Status.className = "engage2-status";

  updateButtonState();

  left.appendChild(introArea);
  left.appendChild(engage2Status);
  left.appendChild(stackArea);
  left.appendChild(engage2Controls);

  right.appendChild(imageArea);

  layout.appendChild(left);
  layout.appendChild(right);

  wrapper.appendChild(layout);

  container.appendChild(wrapper);

  // IMPORTANT: Run async flow in order to prevent flicker
  (async () => {

    await renderIntro();

    if (mode === "build") {

      await restoreLayers();

      if (typeof engage.revealedCount !== "number") {
        engage.revealedCount = revealedCount;
        saveProgress();
      }

    }
    else if (mode === "replace") {

      console.log("Engage 2 Replace mode");

      // Temporary:
      // For now, use the existing Build behavior.
      // We'll replace this in the next step.
      await restoreLayers();

      if (typeof engage.revealedCount !== "number") {
        engage.revealedCount = revealedCount;
        saveProgress();
      }

    }

  })();
}

// -------------------------
// Append Engage2 Layer
// -------------------------

async function appendEngage2Layer(layer, stackArea) {
  const layerWrapper = document.createElement("div");
  layerWrapper.className = "engage2-layer engage-fade-in";

  const block = await renderContentBlock({
    textArray: layer.body || [],
    imageSrc: layer.image ? `assets/${layer.image}` : null,
    alt: "Layer image",
    imageClass: "engage2-image"
  });

  layerWrapper.appendChild(block);
  stackArea.appendChild(layerWrapper);
 
}

// -------------------------
// Show Replace Layer
// -------------------------

async function showReplaceLayer(layer, stackArea) {

  const layerWrapper = document.createElement("div");
  layerWrapper.className = "engage2-layer engage-fade-in";

  const block = await renderContentBlock({
    textArray: layer.body || [],
    imageSrc: layer.image ? `assets/${layer.image}` : null,
    alt: "Layer image"
  });

  layerWrapper.appendChild(block);

  stackArea.replaceChildren(layerWrapper);

}

// -------------------------
// Helpers
// -------------------------

async function replaceContent(container, newContent) {
  // 1. Lock current height
  const startHeight = container.offsetHeight;
  container.style.height = startHeight + "px";

  // 2. Replace content (invisible to user because height is locked)
  container.replaceChildren(newContent);

  // 3. Wait for next frame so DOM updates
  await new Promise(requestAnimationFrame);

  // 4. Measure new height
  const endHeight = container.scrollHeight;

  // 5. Animate height change
  container.style.transition = "height 0.25s ease";
  container.style.height = endHeight + "px";

  // 6. Cleanup after animation
  setTimeout(() => {
    container.style.height = "";
    container.style.transition = "";
  }, 250);
}

function createReadyImage(src, alt, className) {
  return new Promise((resolve) => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = alt || "";
    if (className) img.className = className;

    img.onload = () => resolve(img);
    img.onerror = () => resolve(img);

    // fallback in case onload never fires
    setTimeout(() => resolve(img), 500);
  });
}