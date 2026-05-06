const REGION_BRIEFS = window.PROMPT_BRIEF_DATA.REGION_BRIEFS;

const PROMPT_MAX_CHARS = 2000;
const PROMPT_WARN_CHARS = 1700;

const state = {
  region: "",
  selectedBrief: "",
  prompt: "",
  lastScore: 0,
  lastFeedback: "",
  sectionScores: {},
  sectionComments: {},
  isProcessing: false,
};

const stages = {
  intro: document.getElementById("stage-intro"),
  regionPick: document.getElementById("stage-region-pick"),
  briefPick: document.getElementById("stage-brief-pick"),
  brief: document.getElementById("stage-brief"),
  prompt: document.getElementById("stage-prompt"),
  processing: document.getElementById("stage-processing"),
  result: document.getElementById("stage-result"),
};

const globalError = document.getElementById("global-error");
const regionCards = [...document.querySelectorAll("[data-region-choice]")];
const regionNextBtn = document.getElementById("region-next-btn");
const briefChoiceGrid = document.getElementById("brief-choice-grid");
const briefPickBackBtn = document.getElementById("brief-pick-back-btn");
const briefBackBtn = document.getElementById("brief-back-btn");
const promptBackBtn = document.getElementById("prompt-back-btn");
const confirmBriefBtn = document.getElementById("confirm-brief-btn");
const jobBriefTitle = document.getElementById("job-brief-role-name");
const jobBriefSubcopy = document.getElementById("job-brief-subcopy");
const playerSummary = document.getElementById("player-summary");
const promptInputEl = document.getElementById("prompt-input");
const promptCharCountEl = document.getElementById("prompt-char-count");
const promptCharNoteEl = document.querySelector(".prompt-char-note");
const submitBtn = document.getElementById("submit-prompt");
const submitResult = document.getElementById("submit-result");
const resultTitle = document.getElementById("result-title");
const ringScore = document.getElementById("ring-score");
const resultSubcopy = document.getElementById("result-subcopy");
const resultDotRole = document.getElementById("result-dot-role");
const resultDotContext = document.getElementById("result-dot-context");
const resultDotResponsibilities = document.getElementById("result-dot-responsibilities");
const resultCopyRole = document.getElementById("result-copy-role");
const resultCopyContext = document.getElementById("result-copy-context");
const resultCopyResponsibilities = document.getElementById("result-copy-responsibilities");
const resultRatingRole = document.getElementById("result-rating-role");
const resultRatingContext = document.getElementById("result-rating-context");
const resultRatingResponsibilities = document.getElementById("result-rating-responsibilities");
const resultNextBtn = document.getElementById("result-next-btn");
const resultNextLabel = document.getElementById("result-next-label");
const resultStage = document.getElementById("stage-result");
const resultFooter = document.getElementById("result-footer");
const resultDoneBtn = document.getElementById("result-done-btn");

function setStage(name) {
  Object.values(stages).forEach((stage) => stage.classList.add("hidden"));
  stages[name].classList.remove("hidden");
}

function currentBriefs() {
  return REGION_BRIEFS[state.region]?.briefs || [];
}

function currentBrief() {
  return currentBriefs().find((brief) => brief.id === state.selectedBrief) || currentBriefs()[0] || null;
}

function showError(message = "") {
  globalError.textContent = message;
}

function renderRegionCards() {
  regionCards.forEach((card) => {
    const selected = card.dataset.regionChoice === state.region;
    card.classList.toggle("is-selected", selected);
    card.setAttribute("aria-pressed", selected ? "true" : "false");
  });
  regionNextBtn.disabled = !state.region;
}

function renderBriefChoices() {
  briefChoiceGrid.innerHTML = currentBriefs()
    .map(
      (brief) => `
        <button type="button" class="brief-choice${brief.id === state.selectedBrief ? " active" : ""}" data-brief-choice="${brief.id}" aria-pressed="${brief.id === state.selectedBrief ? "true" : "false"}">
          ${brief.title}
        </button>
      `
    )
    .join("");

  briefChoiceGrid.querySelectorAll("[data-brief-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      showError("");
      state.selectedBrief = button.dataset.briefChoice || "";
      renderBriefChoices();
      updateJobBriefContent();
    });
  });
}

function formatBriefHtml(text) {
  const blocks = String(text || "")
    .split("\n\n")
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      if (block.startsWith("- ")) {
        const items = block.split("\n").map((line) => line.replace(/^- /, "").trim());
        return `<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
      }

      if (block.includes("\n- ")) {
        const [head, ...rest] = block.split("\n");
        const items = rest.map((line) => line.replace(/^- /, "").trim());
        return `<p><strong>${head}</strong></p><ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`;
      }

      if (block.endsWith(":")) {
        return `<p><strong>${block}</strong></p>`;
      }

      return `<p>${block}</p>`;
    })
    .join("");
}

function updateJobBriefContent() {
  const brief = currentBrief();
  if (!brief) return;
  jobBriefTitle.textContent = brief.title;
  playerSummary.textContent = brief.title;
  jobBriefSubcopy.innerHTML = formatBriefHtml(brief.subcopy);
}

function updatePromptCharCounter() {
  if (!promptInputEl || !promptCharCountEl) return;
  const count = promptInputEl.value.length;
  promptCharCountEl.textContent = `${count}/${PROMPT_MAX_CHARS}`;
  const nearLimit = count >= PROMPT_WARN_CHARS;
  promptCharCountEl.classList.toggle("is-warning", nearLimit);
  promptCharNoteEl.classList.toggle("show-count", nearLimit);
}

function sectionTone(score) {
  if (score >= 100) return "good";
  if (score > 0) return "mid";
  return "bad";
}

function sectionRating(score) {
  if (score >= 100) return "All present";
  if (score >= 50) return "Partially present";
  return "Missing";
}

function resultCaption(score) {
  if (score >= 80) return '"You prompt like a pro"';
  return '"Ouch. Try again"';
}

function resultTone(score) {
  if (score >= 80) return "success";
  return "fail";
}

function canonicalSectionKey(id, title) {
  const normalizedId = String(id || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (normalizedId === "role_details" || normalizedId === "role") return "role";
  if (normalizedId === "context") return "context";
  if (normalizedId === "responsibilities" || normalizedId === "responsibility") return "responsibilities";

  const normalizedTitle = String(title || "").trim().toLowerCase();
  if (normalizedTitle.includes("role")) return "role";
  if (normalizedTitle.includes("context")) return "context";
  if (normalizedTitle.includes("responsibil")) return "responsibilities";

  return "";
}

function formatMissingItemLabel(value) {
  return String(value || "")
    .replace(/\s+\d+$/g, "")
    .trim()
    .toLowerCase();
}

function missingItemsForSection(scored, key) {
  const metric = (Array.isArray(scored?.metrics) ? scored.metrics : []).find(
    (item) => canonicalSectionKey(item?.id, item?.title) === key
  );
  const checklist = Array.isArray(metric?.checklist) ? metric.checklist : [];
  return checklist
    .filter((item) => item && item.present !== true)
    .map((item) => formatMissingItemLabel(item.item || item.title || item.name))
    .filter(Boolean);
}

function friendlyMissingTip(scored, scores) {
  const candidates = [
    { key: "role", label: "role details", score: Number(scores?.role) || 0 },
    { key: "context", label: "context", score: Number(scores?.context) || 0 },
    { key: "responsibilities", label: "responsibilities", score: Number(scores?.responsibilities) || 0 },
  ]
    .map((section) => ({ ...section, missing: missingItemsForSection(scored, section.key) }))
    .filter((section) => section.score < 100 && section.missing.length)
    .sort((a, b) => a.score - b.score);

  const section = candidates[0];
  if (!section) {
    return "Why don't you try adding clearer sourcing constraints and output instructions?";
  }

  const first = section.missing[0];
  const second = section.missing[1];
  const detail = second ? `'${first}' and '${second}'` : `'${first}'`;

  if (section.key === "responsibilities") {
    return `Why don't you try including ${detail}? It gives the AI clearer role priorities.`;
  }

  return `Why don't you try including info about ${detail}? It helps the AI target stronger candidates.`;
}

function renderResult(scored) {
  const score = Math.max(0, Math.min(100, Number(scored?.curvedScore) || 0));
  const tone = resultTone(score);
  const successful = tone === "success";
  const comments = scored?.sectionComments || {};
  const scores = scored?.sectionScores || {};

  ringScore.textContent = `${score}%`;
  resultTitle.textContent = resultCaption(score);
  resultSubcopy.textContent = successful
    ? String(scored?.feedback || "").trim()
    : friendlyMissingTip(scored, scores);

  [
    [resultDotRole, resultCopyRole, resultRatingRole, "role", "Include employment type, role, location, seniority, hybrid/onsite/remote."],
    [resultDotContext, resultCopyContext, resultRatingContext, "context", "Include experience, critical skills, certifications and expected knowledge."],
    [resultDotResponsibilities, resultCopyResponsibilities, resultRatingResponsibilities, "responsibilities", "Detail 2 or 3 responsibilities critical for performance."],
  ].forEach(([dot, copy, rating, key, fallback]) => {
    const value = Math.max(0, Math.min(100, Number(scores[key]) || 0));
    dot.dataset.tone = sectionTone(value);
    copy.textContent = comments[key] || fallback;
    rating.textContent = sectionRating(value);
  });

  resultStage.classList.remove("result-tone-success", "result-tone-warn", "result-tone-fail");
  resultStage.classList.add(`result-tone-${tone}`);

  resultNextLabel.textContent = "Try again";
  resultDoneBtn.classList.toggle("hidden", !successful);
  if (successful) {
    resultFooter.dataset.mode = "complete";
  } else {
    resultFooter.dataset.mode = "try-again";
  }
}

function resetExperience() {
  showError("");
  state.region = "";
  state.selectedBrief = "";
  state.prompt = "";
  state.lastScore = 0;
  state.lastFeedback = "";
  state.sectionScores = {};
  state.sectionComments = {};
  promptInputEl.value = "";
  submitResult.textContent = "";
  updatePromptCharCounter();
  renderRegionCards();
  setStage("intro");
}

async function copyBriefToClipboard() {
  const brief = currentBrief();
  if (!brief) return;
  await navigator.clipboard.writeText(brief.subcopy);
}

async function submitPrompt() {
  showError("");
  submitResult.textContent = "";

  const prompt = promptInputEl.value.trim();
  if (!prompt) {
    showError("Prompt is required.");
    return;
  }

  state.isProcessing = true;
  setStage("processing");
  const startedAt = Date.now();

  try {
    const response = await fetch("/api/prompt-like-a-pro/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, brief: state.selectedBrief }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || "Could not score prompt.");
    }
    state.lastScore = payload.curvedScore || 0;
    state.lastFeedback = payload.feedback || "";
    state.sectionScores = payload.sectionScores || {};
    state.sectionComments = payload.sectionComments || {};
    renderResult(payload);
  } catch (error) {
    showError(error.message);
    setStage("prompt");
    return;
  } finally {
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, 1400 - elapsed);
    if (remaining) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
    state.isProcessing = false;
  }

  setStage("result");
}

document.getElementById("intro-get-started").addEventListener("click", () => {
  showError("");
  setStage("regionPick");
});

regionCards.forEach((card) => {
  card.addEventListener("click", () => {
    state.region = card.dataset.regionChoice || "";
    state.selectedBrief = "";
    renderRegionCards();
  });
});

regionNextBtn.addEventListener("click", () => {
  if (!state.region) {
    showError("Please select a region to continue.");
    return;
  }
  state.selectedBrief = currentBriefs()[0]?.id || "";
  renderBriefChoices();
  updateJobBriefContent();
  setStage("briefPick");
});

briefPickBackBtn.addEventListener("click", () => {
  showError("");
  state.selectedBrief = "";
  setStage("regionPick");
});

confirmBriefBtn.addEventListener("click", () => {
  if (!state.selectedBrief) {
    showError("Please pick a brief to continue.");
    return;
  }
  updateJobBriefContent();
  setStage("brief");
});

briefBackBtn.addEventListener("click", () => {
  showError("");
  renderBriefChoices();
  setStage("briefPick");
});

document.getElementById("ready-to-prompt").addEventListener("click", () => {
  setStage("prompt");
});

promptBackBtn.addEventListener("click", () => {
  showError("");
  updateJobBriefContent();
  setStage("brief");
});

document.getElementById("view-brief-btn").addEventListener("click", () => {
  setStage("brief");
});

document.getElementById("copy-brief-btn").addEventListener("click", () => {
  copyBriefToClipboard().catch(() => {
    showError("Could not copy the brief.");
  });
});

document.getElementById("submit-prompt").addEventListener("click", () => {
  submitPrompt();
});

resultNextBtn.addEventListener("click", () => {
  setStage("prompt");
});

resultDoneBtn.addEventListener("click", resetExperience);

promptInputEl.addEventListener("input", updatePromptCharCounter);
updatePromptCharCounter();
renderRegionCards();
setStage("intro");
