const introStage = document.getElementById("liha-demo-intro");
const regionStage = document.getElementById("liha-demo-region");
const clickthroughStage = document.getElementById("liha-demo-clickthrough");
const endStage = document.getElementById("liha-demo-end");
const startBtn = document.getElementById("liha-demo-start");
const regionButtons = Array.from(document.querySelectorAll("[data-demo-region]"));
const nextBtn = document.getElementById("liha-demo-next");
const screenWrap = document.getElementById("liha-demo-screen-wrap");
const viewLink = document.querySelector(".liha-demo-view-btn");

const RIVE_SRC = "/assets/rive/liha-demo.riv";
const RIVE_ARTBOARD = "app";
const RIVE_STATE_MACHINE = "State Machine 1";
const RIVE_VIEW_MODEL = "MainView";
const RIVE_REGION_INSTANCES = {
  anz: "anz",
  asia: "asia",
  india: "india",
};

let selectedRegion = "";
let riveDemo = null;
let riveDemoEndedTrigger = null;
let riveResizeObserver = null;
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
    startRiveDemo();
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

function startRiveDemo() {
  screenWrap.dataset.region = selectedRegion;
  screenWrap.replaceChildren();
  screenWrap.setAttribute("aria-busy", "true");

  cleanupRiveDemo();

  if (!window.rive?.Rive) {
    showRiveError("This demo could not be loaded.");
    return;
  }

  window.rive.RuntimeLoader?.setWasmUrl?.("/vendor/rive/rive.wasm");
  window.rive.RuntimeLoader?.setWasmFallbackUrl?.("/vendor/rive/rive_fallback.wasm");

  const frame = createRiveFrame();
  const canvas = frame.querySelector("canvas");
  const layout = new window.rive.Layout({
    fit: window.rive.Fit.Contain,
    alignment: window.rive.Alignment.Center,
  });

  riveDemo = new window.rive.Rive({
    src: RIVE_SRC,
    canvas,
    artboard: RIVE_ARTBOARD,
    stateMachines: RIVE_STATE_MACHINE,
    autoplay: true,
    autoBind: false,
    layout,
    onLoad: () => {
      screenWrap.setAttribute("aria-busy", "false");
      setRiveLoading(false);
      resizeRiveCanvas();
      bindRiveRegion();
    },
    onLoadError: (error) => {
      console.error(error);
      showRiveError("This demo could not be loaded.");
    },
  });

  if (window.rive.EventType?.RiveEvent) {
    riveDemo.on(window.rive.EventType.RiveEvent, handleRiveEvent);
  }

  riveResizeObserver = new ResizeObserver(resizeRiveCanvas);
  riveResizeObserver.observe(frame);
}

function createRiveFrame() {
  const frame = document.createElement("div");
  frame.className = "liha-demo-screen-frame liha-demo-rive-frame";
  const mask = document.createElement("div");
  mask.className = "liha-demo-screen-mask";
  const canvas = document.createElement("canvas");
  canvas.className = "liha-demo-rive-canvas";
  canvas.setAttribute("aria-label", "Hiring Assistant interactive demo");
  const loader = document.createElement("div");
  loader.className = "liha-demo-rive-loader";
  loader.setAttribute("role", "status");
  loader.setAttribute("aria-label", "Loading demo");

  frame.appendChild(mask);
  mask.appendChild(canvas);
  frame.appendChild(loader);
  screenWrap.replaceChildren(frame);
  return frame;
}

function setRiveLoading(isLoading) {
  screenWrap.querySelector(".liha-demo-rive-loader")?.classList.toggle("is-hidden", !isLoading);
}

function bindRiveRegion() {
  const viewModel = riveDemo?.viewModelByName?.(RIVE_VIEW_MODEL);
  const instanceName = RIVE_REGION_INSTANCES[selectedRegion] || RIVE_REGION_INSTANCES.india;
  const viewModelInstance = viewModel?.instanceByName?.(instanceName) || viewModel?.defaultInstance?.();

  if (!viewModelInstance) {
    showRiveError("This demo could not be loaded.");
    return;
  }

  riveDemo.bindViewModelInstance(viewModelInstance);
  riveDemoEndedTrigger = viewModelInstance.trigger?.("demoEnded");
  riveDemoEndedTrigger?.on?.(showEndScreen);
  riveDemo.resizeDrawingSurfaceToCanvas();
}

function handleRiveEvent(event) {
  const eventName = event?.data?.name || event?.data?.eventName || event?.data?.properties?.name;
  if (eventName === "demoEnded") {
    showEndScreen();
  }
}

function resizeRiveCanvas() {
  riveDemo?.resizeDrawingSurfaceToCanvas?.();
}

function cleanupRiveDemo() {
  riveResizeObserver?.disconnect();
  riveResizeObserver = null;
  riveDemoEndedTrigger?.off?.(showEndScreen);
  riveDemoEndedTrigger = null;
  if (riveDemo && window.rive?.EventType?.RiveEvent) {
    riveDemo.off(window.rive.EventType.RiveEvent, handleRiveEvent);
  }
  riveDemo?.cleanup?.();
  riveDemo = null;
}

function showRiveError(message) {
  screenWrap.setAttribute("aria-busy", "false");
  setRiveLoading(false);
  screenWrap.textContent = message;
}

function showEndScreen() {
  cleanupRiveDemo();
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
