const introStage = document.getElementById("liha-demo-intro");
const videoStage = document.getElementById("liha-demo-video");
const startBtn = document.getElementById("liha-demo-start");

function showVideoStage() {
  introStage.classList.remove("liha-demo-stage-active");
  videoStage.classList.add("liha-demo-stage-active");
}

startBtn.addEventListener("click", showVideoStage);
