const introStage = document.getElementById("liha-demo-intro");
const regionStage = document.getElementById("liha-demo-region");
const clickthroughStage = document.getElementById("liha-demo-clickthrough");
const endStage = document.getElementById("liha-demo-end");
const startBtn = document.getElementById("liha-demo-start");
const regionButtons = Array.from(document.querySelectorAll("[data-demo-region]"));
const nextBtn = document.getElementById("liha-demo-next");
const screenWrap = document.getElementById("liha-demo-screen-wrap");
const viewLink = document.querySelector(".liha-demo-view-btn");

const TOTAL_STEPS = 11;
let selectedRegion = "";
let currentStep = 0;
let autoAdvanceTimer = 0;
let completed = false;

document.addEventListener("DOMContentLoaded", () => {
  logEvent("module_start");

  regionButtons.forEach((button) => {
    button.addEventListener("click", () => selectRegion(button.dataset.demoRegion));
  });

  startBtn.addEventListener("click", () => {
    showStage(regionStage);
    logEvent("intro_complete", "Get Started");
  });

  nextBtn.addEventListener("click", () => {
    if (!selectedRegion) return;
    showStage(clickthroughStage);
    loadStep(1);
    logEvent("region_selected", selectedRegion.toUpperCase());
  });

  if (viewLink) {
    viewLink.addEventListener("click", () => {
      logEvent("sales_cta_click", "Find out more");
    });
  }
});

function selectRegion(region) {
  selectedRegion = region;
  regionButtons.forEach((button) => {
    const isSelected = button.dataset.demoRegion === region;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });
  nextBtn.disabled = false;
}

function showStage(activeStage) {
  [introStage, regionStage, clickthroughStage, endStage].forEach((stage) => {
    stage.classList.toggle("liha-demo-stage-active", stage === activeStage);
  });
}

async function loadStep(stepNumber) {
  clearTimeout(autoAdvanceTimer);
  currentStep = stepNumber;
  screenWrap.dataset.step = String(stepNumber);
  screenWrap.dataset.region = selectedRegion;
  screenWrap.innerHTML = "";
  screenWrap.setAttribute("aria-busy", "true");

  try {
    const response = await fetch(`/assets/images/demo/Step-${stepNumber}_${selectedRegion}.svg`, { cache: "force-cache" });
    if (!response.ok) throw new Error(`Step ${stepNumber} asset failed to load`);
    const svgText = await response.text();
    screenWrap.innerHTML = svgText;
    prepareSvg();
  } catch (error) {
    screenWrap.textContent = "This step could not be loaded.";
    console.error(error);
  } finally {
    screenWrap.setAttribute("aria-busy", "false");
  }
}

function prepareSvg() {
  const svg = screenWrap.querySelector("svg");
  if (!svg) {
    scheduleAutoAdvance();
    return;
  }

  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.classList.add("liha-demo-screen-svg");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Hiring Assistant demo step ${currentStep}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  const frame = wrapSvgInFrame(svg);

  const hotspot = svg.querySelector('[id="hotspot"], [id^="hotspot_"]');
  if (!hotspot) {
    scheduleAutoAdvance();
    return;
  }

  const overlayHotspot = createHotspotOverlay(svg, hotspot, frame);
  if (!overlayHotspot) {
    scheduleAutoAdvance();
    return;
  }

  overlayHotspot.addEventListener("click", advanceFromHotspot);
  overlayHotspot.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    advanceFromHotspot();
  });
}

function wrapSvgInFrame(svg) {
  const viewBoxValues = svg.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
  const frame = document.createElement("div");
  frame.className = "liha-demo-screen-frame";
  if (viewBoxValues && viewBoxValues.length === 4 && !viewBoxValues.some(Number.isNaN)) {
    frame.style.setProperty("--demo-screen-ratio", `${viewBoxValues[2]} / ${viewBoxValues[3]}`);
    frame.style.setProperty("--demo-screen-ratio-number", `${viewBoxValues[2] / viewBoxValues[3]}`);
    frame.style.setProperty("--demo-screen-scale-y", "1");
  }

  screenWrap.replaceChildren(frame);
  const mask = document.createElement("div");
  mask.className = "liha-demo-screen-mask";
  frame.appendChild(mask);
  mask.appendChild(svg);
  return frame;
}

function createHotspotOverlay(svg, hotspot, frame) {
  const viewBox = svg.getAttribute("viewBox");
  if (!viewBox) return null;

  const overlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  overlay.classList.add("liha-demo-hotspot-overlay");
  overlay.setAttribute("viewBox", viewBox);
  overlay.setAttribute("preserveAspectRatio", "xMidYMid meet");
  overlay.setAttribute("aria-hidden", "true");

  const overlayHotspot = hotspot.cloneNode(true);
  overlayHotspot.removeAttribute("id");
  overlayHotspot.classList.add("liha-demo-hotspot");
  overlayHotspot.setAttribute("role", "button");
  overlayHotspot.setAttribute("tabindex", "0");
  overlayHotspot.setAttribute("aria-label", currentStep >= TOTAL_STEPS ? "Finish demo" : "Continue to next step");

  hotspot.setAttribute("aria-hidden", "true");
  hotspot.style.visibility = "hidden";
  overlay.appendChild(overlayHotspot);
  frame.appendChild(overlay);
  return overlayHotspot;
}

function advanceFromHotspot() {
  if (currentStep >= TOTAL_STEPS) {
    showEndScreen();
    return;
  }

  loadStep(currentStep + 1);
}

function scheduleAutoAdvance() {
  autoAdvanceTimer = window.setTimeout(() => {
    if (currentStep >= TOTAL_STEPS) {
      showEndScreen();
      return;
    }
    loadStep(currentStep + 1);
  }, 1000);
}

function showEndScreen() {
  clearTimeout(autoAdvanceTimer);
  showStage(endStage);
  if (!completed && typeof window.Analytics !== "undefined") {
    completed = true;
    window.Analytics.markModuleComplete("Hiring Assistant Demo");
    logEvent("module_complete");
  }
}

function logEvent(action, label) {
  if (typeof window.Analytics === "undefined") return;
  window.Analytics.logEvent("Hiring Assistant Demo", action, label);
}
