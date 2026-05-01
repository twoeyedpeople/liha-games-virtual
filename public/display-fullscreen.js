(function displayFullscreen() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("fullscreen") !== "1") return;

  function addFallbackButton() {
    if (document.getElementById("display-fullscreen-btn")) return;
    const btn = document.createElement("button");
    btn.id = "display-fullscreen-btn";
    btn.type = "button";
    btn.textContent = "Enter Fullscreen";
    btn.style.position = "fixed";
    btn.style.top = "16px";
    btn.style.right = "16px";
    btn.style.zIndex = "9999";
    btn.style.padding = "10px 14px";
    btn.style.border = "0";
    btn.style.borderRadius = "999px";
    btn.style.background = "#ffffff";
    btn.style.color = "#11264d";
    btn.style.fontWeight = "700";
    btn.style.cursor = "pointer";
    btn.addEventListener("click", () => {
      requestFullscreen().then((ok) => {
        if (ok) btn.remove();
      });
    });
    document.body.appendChild(btn);
  }

  async function requestFullscreen() {
    if (document.fullscreenElement || !document.documentElement.requestFullscreen) return true;
    try {
      await document.documentElement.requestFullscreen();
      return true;
    } catch (_) {
      return false;
    }
  }

  function handleFullscreenChange() {
    if (document.fullscreenElement) {
      document.getElementById("display-fullscreen-btn")?.remove();
    } else {
      addFallbackButton();
    }
  }

  requestAnimationFrame(() => {
    requestFullscreen().then((ok) => {
      if (!ok) addFallbackButton();
    });
  });

  window.addEventListener("fullscreenchange", handleFullscreenChange);
})();
