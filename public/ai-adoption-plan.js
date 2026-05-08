const shareButton = document.getElementById("share-on-linkedin-btn");
const copyStatus = document.getElementById("copy-status");
const shareSource = document.getElementById("share-copy-source");

const shareText = shareSource
  ? Array.from(shareSource.querySelectorAll("p"))
      .map((paragraph) => paragraph.textContent?.trim() || "")
      .join("\n\n")
  : "";

const imageLink = "https://liha-games-virtual.vercel.app/assets/downloads/linkedin-share-badge.png";
const fullText = shareText + "\n\n" + imageLink;

if (shareButton) {
  shareButton.addEventListener("click", () => {
    const linkedInUrl = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(fullText)}`;
    window.open(linkedInUrl, "_blank");
  });
}
