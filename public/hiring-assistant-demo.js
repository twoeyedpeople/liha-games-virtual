const introStage = document.getElementById("liha-demo-intro");
const videoStage = document.getElementById("liha-demo-video");
const startBtn = document.getElementById("liha-demo-start");
const doneBtn = document.getElementById("liha-demo-done");
const demoVideo = document.querySelector(".liha-demo-video-player");

let videoMilestones = new Set();

document.addEventListener("DOMContentLoaded", () => {
  if (typeof window.Analytics !== "undefined") {
    window.Analytics.logEvent("Hiring Assistant Demo", "module_start");
  }
  
  const ctaLinks = document.querySelectorAll('a[href*="contact-us"]');
  ctaLinks.forEach(link => {
    link.addEventListener("click", () => {
      if (typeof window.Analytics !== "undefined") {
        window.Analytics.logEvent("Hiring Assistant Demo", "sales_cta_click", "Contact Us");
      }
    });
  });
});

function showVideoStage() {
  introStage.classList.remove("liha-demo-stage-active");
  videoStage.classList.add("liha-demo-stage-active");
  if (demoVideo) demoVideo.play();
}

function showIntroStage() {
  videoStage.classList.remove("liha-demo-stage-active");
  introStage.classList.add("liha-demo-stage-active");
  if (demoVideo) {
    demoVideo.pause();
    demoVideo.currentTime = 0;
  }
  videoMilestones.clear();
}

startBtn.addEventListener("click", showVideoStage);
doneBtn.addEventListener("click", showIntroStage);

if (demoVideo) {
  demoVideo.addEventListener("timeupdate", () => {
    if (!demoVideo.duration) return;
    const progress = demoVideo.currentTime / demoVideo.duration;
    
    if (progress >= 0.25 && !videoMilestones.has(25)) {
      videoMilestones.add(25);
      if (typeof window.Analytics !== "undefined") window.Analytics.logEvent("Hiring Assistant Demo", "milestone_reached", "25% Video");
    }
    if (progress >= 0.50 && !videoMilestones.has(50)) {
      videoMilestones.add(50);
      if (typeof window.Analytics !== "undefined") window.Analytics.logEvent("Hiring Assistant Demo", "milestone_reached", "50% Video");
    }
    if (progress >= 0.75 && !videoMilestones.has(75)) {
      videoMilestones.add(75);
      if (typeof window.Analytics !== "undefined") window.Analytics.logEvent("Hiring Assistant Demo", "milestone_reached", "75% Video");
    }
  });
  
  demoVideo.addEventListener("ended", () => {
    if (!videoMilestones.has(100)) {
      videoMilestones.add(100);
      if (typeof window.Analytics !== "undefined") {
        window.Analytics.markModuleComplete("Hiring Assistant Demo");
        window.Analytics.logEvent("Hiring Assistant Demo", "module_complete");
      }
    }
  });
}
