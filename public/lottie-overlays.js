(function () {
  const BIG_ANIM_PATH = "/assets/animations/bigConfetti.json";
  const SMALL_ANIM_PATH = "/assets/animations/smallConfetti.json";
  const ROOT_ID = "liha-lottie-overlay-root";
  const BIG_HOST_ID = "liha-lottie-big-host";

  let rootEl = null;
  let bigHostEl = null;
  let bigAnim = null;
  let lastBigPlayAt = 0;
  const BIG_PLAY_COOLDOWN_MS = 7000;

  function ensureRoot() {
    if (rootEl && bigHostEl) return;
    rootEl = document.getElementById(ROOT_ID);
    if (!rootEl) {
      rootEl = document.createElement("div");
      rootEl.id = ROOT_ID;
      rootEl.className = "liha-lottie-overlay-root";
      document.body.appendChild(rootEl);
    }

    bigHostEl = document.getElementById(BIG_HOST_ID);
    if (!bigHostEl) {
      bigHostEl = document.createElement("div");
      bigHostEl.id = BIG_HOST_ID;
      bigHostEl.className = "liha-lottie-big-host";
      rootEl.appendChild(bigHostEl);
    }
  }

  function canPlay() {
    return typeof window.lottie !== "undefined";
  }

  function playBig() {
    ensureRoot();
    if (!canPlay()) return;
    const now = Date.now();
    if (bigAnim) return;
    if (now - lastBigPlayAt < BIG_PLAY_COOLDOWN_MS) return;
    lastBigPlayAt = now;

    bigAnim = window.lottie.loadAnimation({
      container: bigHostEl,
      renderer: "svg",
      loop: false,
      autoplay: true,
      path: BIG_ANIM_PATH,
      rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
    });

    bigAnim.addEventListener("complete", () => {
      if (!bigAnim) return;
      bigAnim.destroy();
      bigAnim = null;
      bigHostEl.innerHTML = "";
    });
  }

  function playSmallOnElement(el) {
    if (!el) return;
    ensureRoot();
    if (!canPlay()) return;

    const rect = el.getBoundingClientRect();
    const host = document.createElement("div");
    host.className = "liha-lottie-small-host";

    const size = Math.max(82, Math.min(150, rect.height * 1.45));
    const x = rect.left + rect.width * 0.72 - size / 2;
    const y = rect.top + rect.height * 0.22 - size / 2;

    host.style.width = `${size}px`;
    host.style.height = `${size}px`;
    host.style.left = `${x}px`;
    host.style.top = `${y}px`;
    rootEl.appendChild(host);

    const anim = window.lottie.loadAnimation({
      container: host,
      renderer: "svg",
      loop: false,
      autoplay: true,
      path: SMALL_ANIM_PATH,
      rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
    });

    anim.addEventListener("complete", () => {
      anim.destroy();
      host.remove();
    });
  }

  window.LihaLottie = {
    playBig,
    playSmallOnElement,
  };
})();
