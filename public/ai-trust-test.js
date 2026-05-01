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

const REQUIRED_TRUE_COUNT = 14;

const introStage = document.getElementById("trust-stage-intro");
const gameStage = document.getElementById("trust-stage-game");
const boardEl = document.getElementById("trust-board");
const progressEl = document.getElementById("trust-progress");
const footerEl = document.getElementById("trust-footer");
const footerMessageEl = document.getElementById("trust-footer-message");
const submitBtn = document.getElementById("trust-submit-btn");
const submitLabel = document.getElementById("trust-submit-label");
const startBtn = document.getElementById("trust-start-btn");

const state = {
  selected: new Set(),
  knocked: new Set(),
  lockedCorrect: new Set(),
  lastSubmittedCorrectCount: 0,
  progressMode: "selection",
  solved: false,
};

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function showGameStage() {
  introStage.classList.remove("trust-stage-active");
  gameStage.classList.add("trust-stage-active");
  renderAll();
}

function toggleCard(id) {
  if (state.solved) return;
  const card = CARDS.find((item) => item.id === id);
  if (!card) return;
  if (state.knocked.has(id)) return;

  if (state.selected.has(id)) {
    state.selected.delete(id);
  } else {
    if (state.selected.size >= REQUIRED_TRUE_COUNT) return;
    state.selected.add(id);
  }

  state.progressMode = "selection";
  state.lockedCorrect = new Set();
  renderAll();
}

function submitSelection() {
  if (state.solved) {
    window.location.href = "/index.html";
    return;
  }

  if (state.selected.size !== REQUIRED_TRUE_COUNT) return;

  let correctCount = 0;
  const nextLockedCorrect = new Set();

  CARDS.forEach((card) => {
    if (card.isTrue && state.selected.has(card.id)) {
      correctCount += 1;
      nextLockedCorrect.add(card.id);
    }

    if (!card.isTrue && !state.selected.has(card.id)) {
      state.knocked.add(card.id);
    }
  });

  state.lockedCorrect = nextLockedCorrect;
  state.lastSubmittedCorrectCount = correctCount;
  state.progressMode = "result";
  state.solved = correctCount === REQUIRED_TRUE_COUNT;

  if (state.solved) {
    footerEl.classList.add("is-complete");
    submitLabel.textContent = "Complete";
  } else {
    footerEl.classList.remove("is-complete");
    submitLabel.textContent = "Submit";
  }

  renderAll();
}

function renderBoard() {
  boardEl.innerHTML = "";

  CARDS.forEach((card) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "trust-card";
    button.dataset.cardId = card.id;
    button.setAttribute("aria-pressed", String(state.selected.has(card.id)));

    if (state.selected.has(card.id)) {
      button.classList.add("is-selected");
    }

    if (state.solved && state.lockedCorrect.has(card.id)) {
      button.classList.add("is-correct");
    }

    if (state.knocked.has(card.id)) {
      button.classList.add("is-knocked");
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
    } else {
      button.addEventListener("click", () => toggleCard(card.id));
    }

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

function renderProgress() {
  progressEl.innerHTML = "";

  for (let index = 0; index < REQUIRED_TRUE_COUNT; index += 1) {
    const slot = document.createElement("span");
    slot.className = "trust-progress-slot";

    if (state.progressMode === "selection" && index < state.selected.size) {
      slot.classList.add("is-selected");
    }

    if (state.progressMode === "result" && index < state.lastSubmittedCorrectCount) {
      slot.classList.add("is-correct");
    }

    progressEl.appendChild(slot);
  }
}

function renderFooter() {
  if (state.solved) {
    footerMessageEl.innerHTML = "Amazing work. You’ve selected all the correct 14 AI statement cards.";
    submitBtn.disabled = false;
    submitBtn.classList.remove("is-disabled");
    submitLabel.textContent = "Complete";
    footerEl.classList.add("is-complete");
    progressEl.setAttribute("aria-label", "Completed with all 14 correct cards");
    return;
  }

  footerEl.classList.remove("is-complete");

  if (state.progressMode === "result") {
    const remaining = REQUIRED_TRUE_COUNT - state.lastSubmittedCorrectCount;
    footerMessageEl.innerHTML = `Keep trying. You have <span class="trust-highlight-pill">${remaining}</span> cards to correct.`;
    progressEl.setAttribute("aria-label", `${state.lastSubmittedCorrectCount} correct cards identified`);
  } else {
    footerMessageEl.textContent = "Select the 14 correct AI statement cards.";
    progressEl.setAttribute("aria-label", `${state.selected.size} of 14 cards selected`);
  }

  const canSubmit = state.selected.size === REQUIRED_TRUE_COUNT;
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

renderAll();
