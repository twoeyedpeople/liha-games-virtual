(function viewportGuard() {
  const DEFAULT_MIN_WIDTH = 1024;
  const OVERLAY_ID = "viewport-guard-overlay";

  function ensureOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.className = "viewport-guard hidden";
    overlay.setAttribute("role", "alert");
    overlay.setAttribute("aria-live", "polite");
    overlay.innerHTML = '<div class="viewport-guard-card">Maximise window to continue</div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  function updateOverlay() {
    const overlay = ensureOverlay();
    const configuredMinWidth = Number(document.body?.dataset?.viewportGuardMinWidth || DEFAULT_MIN_WIDTH);
    const isTooSmall = window.innerWidth < configuredMinWidth;
    overlay.classList.toggle("hidden", !isTooSmall);
    document.body.classList.toggle("viewport-guard-active", isTooSmall);
  }

  window.addEventListener("resize", updateOverlay);
  window.addEventListener("orientationchange", updateOverlay);
  updateOverlay();
})();
