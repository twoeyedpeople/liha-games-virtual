const copyButton = document.getElementById("copy-share-text");
const copyStatus = document.getElementById("copy-status");
const shareSource = document.getElementById("share-copy-source");

const shareText = shareSource
  ? Array.from(shareSource.querySelectorAll("p"))
      .map((paragraph) => paragraph.textContent?.trim() || "")
      .join("\n\n")
  : "";

if (copyButton && copyStatus) {
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      copyStatus.textContent = "Copied to clipboard";
      window.setTimeout(() => {
        copyStatus.textContent = "";
      }, 2400);
    } catch (_error) {
      copyStatus.textContent = "Could not copy text";
    }
  });
}
