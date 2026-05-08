const shareButton = document.getElementById("share-on-linkedin-btn");
const copyStatus = document.getElementById("copy-status");
const shareSource = document.getElementById("share-copy-source");

if (typeof window.Analytics !== "undefined") {
  window.Analytics.logEvent("AI Adoption Plan", "module_start");
  window.Analytics.markModuleComplete("AI Adoption Plan");
  window.Analytics.logEvent("AI Adoption Plan", "module_complete");
}

const shareText = shareSource
  ? Array.from(shareSource.querySelectorAll("p"))
      .map((paragraph) => paragraph.textContent?.trim() || "")
      .join("\n\n")
  : "";

const imageLink = "https://liha-games-virtual.vercel.app/assets/downloads/linkedin-share-badge.png";
const fullText = shareText + "\n\n" + imageLink;

if (shareButton) {
  shareButton.addEventListener("click", () => {
    if (typeof window.Analytics !== "undefined") {
      window.Analytics.logEvent("AI Adoption Plan", "advocacy_share", "LinkedIn");
    }
    const linkedInUrl = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(fullText)}`;
    window.open(linkedInUrl, "_blank");
  });
}

document.querySelectorAll('a[download]').forEach(link => {
  link.addEventListener('click', () => {
    if (typeof window.Analytics !== "undefined") {
      const fileName = link.getAttribute('download') || "file";
      window.Analytics.logEvent("AI Adoption Plan", "pdf_download", fileName);
    }
  });
});
