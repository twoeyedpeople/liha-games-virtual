const introStage = document.getElementById("liha-demo-intro");
const videoStage = document.getElementById("liha-demo-video");
const startBtn = document.getElementById("liha-demo-start");
const doneBtn = document.getElementById("liha-demo-done");
const demoVideo = document.querySelector(".liha-demo-video-player");

function showVideoStage() {
  introStage.classList.remove("liha-demo-stage-active");
  videoStage.classList.add("liha-demo-stage-active");
}

function showIntroStage() {
  videoStage.classList.remove("liha-demo-stage-active");
  introStage.classList.add("liha-demo-stage-active");
  if (demoVideo) {
    demoVideo.pause();
    demoVideo.currentTime = 0;
  }
}

startBtn.addEventListener("click", showVideoStage);
doneBtn.addEventListener("click", showIntroStage);
