const scrollTrigger = document.getElementById("scroll-to-activities");
const activities = document.getElementById("activities");

if (scrollTrigger && activities) {
  scrollTrigger.addEventListener("click", () => {
    activities.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

if (typeof window.Analytics !== "undefined") {
  window.Analytics.logEvent("Landing Page", "session_start");
}
