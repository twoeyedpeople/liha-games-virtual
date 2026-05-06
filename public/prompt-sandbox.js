const keyEl = document.getElementById("sandbox-master-key");
const briefEl = document.getElementById("sandbox-brief");
const promptEl = document.getElementById("sandbox-prompt");
const scoreBtn = document.getElementById("sandbox-score-btn");
const errorEl = document.getElementById("sandbox-error");
const summaryEl = document.getElementById("sandbox-summary");
const rawEl = document.getElementById("sandbox-raw");
const briefPreviewEl = document.getElementById("sandbox-brief-preview");

const KEY_STORAGE = "promptArenaMasterKey";
const PROMPT_STORAGE = "promptSandboxPrompt";
const BRIEF_STORAGE = "promptSandboxBrief";

const { REGION_BRIEFS, PROMPT_BRIEF_LIST: FLAT_BRIEFS, PROMPT_BRIEF_BY_ID: BRIEF_BY_ID } = window.PROMPT_BRIEF_DATA;
const DEFAULT_BRIEF_ID = "policy-officer";
function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderBriefOptions() {
  briefEl.innerHTML = Object.values(REGION_BRIEFS)
    .map(
      (region) => `<optgroup label="${escapeHtml(region.label)}">${region.briefs
        .map((brief) => `<option value="${escapeHtml(brief.id)}">${escapeHtml(brief.title)}</option>`)
        .join("")}</optgroup>`
    )
    .join("");
}

function selectedBrief() {
  return BRIEF_BY_ID[briefEl.value] || BRIEF_BY_ID[DEFAULT_BRIEF_ID] || FLAT_BRIEFS[0];
}

keyEl.value = sessionStorage.getItem(KEY_STORAGE) || "";
promptEl.value = localStorage.getItem(PROMPT_STORAGE) || "";
renderBriefOptions();
briefEl.value = BRIEF_BY_ID[localStorage.getItem(BRIEF_STORAGE)] ? localStorage.getItem(BRIEF_STORAGE) : DEFAULT_BRIEF_ID;

function showError(message = "") {
  errorEl.textContent = message;
}

function renderBriefPreview() {
  if (!briefPreviewEl) return;
  const brief = selectedBrief();
  briefPreviewEl.innerHTML = `<strong>${escapeHtml(brief.region)} | ${escapeHtml(brief.title)} brief</strong>
  <p class="tiny-note" style="margin:6px 0 0; white-space:pre-wrap;">${escapeHtml(brief.subcopy)}</p>`;
}

async function scorePrompt() {
  showError("");
  summaryEl.classList.add("hidden");

  const masterKey = keyEl.value.trim();
  const brief = briefEl.value;
  const prompt = promptEl.value;

  if (!masterKey) {
    showError("Master key is required.");
    return;
  }
  if (!prompt.trim()) {
    showError("Prompt is required.");
    return;
  }

  sessionStorage.setItem(KEY_STORAGE, masterKey);
  localStorage.setItem(PROMPT_STORAGE, prompt);
  localStorage.setItem(BRIEF_STORAGE, brief);

  scoreBtn.disabled = true;
  scoreBtn.textContent = "Scoring...";

  try {
    const res = await fetch("/api/master/prompt-sandbox", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-master-key": masterKey,
      },
      body: JSON.stringify({ prompt, brief }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || `Request failed (${res.status})`);
    }

    summaryEl.classList.remove("hidden");
    summaryEl.innerHTML = `<div class="master-section" style="padding:12px 14px;">
      <strong>Role:</strong> ${escapeHtml(data.roleTitle)} &nbsp; | &nbsp;
      <strong>Brief ID:</strong> ${escapeHtml(data.brief)} &nbsp; | &nbsp;
      <strong>Engine:</strong> ${escapeHtml(data.engine)} &nbsp; | &nbsp;
      <strong>Raw:</strong> ${escapeHtml(data.rawScore)}% &nbsp; | &nbsp;
      <strong>Curved:</strong> ${escapeHtml(data.curvedScore)}% &nbsp; | &nbsp;
      <strong>Status:</strong> ${data.failed ? `Fail (&lt;${escapeHtml(data.passThreshold || 80)} raw)` : "Pass"}
    </div>`;

    rawEl.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    showError(err.message || "Could not score prompt.");
  } finally {
    scoreBtn.disabled = false;
    scoreBtn.textContent = "Score Prompt";
  }
}

scoreBtn.addEventListener("click", scorePrompt);
briefEl.addEventListener("change", () => {
  localStorage.setItem(BRIEF_STORAGE, briefEl.value);
  renderBriefPreview();
});
renderBriefPreview();
