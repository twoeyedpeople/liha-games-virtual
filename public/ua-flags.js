(function uaFlags() {
  const ua = navigator.userAgent || "";
  const hasWebmVp9 = (() => {
    const v = document.createElement("video");
    if (!v || typeof v.canPlayType !== "function") return false;
    return Boolean(
      v.canPlayType('video/webm; codecs="vp9"') ||
      v.canPlayType('video/webm')
    );
  })();

  const isSafari = /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|OPiOS|Android/i.test(ua);
  if (isSafari || !hasWebmVp9) {
    document.documentElement.classList.add("no-alpha-webm");
  }
})();
