(function initScrollIndicators() {
  const HOST_SELECTOR = ".with-scroll-indicator";

  function ensureIndicator(host) {
    let indicator = host.querySelector(":scope > .scroll-indicator-overlay");
    if (!indicator) {
      indicator = document.createElement("div");
      indicator.className = "scroll-indicator-overlay hidden";
      indicator.innerHTML = '<span class="scroll-indicator-thumb"></span>';
      host.appendChild(indicator);
    }
    return indicator;
  }

  function updateHost(host) {
    const indicator = ensureIndicator(host);
    const thumb = indicator.querySelector(".scroll-indicator-thumb");
    if (!thumb) return;

    const total = host.scrollHeight;
    const visible = host.clientHeight;
    const maxScroll = Math.max(0, total - visible);
    const hasOverflow = maxScroll > 1;

    indicator.classList.toggle("hidden", !hasOverflow);
    if (!hasOverflow) return;

    const trackHeight = indicator.clientHeight;
    const thumbHeight = Math.max(28, Math.round((visible / total) * trackHeight));
    const maxThumbTravel = Math.max(0, trackHeight - thumbHeight);
    const progress = maxScroll > 0 ? host.scrollTop / maxScroll : 0;
    const thumbTop = Math.round(progress * maxThumbTravel);

    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translateY(${thumbTop}px)`;
  }

  function attachHost(host) {
    if (host.dataset.scrollIndicatorInit === "1") return;
    host.dataset.scrollIndicatorInit = "1";

    ensureIndicator(host);
    host.addEventListener("scroll", () => updateHost(host), { passive: true });

    if (window.ResizeObserver) {
      const resizeObserver = new ResizeObserver(() => updateHost(host));
      resizeObserver.observe(host);
    }

    const mutationObserver = new MutationObserver(() => updateHost(host));
    mutationObserver.observe(host, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    updateHost(host);
  }

  function refresh() {
    document.querySelectorAll(HOST_SELECTOR).forEach(attachHost);
    document.querySelectorAll(HOST_SELECTOR).forEach(updateHost);
  }

  window.addEventListener("resize", refresh);
  window.addEventListener("liha:layout-change", refresh);
  refresh();
})();
