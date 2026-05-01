const welcomeStage = document.getElementById("intro-welcome-stage");
const formStage = document.getElementById("intro-form-stage");
const loadingStage = document.getElementById("intro-loading-stage");
const resultStage = document.getElementById("intro-result-stage");
const savingsStage = document.getElementById("intro-savings-stage");
const welcomeError = document.getElementById("intro-welcome-error");
const resultEl = document.getElementById("intro-result");
const resultCopy = document.getElementById("intro-result-copy");
const resultHoursBadge = document.getElementById("intro-result-hours-badge");
const nextBtn = document.getElementById("intro-next");
const doneBtn = document.getElementById("intro-done");
const companyNameInput = document.getElementById("company-name");
const companyTitle = document.getElementById("intro-company-title");
const pipelineEl = document.getElementById("intro-pipeline");
const savingsPipelineEl = document.getElementById("intro-savings-pipeline");
const savingsTitle = document.getElementById("intro-savings-title");
const savingsHoursBadge = document.getElementById("intro-savings-hours-badge");
const clearAllBtn = document.getElementById("intro-clear-all");
const virtualKeyboardEl = document.getElementById("intro-vkbd");
const virtualKeyboardKeysEl = document.getElementById("intro-vkbd-keys");
const virtualKeyboardCloseBtn = document.getElementById("intro-vkbd-close");
const INTRO_FIXED_SAVINGS_LABEL = "20+ hours";
const VIRTUAL_KEYBOARD_LAYOUTS = {
  letters: [
    { id: "letters-1", keys: ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"] },
    { id: "letters-2", keys: ["a", "s", "d", "f", "g", "h", "j", "k", "l"] },
    { id: "letters-3", keys: ["{shift}", "z", "x", "c", "v", "b", "n", "m", "{backspace}"] },
    { id: "actions", keys: ["{symbols}", "{space}", "{enter}"] },
  ],
  symbols: [
    { id: "letters-1", keys: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] },
    { id: "letters-2", keys: ["@", "#", "$", "%", "&", "*", "-", "+", "/"] },
    { id: "letters-3", keys: ["(", ")", ".", ",", "?", "!", "'", "\"", "{backspace}"] },
    { id: "actions", keys: ["{letters}", "{space}", "{enter}"] },
  ],
};
const PREVIEW = (() => {
  const params = new URLSearchParams(window.location.search);
  const enabled = params.get("preview") === "1" || params.has("stage");
  const raw = (params.get("stage") || "").trim();

  const alias = {
    welcome: "welcome",
    form: "form",
    loading: "loading",
    result: "result",
    savings: "savings",
    "intro-welcome-stage": "welcome",
    "intro-form-stage": "form",
    "intro-loading-stage": "loading",
    "intro-result-stage": "result",
    "intro-savings-stage": "savings",
  };

  return {
    enabled,
    stage: alias[raw] || "welcome",
  };
})();

let PIPELINE = [];
const taskLookup = new Map();

let companyName = "";
const selectedTasks = new Set();
let activeIntroStage = "";
let keyboardOpen = false;
let keyboardShiftEnabled = false;
let keyboardMode = "letters";
let introVirtualKeyboardEnabled = false;

function triggerStageEnter(stageEl) {
  if (!stageEl) return;
  stageEl.classList.remove("is-stage-entering");
  void stageEl.offsetWidth;
  stageEl.classList.add("is-stage-entering");
  window.setTimeout(() => {
    stageEl.classList.remove("is-stage-entering");
  }, 760);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setIntroStage(stage) {
  if (activeIntroStage === stage) {
    window.dispatchEvent(new Event("liha:layout-change"));
    return;
  }

  welcomeStage.classList.add("hidden");
  formStage.classList.add("hidden");
  loadingStage.classList.add("hidden");
  resultStage.classList.add("hidden");
  savingsStage.classList.add("hidden");

  if (stage === "welcome") welcomeStage.classList.remove("hidden");
  if (stage === "form") formStage.classList.remove("hidden");
  if (stage === "loading") loadingStage.classList.remove("hidden");
  if (stage === "result") resultStage.classList.remove("hidden");
  if (stage === "savings") savingsStage.classList.remove("hidden");

  const stageMap = {
    welcome: welcomeStage,
    form: formStage,
    loading: loadingStage,
    result: resultStage,
    savings: savingsStage,
  };
  triggerStageEnter(stageMap[stage]);
  activeIntroStage = stage;
  if (stage !== "welcome") {
    hideVirtualKeyboard({ blurInput: true });
  }

  window.dispatchEvent(new Event("liha:layout-change"));
}

function applyCompanyNameValue(nextValue) {
  const value = String(nextValue || "");
  companyNameInput.value = value.slice(0, Number(companyNameInput.maxLength) || 60);
}

function insertAtCursor(text) {
  const source = companyNameInput.value || "";
  const start = Number(companyNameInput.selectionStart);
  const end = Number(companyNameInput.selectionEnd);
  if (Number.isFinite(start) && Number.isFinite(end)) {
    const next = source.slice(0, start) + text + source.slice(end);
    applyCompanyNameValue(next);
    const pos = Math.min(companyNameInput.value.length, start + text.length);
    companyNameInput.setSelectionRange(pos, pos);
    return;
  }
  applyCompanyNameValue(`${source}${text}`);
}

function backspaceAtCursor() {
  const source = companyNameInput.value || "";
  const start = Number(companyNameInput.selectionStart);
  const end = Number(companyNameInput.selectionEnd);
  if (!source) return;
  if (Number.isFinite(start) && Number.isFinite(end)) {
    if (start !== end) {
      const next = source.slice(0, start) + source.slice(end);
      applyCompanyNameValue(next);
      companyNameInput.setSelectionRange(start, start);
      return;
    }
    if (start > 0) {
      const next = source.slice(0, start - 1) + source.slice(end);
      applyCompanyNameValue(next);
      const pos = start - 1;
      companyNameInput.setSelectionRange(pos, pos);
      return;
    }
  }
  applyCompanyNameValue(source.slice(0, -1));
}

function dispatchCompanyInputEvent() {
  companyNameInput.dispatchEvent(new Event("input", { bubbles: true }));
}

function keyboardKeyLabel(key) {
  if (key === "{shift}") return "Shift";
  if (key === "{backspace}") return "Delete";
  if (key === "{space}") return "Space";
  if (key === "{clear}") return "Clear";
  if (key === "{enter}") return "Enter";
  if (key === "{symbols}") return "123";
  if (key === "{letters}") return "ABC";
  return keyboardShiftEnabled ? key.toUpperCase() : key;
}

function renderVirtualKeyboard() {
  if (!virtualKeyboardKeysEl) return;
  const rows = VIRTUAL_KEYBOARD_LAYOUTS[keyboardMode] || VIRTUAL_KEYBOARD_LAYOUTS.letters;
  virtualKeyboardKeysEl.innerHTML = rows.map((row) => {
    const keys = row.keys
      .map((key) => {
        const actionClass = key.startsWith("{") ? " is-action" : "";
        const accentClass = key === "{enter}" || key === "{symbols}" || key === "{letters}" ? " is-accent" : "";
        const activeClass = key === "{shift}" && keyboardShiftEnabled ? " is-active" : "";
        const ariaLabel = key.replace(/[{}]/g, "");
        return `<button type="button" class="intro-vkbd-key${actionClass}${accentClass}${activeClass}" data-kbd-key="${key}" aria-label="${ariaLabel}">${keyboardKeyLabel(key)}</button>`;
      })
      .join("");
    return `<div class="intro-vkbd-row" data-row="${row.id}">${keys}</div>`;
  }).join("");
}

function showVirtualKeyboard() {
  if (!virtualKeyboardEl || activeIntroStage !== "welcome" || !introVirtualKeyboardEnabled) return;
  keyboardOpen = true;
  virtualKeyboardEl.classList.add("is-open");
  virtualKeyboardEl.setAttribute("aria-hidden", "false");
}

function hideVirtualKeyboard({ blurInput = false } = {}) {
  if (!virtualKeyboardEl) return;
  keyboardOpen = false;
  keyboardShiftEnabled = false;
  keyboardMode = "letters";
  virtualKeyboardEl.classList.remove("is-open");
  virtualKeyboardEl.setAttribute("aria-hidden", "true");
  renderVirtualKeyboard();
  if (blurInput) {
    companyNameInput.blur();
  }
}

function setIntroVirtualKeyboardEnabled(enabled) {
  introVirtualKeyboardEnabled = Boolean(enabled);
  if (!virtualKeyboardEl) return;
  virtualKeyboardEl.classList.toggle("is-disabled", !introVirtualKeyboardEnabled);
  if (!introVirtualKeyboardEnabled) {
    hideVirtualKeyboard({ blurInput: true });
  }
}

function handleVirtualKeyboardKeyPress(rawKey) {
  const key = String(rawKey || "");
  if (!key) return;
  if (key === "{shift}") {
    if (keyboardMode !== "letters") return;
    keyboardShiftEnabled = !keyboardShiftEnabled;
    renderVirtualKeyboard();
    return;
  }
  if (key === "{symbols}") {
    keyboardMode = "symbols";
    keyboardShiftEnabled = false;
    renderVirtualKeyboard();
    return;
  }
  if (key === "{letters}") {
    keyboardMode = "letters";
    keyboardShiftEnabled = false;
    renderVirtualKeyboard();
    return;
  }
  if (key === "{backspace}") {
    backspaceAtCursor();
    dispatchCompanyInputEvent();
    return;
  }
  if (key === "{space}") {
    insertAtCursor(" ");
    dispatchCompanyInputEvent();
    return;
  }
  if (key === "{clear}") {
    applyCompanyNameValue("");
    dispatchCompanyInputEvent();
    return;
  }
  if (key === "{enter}") {
    hideVirtualKeyboard({ blurInput: true });
    document.getElementById("intro-get-started").click();
    return;
  }
  insertAtCursor(keyboardShiftEnabled ? key.toUpperCase() : key);
  dispatchCompanyInputEvent();
  if (keyboardShiftEnabled) {
    keyboardShiftEnabled = false;
    renderVirtualKeyboard();
  }
}

async function loadIntroConfig() {
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    if (!response.ok) throw new Error("config unavailable");
    const data = await response.json();
    setIntroVirtualKeyboardEnabled(Boolean(data?.introVirtualKeyboardEnabled));
  } catch (_err) {
    setIntroVirtualKeyboardEnabled(false);
  }
}

function taskId(stage, task) {
  return `${stage}::${task}`;
}

function taskMetaById(id) {
  return taskLookup.get(id) || null;
}

function isPeopleCentricById(id) {
  const meta = taskMetaById(id);
  if (!meta) return false;
  return String(meta.category || "").toLowerCase().includes("people-centric");
}

function aiMinutesForTask(id) {
  const meta = taskMetaById(id);
  if (!meta || isPeopleCentricById(id)) return 0;
  return Number(meta.timeMins) || 0;
}

function unpickedPotentialHours() {
  let totalMinutes = 0;
  PIPELINE.forEach((column) => {
    column.tasks.forEach((task) => {
      const id = taskId(column.stage, task.task);
      if (selectedTasks.has(id)) return;
      totalMinutes += aiMinutesForTask(id);
    });
  });
  return totalMinutes / 60;
}

function updateResultHoursBadge() {
  if (!resultHoursBadge) return;
  const hours = unpickedPotentialHours();
  resultHoursBadge.textContent = `${hours.toFixed(1)} hours`;
}

function renderPipeline() {
  pipelineEl.innerHTML = PIPELINE.map((column, columnIndex) => {
    const tasksHtml = column.tasks
      .map((task, taskIndex) => {
        const id = taskId(column.stage, task.task);
        const selected = selectedTasks.has(id);
        const delay = Math.min(480, columnIndex * 90 + taskIndex * 50);
        return `<button type="button" class="intro-task${selected ? " active" : ""}" style="--row-delay:${delay}ms" data-intro-task="${id}">
          ${task.task}
        </button>`;
      })
      .join("");

    const columnDelay = Math.min(420, columnIndex * 90);
    return `<section class="intro-column" style="--row-delay:${columnDelay}ms">
      <h3>${column.stage}</h3>
      <div class="intro-column-dot"></div>
      <div class="intro-task-list">${tasksHtml}</div>
    </section>`;
  }).join("");

  pipelineEl.querySelectorAll("[data-intro-task]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.introTask;
      if (selectedTasks.has(id)) {
        selectedTasks.delete(id);
      } else {
        selectedTasks.add(id);
      }
      renderPipeline();
    });
  });

  if (clearAllBtn) {
    clearAllBtn.disabled = selectedTasks.size === 0;
    clearAllBtn.style.opacity = selectedTasks.size === 0 ? "0.45" : "1";
  }

  updateResultHoursBadge();
}

function renderSavingsPipeline() {
  savingsTitle.textContent = `AI can save you ${INTRO_FIXED_SAVINGS_LABEL} per week`;
  if (savingsHoursBadge) {
    savingsHoursBadge.textContent = INTRO_FIXED_SAVINGS_LABEL;
  }

  savingsPipelineEl.innerHTML = PIPELINE.map((column, columnIndex) => {
    const tasksHtml = column.tasks
      .map((task, taskIndex) => {
        const id = taskId(column.stage, task.task);
        const selected = selectedTasks.has(id);
        const peopleCentric = isPeopleCentricById(id);
        const variant = selected ? "love" : peopleCentric ? "people" : "optimised";
        const delay = Math.min(480, columnIndex * 90 + taskIndex * 50);
        return `<div class="intro-task readonly intro-task-savings intro-task-${variant}" style="--row-delay:${delay}ms">
          <span>${task.task}</span>
        </div>`;
      })
      .join("");

    const columnDelay = Math.min(420, columnIndex * 90);
    return `<section class="intro-column" style="--row-delay:${columnDelay}ms">
      <h3>${column.stage}</h3>
      <div class="intro-column-dot"></div>
      <div class="intro-task-list">${tasksHtml}</div>
    </section>`;
  }).join("");
}

function resetFormFields() {
  selectedTasks.clear();
  renderPipeline();
  savingsPipelineEl.innerHTML = "";
  savingsTitle.textContent = "AI can save you -- per week";
  if (savingsHoursBadge) {
    savingsHoursBadge.textContent = INTRO_FIXED_SAVINGS_LABEL;
  }
  resultEl.textContent = "";
  resultCopy.textContent = "-";
  if (resultHoursBadge) {
    updateResultHoursBadge();
  }
}

document.getElementById("intro-get-started").addEventListener("click", () => {
  const value = companyNameInput.value.trim();
  if (!value) {
    welcomeError.textContent = "Company Name is required.";
    return;
  }

  companyName = value;
  welcomeError.textContent = "";
  companyTitle.textContent = `${companyName}: Select as many focus actions as needed, then generate your result.`;
  setIntroStage("form");
});

if (companyNameInput) {
  companyNameInput.addEventListener("focus", () => {
    showVirtualKeyboard();
  });
  companyNameInput.addEventListener("pointerdown", () => {
    showVirtualKeyboard();
  });
}

if (virtualKeyboardKeysEl) {
  virtualKeyboardKeysEl.addEventListener("click", (event) => {
    const target = event.target.closest("[data-kbd-key]");
    if (!target) return;
    event.preventDefault();
    companyNameInput.focus({ preventScroll: true });
    handleVirtualKeyboardKeyPress(target.dataset.kbdKey);
  });
}

if (virtualKeyboardCloseBtn) {
  virtualKeyboardCloseBtn.addEventListener("click", () => {
    hideVirtualKeyboard({ blurInput: true });
  });
}

document.addEventListener("pointerdown", (event) => {
  if (!keyboardOpen || activeIntroStage !== "welcome" || !virtualKeyboardEl) return;
  const target = event.target;
  const tappedInput = target === companyNameInput || companyNameInput.contains(target);
  const tappedKeyboard = virtualKeyboardEl.contains(target);
  if (!tappedInput && !tappedKeyboard) {
    hideVirtualKeyboard({ blurInput: true });
  }
});

document.getElementById("intro-submit").addEventListener("click", async () => {
  const startedAt = Date.now();
  try {
    if (selectedTasks.size === 0) {
      resultEl.textContent = "Pick at least one focus action.";
      return;
    }

    setIntroStage("loading");

    const selections = [...selectedTasks].map((entry) => {
      const [stage, task] = entry.split("::");
      return { stage, task };
    });

    const res = await fetch("/api/intro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selections, companyName }),
    });

    const data = await res.json();
    if (!res.ok) {
      resultEl.textContent = data.error || "Could not generate intro result.";
      return;
    }

    resultCopy.textContent = `${data.result} ${data.note}`;
  } catch (_err) {
    resultEl.textContent = "Could not generate intro result.";
  } finally {
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, 3000 - elapsed);
    if (remaining) {
      await delay(remaining);
    }

    if (resultCopy.textContent !== "-") {
      setIntroStage("result");
    } else {
      setIntroStage("form");
    }
  }
});

if (clearAllBtn) {
  clearAllBtn.addEventListener("click", () => {
    selectedTasks.clear();
    resultEl.textContent = "";
    renderPipeline();
  });
}

nextBtn.addEventListener("click", () => {
  renderSavingsPipeline();
  setIntroStage("savings");
});

doneBtn.addEventListener("click", () => {
  resetFormFields();
  companyNameInput.value = "";
  companyName = "";
  setIntroStage("welcome");
});

function hydratePipelineFromWorkflow(data) {
  const stages = Array.isArray(data?.stages) ? data.stages : [];
  PIPELINE = stages
    .slice()
    .sort((a, b) => Number(a.stage || 0) - Number(b.stage || 0))
    .map((stage) => ({
      stage: String(stage.workflow || "").trim(),
      tasks: (Array.isArray(stage.tasks) ? stage.tasks : []).map((task) => ({
        task: String(task.task || "").trim(),
        category: String(task.category || "").trim(),
        timeMins: Number(task.time_mins) || 0,
      })),
    }))
    .filter((stage) => stage.stage && stage.tasks.length > 0);

  taskLookup.clear();
  PIPELINE.forEach((stage) => {
    stage.tasks.forEach((task) => {
      taskLookup.set(taskId(stage.stage, task.task), task);
    });
  });
}

async function loadWorkflowData() {
  const response = await fetch("/data/workflow.json");
  if (!response.ok) {
    throw new Error("Could not load workflow.json");
  }
  const data = await response.json();
  hydratePipelineFromWorkflow(data);
}

async function initIntro() {
  await loadIntroConfig();
  try {
    await loadWorkflowData();
  } catch (_err) {
    resultEl.textContent = "Could not load workflow data.";
  }

  renderVirtualKeyboard();
  renderPipeline();
  if (PREVIEW.enabled) {
    companyNameInput.value = "INVNT Agency";
    companyTitle.textContent = "INVNT Agency: Select as many focus actions as needed, then generate your result.";
    if (PREVIEW.stage !== "form") {
      selectedTasks.add(taskId("Source the candidate", "Source initial candidates"));
      selectedTasks.add(taskId("Calibrate candidates", "Review cover letters"));
      selectedTasks.add(taskId("Calibrate candidates", "Review candidate profiles"));
    }
    renderPipeline();
    resultCopy.textContent =
      "Focus plan across 2 stages. 4 actions selected. Priority first step: Source initial candidates.";
    renderSavingsPipeline();
    setIntroStage(PREVIEW.stage);
  } else {
    setIntroStage("welcome");
  }
}

initIntro();

setInterval(loadIntroConfig, 5000);
