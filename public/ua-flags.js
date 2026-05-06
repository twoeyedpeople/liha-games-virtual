(function uaFlags() {
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
})();
