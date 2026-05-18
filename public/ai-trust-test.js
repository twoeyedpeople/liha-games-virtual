const TRUE_STATEMENTS = [
  "LinkedIn’s Responsible AI Principles, aligned with Microsoft, guide how AI solutions are built, deployed, and governed.",
  "LinkedIn uses AI to help members connect, work more productively, and achieve professional success.",
  "LinkedIn’s AI is powered by Economic Graph, leveraging data from the world’s most dynamic talent network.",
  "Fairness and inclusion are core principles in how LinkedIn designs and evaluates AI systems.",
  "LinkedIn conducts ongoing fairness and bias reviews across its AI models.",
  "When potential bias is identified, LinkedIn works to mitigate and reduce it.",
  "Transparency is a core principle in how LinkedIn approaches AI development and use.",
  "Human judgment remains central when AI is used in meaningful decisions.",
  "Strong data governance helps ensure AI is trained on accurate, relevant, and responsibly sourced data.",
  "LinkedIn designs AI systems with enterprise-grade trust, security, and accountability.",
  "LinkedIn complies with applicable laws and regulations in the markets where its products are offered.",
  "LinkedIn’s AI practices align with global data protection requirements, including GDPR, LGPD, and CCPA.",
  "LinkedIn’s algorithms do not use gender as a ranking signal, changing gender on your profile does not affect how your content appears in search or feed.",
  "By leveraging AI, we help our members connect, increase productivity and achieve success in their careers.",
];

const FALSE_STATEMENTS = [
  "Humans are not allowed to stop or override an AI system once it is running.",
  "Transparency means making AI pretend it is a real human.",
  "Fairness means AI should reinforce stereotypes and insult users.",
  "If an AI system breaks, engineers should ignore it and hope it fixes itself.",
  "Privacy standards require sharing user passwords and private data publicly.",
  "AI should be used for every decision, even when it is unsafe or inappropriate.",
  "No one - not even the engineers - should understand how an AI system works.",
  "Data governance means using old and inaccurate data to train systems.",
  "Once an AI system is launched, it cannot be monitored or improved.",
  "AI acts on your behalf without any human judgement.",
];

const CARDS = shuffle(
  TRUE_STATEMENTS.map((text, index) => ({ id: `true-${index}`, text, isTrue: true })).concat(
    FALSE_STATEMENTS.map((text, index) => ({ id: `false-${index}`, text, isTrue: false }))
  )
);

const TOTAL_CORRECT_COUNT = TRUE_STATEMENTS.length;
const TOTAL_INCORRECT_COUNT = FALSE_STATEMENTS.length;
const FEEDBACK_FLIP_DOWN_MS = 520;
const FEEDBACK_FLASH_MS = 520;
const LIMIT_FEEDBACK_MS = 1200;

const introStage = document.getElementById("intro-welcome-stage");
const gameStage = document.getElementById("trust-stage-game");
const boardEl = document.getElementById("trust-board");
const progressEl = document.getElementById("trust-progress");
const footerEl = document.getElementById("trust-footer");
const footerMessageEl = document.getElementById("trust-footer-message");
const submitBtn = document.getElementById("trust-submit-btn");
const submitLabel = document.getElementById("trust-submit-label");
const startBtn = document.getElementById("intro-get-started");
const boardShellEl = document.querySelector(".trust-board-shell");

const BOARD_DESIGN_WIDTH = 1696;
const BOARD_DESIGN_HEIGHT = 852;

const state = {
  selected: new Set(),
  knocked: new Set(),
  lockedCorrect: new Set(),
  feedbackFlash: new Set(),
  isSubmitting: false,
  lastCorrectPickedCount: 0,
  limitFeedbackCardId: null,
  progressMode: "selection",
  solved: false,
};

let limitFeedbackTimer = null;

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function showGameStage() {
  introStage.classList.add("hidden");
  gameStage.classList.add("trust-stage-active");
  renderAll();
  updateBoardScale();
}

function showIntroStage() {
  gameStage.classList.remove("trust-stage-active");
  introStage.classList.remove("hidden");
}

function resetGame() {
  state.selected = new Set();
  state.knocked = new Set();
  state.lockedCorrect = new Set();
  state.feedbackFlash = new Set();
  state.isSubmitting = false;
  state.lastCorrectPickedCount = 0;
  state.limitFeedbackCardId = null;
  state.progressMode = "selection";
  state.solved = false;
  submitLabel.textContent = "Submit";
  footerEl.classList.remove("is-complete");
  renderAll();
}

function updateBoardScale() {
  if (!boardShellEl) return;

  const styles = window.getComputedStyle(boardShellEl);
  const boardStyles = window.getComputedStyle(boardEl);
  const availableWidth = boardShellEl.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
  const availableHeight = boardShellEl.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom);
  const fitWidth = parseFloat(boardStyles.getPropertyValue("--board-fit-width")) || BOARD_DESIGN_WIDTH;
  const designHeight = parseFloat(boardStyles.getPropertyValue("--board-design-height")) || BOARD_DESIGN_HEIGHT;
  const visibleTop = parseFloat(boardStyles.getPropertyValue("--board-visible-top")) || 0;
  const visibleBottom = parseFloat(boardStyles.getPropertyValue("--board-visible-bottom")) || designHeight;
  const visibleHeight = Math.max(visibleBottom - visibleTop, 1);
  const scale = Math.min(availableWidth / fitWidth, availableHeight / visibleHeight);
  const visibleCenter = (visibleTop + visibleBottom) / 2;
  const boardCenter = designHeight / 2;
  const offset = (boardCenter - visibleCenter) * scale;

  boardEl.style.setProperty("--board-scale", String(Math.max(scale, 0.1)));
  boardEl.style.setProperty("--board-offset-compensation", `${offset}px`);
}

function toggleCard(id) {
  if (state.solved || state.isSubmitting) return;
  const card = CARDS.find((item) => item.id === id);
  if (!card) return;
  if (state.knocked.has(id)) return;

  if (state.selected.has(id)) {
    state.selected.delete(id);
  } else {
    if (state.selected.size >= TOTAL_CORRECT_COUNT) {
      showSelectionLimitFeedback(id);
      return;
    }
    state.selected.add(id);
  }

  state.progressMode = "selection";
  state.lockedCorrect = new Set();
  state.feedbackFlash = new Set();
  state.limitFeedbackCardId = null;
  renderAll();
}

function showSelectionLimitFeedback(id) {
  state.limitFeedbackCardId = id;
  renderAll();

  if (limitFeedbackTimer) {
    window.clearTimeout(limitFeedbackTimer);
  }

  limitFeedbackTimer = window.setTimeout(() => {
    if (state.limitFeedbackCardId === id) {
      state.limitFeedbackCardId = null;
      renderAll();
    }
  }, LIMIT_FEEDBACK_MS);
}

async function submitSelection() {
  if (state.solved) {
    resetGame();
    showIntroStage();
    return;
  }

  if (state.isSubmitting || state.selected.size !== TOTAL_CORRECT_COUNT) return;

  const foundIncorrectCardIds = [];
  const selectedCorrectCardIds = [];
  const missedCorrectCardIds = [];

  CARDS.forEach((card) => {
    const isSelected = state.selected.has(card.id);
    const isAlreadyFound = state.knocked.has(card.id);

    if (card.isTrue && isSelected) {
      selectedCorrectCardIds.push(card.id);
    }

    if (card.isTrue && !isSelected) {
      missedCorrectCardIds.push(card.id);
    }

    if (!card.isTrue && (isAlreadyFound || !isSelected)) {
      foundIncorrectCardIds.push(card.id);
    }
  });

  state.lockedCorrect = new Set(selectedCorrectCardIds);
  state.lastCorrectPickedCount = selectedCorrectCardIds.length;
  state.knocked = new Set([...state.knocked, ...CARDS.filter((card) => !state.selected.has(card.id)).map((card) => card.id)]);
  state.solved = foundIncorrectCardIds.length === TOTAL_INCORRECT_COUNT;

  if (state.solved) {
    if (typeof window.Analytics !== "undefined") {
      window.Analytics.markModuleComplete("AI Trust Test");
      window.Analytics.logEvent("AI Trust Test", "module_complete");
    }
    state.selected = new Set();
    state.progressMode = "result";
    footerEl.classList.add("is-complete");
    submitLabel.textContent = "Complete";
    renderAll();
    return;
  }

  state.isSubmitting = true;
  state.limitFeedbackCardId = null;
  footerEl.classList.remove("is-complete");
  submitBtn.disabled = true;
  submitBtn.classList.add("is-disabled");
  renderAll();

  await wait(FEEDBACK_FLIP_DOWN_MS);

  state.knocked = new Set(foundIncorrectCardIds);
  state.selected = new Set();
  state.lockedCorrect = new Set();
  state.feedbackFlash = new Set(missedCorrectCardIds);
  state.progressMode = "result";
  state.isSubmitting = false;
  renderAll();

  await wait(FEEDBACK_FLASH_MS);

  if (!state.isSubmitting) {
    state.feedbackFlash = new Set();
    renderAll();
  }
}

function wait(duration) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

function getFoundIncorrectCount() {
  return CARDS.filter((card) => !card.isTrue && state.knocked.has(card.id)).length;
}

function renderBoard() {
  if (boardEl.children.length === 0) {
    CARDS.forEach((card) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "trust-card";
      button.dataset.cardId = card.id;
      button.addEventListener("click", () => toggleCard(card.id));

      const inner = document.createElement("div");
      inner.className = "trust-card-inner";

      const text = document.createElement("p");
      text.className = "trust-card-text";
      text.textContent = card.text;

      inner.appendChild(text);
      button.appendChild(inner);
      boardEl.appendChild(button);
    });
  }

  CARDS.forEach((card) => {
    const button = boardEl.querySelector(`[data-card-id="${card.id}"]`);
    const isSelected = state.selected.has(card.id);
    const isCorrect = state.lockedCorrect.has(card.id);
    const isKnocked = state.knocked.has(card.id);
    const isFeedbackFlash = state.feedbackFlash.has(card.id);
    const isLimitFeedback = state.limitFeedbackCardId === card.id;

    button.setAttribute("aria-pressed", String(isSelected));
    button.classList.toggle("is-selected", isSelected);
    button.classList.toggle("is-correct", isCorrect);
    button.classList.toggle("is-knocked", isKnocked);
    button.classList.toggle("is-feedback-flash", isFeedbackFlash);
    button.classList.toggle("is-limit-feedback", isLimitFeedback);
    button.disabled = isKnocked || state.isSubmitting;

    if (isKnocked || state.isSubmitting) {
      button.setAttribute("aria-disabled", "true");
    } else {
      button.removeAttribute("aria-disabled");
    }
  });
}

function renderProgress() {
  progressEl.innerHTML = "";

  const visibleCount = state.progressMode === "result" ? state.lastCorrectPickedCount : state.selected.size;

  for (let index = 0; index < TOTAL_CORRECT_COUNT; index += 1) {
    const slot = document.createElement("span");
    slot.className = "trust-progress-slot";

    if (index < visibleCount) {
      slot.classList.add(state.progressMode === "result" ? "is-correct" : "is-selected");
    }

    progressEl.appendChild(slot);
  }
}

function renderFooter() {
  if (state.solved) {
    footerMessageEl.innerHTML = "Amazing work. You found all 14 correct AI statement cards.";
    submitBtn.disabled = false;
    submitBtn.classList.remove("is-disabled");
    submitLabel.textContent = "Complete";
    footerEl.classList.add("is-complete");
    progressEl.setAttribute("aria-label", "Completed with all 14 correct cards selected");
    return;
  }

  footerEl.classList.remove("is-complete");
  const foundCount = getFoundIncorrectCount();

  if (state.progressMode === "result") {
    footerMessageEl.innerHTML = `Keep trying. You picked <span class="trust-highlight-pill">${state.lastCorrectPickedCount}</span> out of ${TOTAL_CORRECT_COUNT} correct statements.`;
    progressEl.setAttribute("aria-label", `${state.lastCorrectPickedCount} of ${TOTAL_CORRECT_COUNT} correct statements selected`);
  } else {
    footerMessageEl.textContent = "Select the 14 correct AI statement cards.";
    progressEl.setAttribute("aria-label", `${state.selected.size} of ${TOTAL_CORRECT_COUNT} correct cards selected`);
  }

  const canSubmit = !state.isSubmitting && foundCount < TOTAL_INCORRECT_COUNT && state.selected.size === TOTAL_CORRECT_COUNT;
  submitBtn.disabled = !canSubmit;
  submitBtn.classList.toggle("is-disabled", !canSubmit);
  submitLabel.textContent = "Submit";
}

function renderAll() {
  renderBoard();
  renderProgress();
  renderFooter();
}

startBtn.addEventListener("click", showGameStage);
submitBtn.addEventListener("click", submitSelection);
window.addEventListener("resize", updateBoardScale);

if (window.ResizeObserver && boardShellEl) {
  const boardResizeObserver = new ResizeObserver(updateBoardScale);
  boardResizeObserver.observe(boardShellEl);
}

renderAll();
updateBoardScale();

document.addEventListener("DOMContentLoaded", () => {
  if (typeof window.Analytics !== "undefined") {
    window.Analytics.logEvent("AI Trust Test", "module_start");
  }
});
