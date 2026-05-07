(function uaFlags() {
  const userAgent = navigator.userAgent || "";
  const isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(userAgent);
  const video = document.createElement("video");
  const canPlay = (type) => Boolean(video && typeof video.canPlayType === "function" && video.canPlayType(type));
  const hasWebmVp9 = canPlay('video/webm; codecs="vp9"') || canPlay("video/webm");
  const hasHevcMp4 =
    canPlay('video/mp4; codecs="hvc1"') ||
    canPlay('video/mp4; codecs="hev1"') ||
    canPlay("video/mp4");

  if (!hasWebmVp9 && !hasHevcMp4) {
    document.documentElement.classList.add("no-side-shapes-video");
  }

  if (isSafari) {
    document.documentElement.classList.add("is-safari");
  }

  if (isSafari && hasHevcMp4) {
    document.documentElement.classList.add("use-hevc-side-shapes");

    window.addEventListener("DOMContentLoaded", () => {
      document.querySelectorAll(".side-shapes-video").forEach((sideShapesVideo) => {
        sideShapesVideo.innerHTML = '<source src="/assets/images/sideShapes.mp4" type=\'video/mp4; codecs="hvc1"\' />';
        sideShapesVideo.load();
        const playPromise = sideShapesVideo.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {});
        }
      });
    });
  }
})();
