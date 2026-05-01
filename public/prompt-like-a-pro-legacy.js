const state = {
  playerId: localStorage.getItem("promptArenaPlayerId") || "",
  sessionId: localStorage.getItem("promptArenaSessionId") || "",
  playerTeam: localStorage.getItem("promptArenaPlayerTeam") || "",
  playerReady: localStorage.getItem("promptArenaPlayerReady") === "1",
  selectedTeam: localStorage.getItem("promptArenaSelectedTeam") || "red",
  passcode: localStorage.getItem("promptArenaPasscode") || "",
  joinStep: localStorage.getItem("promptArenaJoinStep") || "passcode",
  selectedBrief: localStorage.getItem("promptArenaSelectedBrief") || "",
  briefConfirmed: localStorage.getItem("promptArenaBriefConfirmed") === "1",
  hasSeenRoundWelcome: localStorage.getItem("promptArenaRoundWelcomeSeen") === "1",
  lastScore: localStorage.getItem("promptArenaLastScore") || "",
  lastFeedback: localStorage.getItem("promptArenaLastFeedback") || "",
  failedAttempt: false,
  retryingFromFail: false,
  forceBriefView: false,
  teamEditMode: false,
  isProcessing: false,
  serverOffsetMs: 0,
  phase: "closed",
  promptCompletedAt: null,
  trustWho: null,
  roundStartsAt: null,
  roundEndsAt: null,
  roundPausedAt: null,
  roundRemainingMs: 15 * 60 * 1000,
  leaderboard: [],
};
const RESULTS_REVEAL_MS = 10_000;
const COMBINED_ADD_MS = 3_000;
const STAGE_ENTER_ANIM_MS = 760;
let activeStageKey = "";
let lastPlayerLeaderboardSignature = "";
let lastPlayerLeaderboardMode = "";
const playerScoreCache = new Map();
const playerScoreAnimationFrames = new Map();
let playerBoardPushTimer = 0;
const playerVisibleRowsByMode = new Map();
let resultScoreAnimationFrame = 0;

const screens = {
  passcodeEntry: document.getElementById("stage-passcode-entry"),
  team: document.getElementById("stage-team"),
  lobby: document.getElementById("stage-lobby"),
  roundWelcome: document.getElementById("stage-round-welcome"),
  briefPick: document.getElementById("stage-brief-pick"),
  brief: document.getElementById("stage-brief"),
  prompt: document.getElementById("stage-prompt"),
  processing: document.getElementById("stage-processing"),
  result: document.getElementById("stage-result"),
  blocked: document.getElementById("stage-blocked"),
  playerLeaderboard: document.getElementById("stage-player-leaderboard"),
};

const globalError = document.getElementById("global-error");
const passcodeError = document.getElementById("passcode-error");
const launchFullscreenToggle = document.getElementById("launch-fullscreen-toggle");
const timerEl = document.getElementById("timer");
const promptTimerEl = document.getElementById("prompt-timer");
const welcomeTimerEl = document.getElementById("welcome-timer");
const welcomeCountdownEl = document.getElementById("welcome-countdown");
const roundTimerEls = [...document.querySelectorAll("[data-round-timer]")];
const lobbyTitle = document.getElementById("lobby-title");
const lobbySubcopy = document.getElementById("lobby-subcopy");
const lobbyChangeTeamBtn = document.getElementById("lobby-change-team-btn");
const teamOrbits = document.getElementById("team-orbits");
const welcomeMeta = document.getElementById("welcome-meta");
const playerSummary = document.getElementById("player-summary");
const submitResult = document.getElementById("submit-result");
const submitBtn = document.getElementById("submit-prompt");
const promptInputEl = document.getElementById("prompt-input");
const promptCharNoteEl = document.querySelector("#stage-prompt .prompt-char-note");
const promptCharCountEl = document.getElementById("prompt-char-count");
const blockedTitle = document.getElementById("blocked-title");
const blockedCopy = document.getElementById("blocked-copy");
const resultTitle = document.getElementById("result-title");
const resultSubcopy = document.getElementById("result-subcopy");
const ringScore = document.getElementById("ring-score");
const resultStage = document.getElementById("stage-result");
const resultScoreOrbit = document.getElementById("result-score-orbit");
const resultMainTitle = document.getElementById("result-main-title");
const resultScoreStripe = document.getElementById("result-score-stripe");
const resultTeamIcon = document.getElementById("result-team-icon");
const resultFooter = document.getElementById("result-footer");
const resultNextBtn = document.getElementById("result-next-btn");
const resultNextLabel = document.getElementById("result-next-label");
const resultDotRole = document.getElementById("result-dot-role");
const resultDotContext = document.getElementById("result-dot-context");
const resultDotResponsibilities = document.getElementById("result-dot-responsibilities");
const resultCopyRole = document.getElementById("result-copy-role");
const resultCopyContext = document.getElementById("result-copy-context");
const resultCopyResponsibilities = document.getElementById("result-copy-responsibilities");
const resultRatingRole = document.getElementById("result-rating-role");
const resultRatingContext = document.getElementById("result-rating-context");
const resultRatingResponsibilities = document.getElementById("result-rating-responsibilities");
const playerLeaderboardWrap = document.getElementById("player-leaderboard-wrap");
const playerLeaderboardTitle = document.getElementById("player-leaderboard-title");
const playerLeaderboardCopy = document.getElementById("player-leaderboard-copy");
const playerLogoutBtn = document.getElementById("player-logout-btn");
const teamChoiceButtons = [...document.querySelectorAll("[data-team-choice]")];
const teamChoiceIcons = [...document.querySelectorAll("[data-team-icon]")];
const miniTeamIcons = [...document.querySelectorAll("[data-mini-icon]")];
const briefChoiceButtons = [...document.querySelectorAll("[data-brief-choice]")];
const miniScoreEls = [...document.querySelectorAll("[data-mini-score]")];
const teamSessionLabel = document.getElementById("team-session-label");
const continueToBriefPickBtn = document.getElementById("continue-to-brief-pick");
const confirmBriefBtn = document.getElementById("confirm-brief-btn");
const jobBriefTitle = document.getElementById("job-brief-role-name") || document.getElementById("job-brief-title");
const jobBriefSubcopy = document.getElementById("job-brief-subcopy");
const copyBriefBtn = document.getElementById("copy-brief-btn");
const viewBriefBtn = document.getElementById("view-brief-btn");
const PROMPT_MAX_CHARS = 2000;
const PROMPT_WARN_CHARS = 1800;

const RESULT_DEFAULT_CARDS = [
  {
    key: "role",
    copy: "Include employment type, role, location, seniority, hybrid/onsite/remote.",
  },
  {
    key: "context",
    copy: "Include experience, critical skills, certifications and expected knowledge.",
  },
  {
    key: "responsibilities",
    copy: "Detail 2 or 3 responsibilities critical for performance.",
  },
];

const BRIEFS = {
  "business-analyst": {
    name: "Business Analyst",
    title: "Your team is recruiting for Business Analyst",
    subcopy:
      "We’re seeking an experienced Business Analyst (Sydney, hybrid) to work with stakeholders to identify needs, define requirements and support the delivery of effective solutions by translating business problems into clear, actionable insights. The role is full-time and involves gathering and documenting requirements, mapping current and future-state processes, collaborating with technical and delivery teams, facilitating workshops, and producing insights and recommendations to inform decision-making. Ideal candidates have a relevant degree, 4–7 years’ experience in business analysis or consulting, strong analytical and communication skills, the ability to simplify complexity, and experience with requirements documentation, data analysis, and Agile or similar delivery frameworks.",
    goal: "Assess requirement gathering, data interpretation, and stakeholder alignment skills.",
    include: "Include deliverables, acceptance criteria, assumptions, and measurable decision factors.",
    success: "Aim for a structured, testable output your hiring panel can score consistently.",
  },
  "policy-officer": {
    name: "Policy Officer",
    title: "Your team is recruiting for Policy Officer",
    subcopy:
      "We’re seeking a full-time Policy Officer (Sydney or Canberra, hybrid) to support the development, analysis and delivery of public policy initiatives in a regulated government environment. The role involves researching policy and legislation, drafting briefs and recommendations for senior leaders, coordinating input across internal and external stakeholders, supporting consultations, and assisting with implementation and review. Ideal candidates have a relevant degree, 3–6 years’ experience in government or policy, strong research and writing skills, sound judgement, clear communication, and the ability to collaborate, manage risk and work with attention to detail.",
    goal: "Assess candidate fit, stakeholder communication, and policy execution strength.",
    include: "Include output format, evaluation criteria, and clear constraints with measurable outcomes.",
    success: "Aim for a policy-ready framework with clear trade-offs and decision rationale.",
  },
  "customer-service-representative": {
    name: "Customer Service Representative",
    title: "Your team is recruiting for Customer Service Representative",
    subcopy:
      "We’re seeking a Customer Service Representative (Sydney, on-site, shift-based) to support customers in a fast-paced, high-volume environment, delivering timely, accurate and empathetic service while meeting quality and performance targets. The part-time role involves handling enquiries via phone, chat and email, resolving issues efficiently, escalating complex cases, maintaining accurate customer records, and achieving service and satisfaction goals. Ideal candidates have 1–3 years’ customer-facing experience, strong communication and problem-solving skills, resilience under pressure, attention to detail, and familiarity with CRM or ticketing systems, along with relevant certifications such as ITIL Foundation, a customer service/contact centre certification or product/platform certifications where applicable.",
    goal: "Assess empathy, issue resolution quality, communication clarity, and escalation judgment.",
    include: "Include response templates, quality standards, and edge-case handling expectations.",
    success: "Aim for practical scripts and metrics that improve customer outcomes and consistency.",
  },
};

const PREVIEW = (() => {
  const params = new URLSearchParams(window.location.search);
  const previewEnabled = params.get("preview") === "1" || params.has("stage");
  const rawStage = (params.get("stage") || "").trim();

  const stageAlias = {
    passcode: "passcodeEntry",
    "passcode-entry": "passcodeEntry",
    team: "team",
    lobby: "lobby",
    welcome: "roundWelcome",
    "round-welcome": "roundWelcome",
    "brief-pick": "briefPick",
    briefpick: "briefPick",
    brief: "brief",
    prompt: "prompt",
    processing: "processing",
    result: "result",
    blocked: "blocked",
    leaderboard: "playerLeaderboard",
    "player-leaderboard": "playerLeaderboard",
  };

  function normalizeStage(value) {
    if (!value) return "";
    if (stageAlias[value]) return stageAlias[value];
    if (screens[value]) return value;
    if (value.startsWith("stage-")) {
      const key = value
        .replace(/^stage-/, "")
        .replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
      if (screens[key]) return key;
    }
    return "";
  }

  return {
    enabled: previewEnabled,
    stage: normalizeStage(rawStage) || "passcodeEntry",
    brief: params.get("brief") || "policy-officer",
  };
})();

function showError(message = "") {
  const onPasscodeStage = !screens.passcodeEntry.classList.contains("hidden");
  if (passcodeError) {
    passcodeError.textContent = onPasscodeStage ? message : "";
  }
  globalError.textContent = onPasscodeStage ? "" : message;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function triggerStageEnter(stageEl) {
  if (!stageEl) return;
  stageEl.classList.remove("is-stage-entering");
  void stageEl.offsetWidth;
  stageEl.classList.add("is-stage-entering");
  window.setTimeout(() => {
    stageEl.classList.remove("is-stage-entering");
  }, STAGE_ENTER_ANIM_MS);
}

function triggerBoardEnter(boardEl) {
  if (!boardEl) return;
  boardEl.classList.remove("is-board-entering");
  void boardEl.offsetWidth;
  boardEl.classList.add("is-board-entering");
  window.setTimeout(() => {
    boardEl.classList.remove("is-board-entering");
  }, 720);
}

function animateScoreValue(el, key, target, from) {
  if (playerScoreAnimationFrames.has(key)) {
    cancelAnimationFrame(playerScoreAnimationFrames.get(key));
    playerScoreAnimationFrames.delete(key);
  }

  const start = Number.isFinite(from) ? from : target;
  if (!Number.isFinite(target)) return;
  if (start === target) {
    el.textContent = `${target}`;
    playerScoreCache.set(key, target);
    return;
  }

  const delta = Math.abs(target - start);
  const duration = Math.max(420, Math.min(1050, 440 + delta * 8));
  const startedAt = performance.now();

  const tick = (now) => {
    const t = Math.max(0, Math.min(1, (now - startedAt) / duration));
    const eased = easeOutCubic(t);
    const value = Math.round(start + (target - start) * eased);
    el.textContent = `${value}`;
    if (t < 1) {
      const rafId = requestAnimationFrame(tick);
      playerScoreAnimationFrames.set(key, rafId);
      return;
    }
    playerScoreAnimationFrames.delete(key);
    playerScoreCache.set(key, target);
  };

  const rafId = requestAnimationFrame(tick);
  playerScoreAnimationFrames.set(key, rafId);
}

function animateBoardScores(scopeEl) {
  if (!scopeEl) return;
  const scoreEls = scopeEl.querySelectorAll("[data-score-key][data-score-target]");
  scoreEls.forEach((el) => {
    const key = el.dataset.scoreKey || "";
    const target = Number(el.dataset.scoreTarget);
    if (!key || !Number.isFinite(target)) return;
    const previous = playerScoreCache.has(key) ? playerScoreCache.get(key) : Number(el.textContent) || target;
    animateScoreValue(el, key, target, previous);
  });
}

function applyPlayerRowReveal(mode) {
  if (!playerLeaderboardWrap) return;
  const prev = playerVisibleRowsByMode.get(mode) || new Set();
  const next = new Set();
  playerLeaderboardWrap.querySelectorAll(".lb-rank-row[data-row-key]:not(.is-ghost)").forEach((row) => {
    const key = row.dataset.rowKey || "";
    if (!key) return;
    next.add(key);
    if (!prev.has(key)) {
      row.classList.add("is-reveal-in");
    }
  });
  playerVisibleRowsByMode.set(mode, next);
}

function mountPlayerLeaderboard(html, signature, mode, { push = false } = {}) {
  if (signature === lastPlayerLeaderboardSignature) return;
  const prevMode = lastPlayerLeaderboardMode;
  const shouldPush = push && Boolean(playerLeaderboardWrap.innerHTML.trim());
  const modeChanged = prevMode !== mode;

  if (!modeChanged && mode.includes("add") && tryPatchPlayerScoresInPlace(html)) {
    lastPlayerLeaderboardSignature = signature;
    return;
  }

  const paint = () => {
    playerLeaderboardWrap.innerHTML = html;
    applyPlayerRowReveal(mode);
    animateBoardScores(playerLeaderboardWrap);
    lastPlayerLeaderboardSignature = signature;
    lastPlayerLeaderboardMode = mode;
  };

  if (!shouldPush) {
    if (prevMode !== mode) {
      triggerBoardEnter(playerLeaderboardWrap);
    }
    paint();
    return;
  }

  if (playerBoardPushTimer) {
    clearTimeout(playerBoardPushTimer);
    playerBoardPushTimer = 0;
  }
  playerLeaderboardWrap.classList.remove("is-push-in-right");
  playerLeaderboardWrap.classList.add("is-push-out-left");
  playerBoardPushTimer = window.setTimeout(() => {
    playerLeaderboardWrap.classList.remove("is-push-out-left");
    paint();
    playerLeaderboardWrap.classList.add("is-push-in-right");
    window.setTimeout(() => playerLeaderboardWrap.classList.remove("is-push-in-right"), 380);
    playerBoardPushTimer = 0;
  }, 190);
}

function tryPatchPlayerScoresInPlace(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  const nextRows = [...temp.querySelectorAll(".lb-rank-row[data-row-key]:not(.is-ghost)")];
  const currentRows = [...playerLeaderboardWrap.querySelectorAll(".lb-rank-row[data-row-key]:not(.is-ghost)")];
  if (!nextRows.length || nextRows.length !== currentRows.length) return false;

  for (let i = 0; i < nextRows.length; i += 1) {
    const nextKey = nextRows[i].dataset.rowKey;
    const currentKey = currentRows[i].dataset.rowKey;
    if (nextKey !== currentKey) return false;
  }

  for (let i = 0; i < nextRows.length; i += 1) {
    const nextScoreEl = nextRows[i].querySelector(".lb-score-block strong");
    const currentScoreEl = currentRows[i].querySelector(".lb-score-block strong");
    if (!nextScoreEl || !currentScoreEl) continue;

    const key = nextScoreEl.dataset.scoreKey || "";
    const target = Number(nextScoreEl.dataset.scoreTarget);
    if (!key || !Number.isFinite(target)) {
      currentScoreEl.textContent = nextScoreEl.textContent || "";
      continue;
    }

    currentScoreEl.dataset.scoreKey = key;
    currentScoreEl.dataset.scoreTarget = String(target);
    const from = Number(currentScoreEl.textContent) || 0;
    animateScoreValue(currentScoreEl, key, target, from);
  }
  return true;
}

function animateResultScore(target, { fromZero = false, force = false } = {}) {
  if (!ringScore) return;
  const safeTarget = Math.max(0, Math.min(100, Number(target) || 0));
  const current = Number(ringScore.dataset.displayScore || 0);
  const from = fromZero ? 0 : current;
  if (!force && from === safeTarget) {
    ringScore.textContent = `${safeTarget}%`;
    ringScore.dataset.displayScore = String(safeTarget);
    return;
  }

  if (resultScoreAnimationFrame) {
    cancelAnimationFrame(resultScoreAnimationFrame);
    resultScoreAnimationFrame = 0;
  }

  const duration = Math.max(520, Math.min(980, 520 + Math.abs(safeTarget - from) * 7));
  const startedAt = performance.now();

  const tick = (now) => {
    const t = Math.max(0, Math.min(1, (now - startedAt) / duration));
    const eased = easeOutCubic(t);
    const value = Math.round(from + (safeTarget - from) * eased);
    ringScore.textContent = `${value}%`;
    ringScore.dataset.displayScore = String(value);
    if (t < 1) {
      resultScoreAnimationFrame = requestAnimationFrame(tick);
      return;
    }
    ringScore.dataset.displayScore = String(safeTarget);
    ringScore.textContent = `${safeTarget}%`;
    resultScoreAnimationFrame = 0;
  };

  resultScoreAnimationFrame = requestAnimationFrame(tick);
}

function triggerResultOrbitEntrance() {
  if (!resultScoreOrbit) return;
  const score = Number(ringScore?.dataset.scoreTarget || state.lastScore || 0);
  resultScoreOrbit.classList.remove("is-entering");
  void resultScoreOrbit.offsetWidth;
  resultScoreOrbit.classList.add("is-entering");
  window.setTimeout(() => resultScoreOrbit.classList.remove("is-entering"), 760);
  animateResultScore(score, { fromZero: true, force: true });
}

async function requestFullscreenIfEnabled() {
  if (!launchFullscreenToggle?.checked) return;
  if (document.fullscreenElement) return;

  const root = document.documentElement;
  try {
    if (root.requestFullscreen) {
      await root.requestFullscreen();
      return;
    }
    if (root.webkitRequestFullscreen) {
      root.webkitRequestFullscreen();
    }
  } catch (_err) {
    // Ignore fullscreen failures to avoid blocking flow.
  }
}

async function api(path, method = "GET", body) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get("content-type") || "";
  const raw = await res.text();
  let parsed = null;

  if (contentType.includes("application/json")) {
    try {
      parsed = JSON.parse(raw);
    } catch (_err) {
      throw new Error("Server returned invalid JSON.");
    }
  }

  if (!res.ok) {
    if (parsed?.error) {
      throw new Error(parsed.error);
    }

    const htmlResponse =
      raw.startsWith("<!doctype html>") || raw.startsWith("<!DOCTYPE html>") || raw.startsWith("<html");
    if (htmlResponse) {
      throw new Error("API returned HTML instead of JSON. Use /index.html.");
    }

    throw new Error(raw || `Request failed (${res.status}).`);
  }

  if (parsed) {
    return parsed;
  }

  throw new Error("API returned non-JSON response.");
}

function setStage(active) {
  if (!screens[active]) return;

  if (activeStageKey === active) {
    document.body.classList.toggle("leaderboard-screen", active === "playerLeaderboard");
    if (active !== "passcodeEntry" && passcodeError) {
      passcodeError.textContent = "";
    }
    window.dispatchEvent(new Event("liha:layout-change"));
    return;
  }

  Object.values(screens).forEach((screen) => {
    screen.classList.add("hidden");
  });
  screens[active].classList.remove("hidden");
  document.body.classList.toggle("leaderboard-screen", active === "playerLeaderboard");
  triggerStageEnter(screens[active]);
  if (active === "result") {
    triggerResultOrbitEntrance();
  }
  activeStageKey = active;
  if (active !== "passcodeEntry" && passcodeError) {
    passcodeError.textContent = "";
  }
  window.dispatchEvent(new Event("liha:layout-change"));
}

function formatMs(ms) {
  const min = Math.floor(ms / 60000)
    .toString()
    .padStart(2, "0");
  const sec = Math.floor((ms % 60000) / 1000)
    .toString()
    .padStart(2, "0");
  return `${min}:${sec}`;
}

function sessionVisualGroup() {
  const params = new URLSearchParams(window.location.search);
  const explicit = (params.get("group") || params.get("session") || "").toUpperCase();
  const session = (state.sessionId || "").toUpperCase();
  if (session === "B" || explicit === "B") return "B";
  return "A";
}

function teamIconPath(team) {
  const group = sessionVisualGroup();
  const byTeam = {
    red: "01",
    green: "02",
    yellow: "03",
    blue: "04",
  };
  const code = byTeam[team] || "01";
  return `/assets/images/team-${group}_${code}.png`;
}

function teamCell(team) {
  return `<span class="team-cell"><img class="team-icon" src="${teamIconPath(team)}" alt="${team} team" />${team.toUpperCase()}</span>`;
}

function currentRemainingMs() {
  if (state.roundEndsAt) {
    const nowServer = Date.now() + state.serverOffsetMs;
    return Math.max(0, state.roundEndsAt - nowServer);
  }
  return Math.max(0, state.roundRemainingMs || 0);
}

function welcomeRemainingMs() {
  if (!state.roundStartsAt) return 0;
  if (state.phase !== "round" || state.hasSeenRoundWelcome) return 0;
  const nowServer = Date.now() + state.serverOffsetMs;
  return Math.max(0, state.roundStartsAt - nowServer);
}

function updateTimer() {
  const remainingMs = currentRemainingMs();
  const text = formatMs(remainingMs);
  if (timerEl) timerEl.textContent = text;
  if (promptTimerEl) promptTimerEl.textContent = text;
  if (welcomeTimerEl) welcomeTimerEl.textContent = text;
  roundTimerEls.forEach((el) => {
    el.textContent = text;
  });
  if (welcomeCountdownEl) {
    const msLeft = welcomeRemainingMs();
    const inWelcome = computeStage(findCurrentPlayer()) === "roundWelcome";
    if (inWelcome && msLeft > 0) {
      welcomeCountdownEl.textContent = `${Math.max(0, Math.ceil(msLeft / 1000))}`;
    } else if (inWelcome && !PREVIEW.enabled && msLeft === 0) {
      welcomeCountdownEl.textContent = "0";
      markWelcomeSeenAndAdvance();
    } else {
      welcomeCountdownEl.textContent = `${Math.max(1, Math.ceil(remainingMs / 60000))}`;
    }
  }
}

function markWelcomeSeenAndAdvance() {
  if (state.hasSeenRoundWelcome) return;
  state.hasSeenRoundWelcome = true;
  localStorage.setItem("promptArenaRoundWelcomeSeen", "1");
  fetchState().catch(() => { });
}

function renderTeamChoices() {
  teamChoiceButtons.forEach((button, index) => {
    const team = button.dataset.teamChoice;
    const selected = team === state.selectedTeam;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    button.style.setProperty("--row-delay", `${Math.min(360, index * 90)}ms`);
  });

  teamChoiceIcons.forEach((icon) => {
    const team = icon.dataset.teamIcon || "";
    icon.src = teamIconPath(team);
  });
}

function renderBriefChoices() {
  briefChoiceButtons.forEach((button, index) => {
    const brief = button.dataset.briefChoice;
    const selected = brief === state.selectedBrief;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    button.style.setProperty("--row-delay", `${Math.min(360, index * 90)}ms`);
  });
}

function updateJobBriefContent() {
  const brief = BRIEFS[state.selectedBrief] || BRIEFS["policy-officer"];
  const roleName = brief.name;
  jobBriefTitle.textContent = roleName;
  jobBriefTitle.classList.toggle("long-role-title", roleName.length >= 24);
  const formatted = String(brief.subcopy || "")
    .replace(" The role involves ", "</p><p><strong>The role involves</strong> ")
    .replace(" Ideal candidates", "</p><p><strong>Ideal candidates</strong>");
  jobBriefSubcopy.innerHTML = `<p>${formatted}</p>`;
}

function updatePromptCharCounter() {
  if (!promptInputEl || !promptCharCountEl) return;

  if (promptInputEl.value.length > PROMPT_MAX_CHARS) {
    promptInputEl.value = promptInputEl.value.slice(0, PROMPT_MAX_CHARS);
  }

  const count = promptInputEl.value.length;
  const nearLimit = count >= PROMPT_WARN_CHARS;
  promptCharCountEl.textContent = `${count}/${PROMPT_MAX_CHARS}`;
  promptCharCountEl.classList.toggle("is-warning", nearLimit);
  if (promptCharNoteEl) {
    promptCharNoteEl.classList.toggle("show-count", nearLimit);
  }
}

function deriveSectionScores(totalScore, sections) {
  const clampPercent = (value) => Math.max(0, Math.min(100, Number(value) || 0));
  if (sections && typeof sections === "object") {
    return [
      clampPercent(sections.role),
      clampPercent(sections.context),
      clampPercent(sections.responsibilities),
    ];
  }
  const fallback = clampPercent(totalScore);
  return [fallback, fallback, fallback];
}

function sectionTone(score) {
  if (score >= 100) return "good";
  if (score > 0) return "mid";
  return "bad";
}

function sectionRating(score) {
  if (score >= 100) return "All present";
  if (score > 0) return "Partially present";
  return "Missing";
}

function resultToneFromScore(score) {
  if (score >= 80) return "success";
  return "fail";
}

function resultCaption(tone) {
  if (tone === "success") return '"You prompt like a pro!"';
  return '"Ouch. Try again"';
}

function renderResult(current) {
  const score = Math.max(0, Math.min(100, Number(state.lastScore || current?.player?.score || 0)));
  const sectionScores = deriveSectionScores(score, current?.player?.sectionScores);
  const tone = resultToneFromScore(score);
  const cards = RESULT_DEFAULT_CARDS;

  ringScore.dataset.scoreTarget = String(score);
  if (activeStageKey === "result") {
    animateResultScore(score);
  } else {
    ringScore.textContent = `${score}%`;
    ringScore.dataset.displayScore = String(score);
  }
  resultTitle.textContent = resultCaption(tone);
  resultSubcopy.textContent = String(
    state.lastFeedback ||
    current?.player?.feedback ||
    "Could be even more specific about the organisation or sector, which would make the output feel more tailored and less generic."
  ).trim();

  if (resultTeamIcon) {
    resultTeamIcon.src = teamIconPath(state.playerTeam || current?.team || "red");
  }

  if (resultMainTitle) {
    resultMainTitle.textContent = "What you did well";
  }

  const dots = [resultDotRole, resultDotContext, resultDotResponsibilities];
  const copies = [resultCopyRole, resultCopyContext, resultCopyResponsibilities];
  const ratings = [resultRatingRole, resultRatingContext, resultRatingResponsibilities];

  sectionScores.forEach((value, index) => {
    const dot = dots[index];
    const copy = copies[index];
    const rating = ratings[index];
    if (dot) {
      dot.dataset.tone = sectionTone(value);
    }
    if (copy) {
      const key = ["role", "context", "responsibilities"][index];
      const customComment = current?.player?.sectionComments?.[key];
      copy.textContent = customComment || cards[index].copy;
    }
    if (rating) {
      rating.textContent = sectionRating(value);
    }
  });

  if (resultStage) {
    resultStage.classList.remove("result-tone-success", "result-tone-warn", "result-tone-fail");
    resultStage.classList.add(`result-tone-${tone}`);
  }

  const failed = state.failedAttempt || score < 80;
  if (resultNextBtn && resultNextLabel) {
    resultNextLabel.textContent = failed ? "Try again" : "Waiting for others to finish";
    resultNextBtn.disabled = !failed;
    resultNextBtn.classList.toggle("result-wait-chip", !failed);
  }

  if (resultFooter) {
    resultFooter.dataset.mode = failed ? "try-again" : "waiting";
  }

  if (resultScoreStripe) {
    resultScoreStripe.dataset.tone = tone;
  }
}

async function copyBriefToClipboard() {
  if (!copyBriefBtn) return;
  const brief = BRIEFS[state.selectedBrief] || BRIEFS["policy-officer"];
  const text = String(brief.subcopy || "").trim();

  const legacyCopy = () => {
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.left = "-9999px";
    document.body.appendChild(helper);
    helper.select();
    const copied = document.execCommand("copy");
    helper.remove();
    return copied;
  };

  try {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
      } catch (_err) {
        if (!legacyCopy()) {
          throw _err;
        }
      }
    } else {
      if (!legacyCopy()) {
        throw new Error("copy failed");
      }
    }
    copyBriefBtn.classList.add("copied");
    setTimeout(() => copyBriefBtn.classList.remove("copied"), 1200);
  } catch (_err) {
    showError("Could not copy brief.");
  }
}

function findCurrentPlayer() {
  for (const row of state.leaderboard) {
    for (const player of row.players) {
      if (player.id === state.playerId) {
        return { player, team: row.team };
      }
    }
  }
  return null;
}

function renderTeamOrbits() {
  const order = ["red", "blue", "green", "yellow"];
  const byTeam = new Map(state.leaderboard.map((row) => [row.team, row]));

  teamOrbits.innerHTML = order
    .map((team, idx) => {
      const row = byTeam.get(team) || { team, playerCount: 0 };
      const count = Math.max(0, Number(row.playerCount) || 0);
      const delay = Math.min(360, idx * 90);
      return `<div class="orbit team-${row.team}" style="--row-delay:${delay}ms">
        <img class="orbit-icon" src="${teamIconPath(row.team)}" alt="${row.team} team" />
        <div class="orbit-badge">${count}</div>
      </div>`;
    })
    .join("");
}

function renderMiniTeamBoard() {
  const byTeam = new Map((state.leaderboard || []).map((row) => [row.team, row]));
  miniScoreEls.forEach((el) => {
    const team = el.dataset.miniScore || "";
    const row = byTeam.get(team);
    const value = row ? row.score : PREVIEW.enabled ? 230 : 0;
    el.textContent = `${value}pt`;
  });
  miniTeamIcons.forEach((icon) => {
    const team = icon.dataset.miniIcon || "";
    icon.src = teamIconPath(team);
  });
}

function renderPlayerLeaderboard() {
  const previousMode = lastPlayerLeaderboardMode;
  const now = Date.now() + state.serverOffsetMs;
  const promptAt = Number.isFinite(state.promptCompletedAt) ? state.promptCompletedAt : null;
  const trustAt = Number.isFinite(state.trustWho?.completedAt) ? state.trustWho.completedAt : null;

  const reveals = [];
  if (promptAt && now < promptAt + RESULTS_REVEAL_MS) reveals.push({ type: "prompt", at: promptAt });
  if (trustAt && now < trustAt + RESULTS_REVEAL_MS) reveals.push({ type: "trust", at: trustAt });
  reveals.sort((a, b) => b.at - a.at);
  const reveal = reveals[0] || null;

  if (reveal?.type === "trust") {
    const rows = [...state.leaderboard].sort((a, b) => {
      const bt = Number(b?.trustBonus) || 0;
      const at = Number(a?.trustBonus) || 0;
      const bs = Number(b?.score) || 0;
      const as = Number(a?.score) || 0;
      return bt - at || bs - as || String(a?.team || "").localeCompare(String(b?.team || ""));
    });
    const stepMs = rows.length ? RESULTS_REVEAL_MS / rows.length : RESULTS_REVEAL_MS;
    const visibleCount = Math.min(rows.length, Math.max(1, Math.floor((now - reveal.at) / stepMs) + 1));
    const revealFrom = Math.max(0, rows.length - visibleCount);
    const visible = rows.map((row, idx) => (idx < revealFrom ? { ...row, ghost: true } : row));
    const secondsLeft = Math.max(0, Math.ceil((reveal.at + RESULTS_REVEAL_MS - now) / 1000));

    const boardTitle = "Trust Who Results";
    const metricLabel = "Trust Who points";
    const rowsForView = visible.map((row) => ({
      ...row,
      displayScore: row.ghost ? "" : row.trustBonus,
      metricKey: "trust",
    }));
    const html = renderSingleLeaderboardLayout(rowsForView, state.sessionId, boardTitle, metricLabel);
    const signature = `${boardTitle}|${metricLabel}|${html}`;
    playerLeaderboardTitle.textContent = boardTitle;
    playerLeaderboardCopy.textContent = `Revealing bottom to top. Combined leaderboard in ${secondsLeft}s.`;
    mountPlayerLeaderboard(html, signature, "trust-reveal");
    return;
  }

  if (reveal?.type === "prompt") {
    const rows = [...state.leaderboard].sort((a, b) => {
      const bp = Number(b?.promptScore) || 0;
      const ap = Number(a?.promptScore) || 0;
      const ba = Number(b?.averagePercent) || 0;
      const aa = Number(a?.averagePercent) || 0;
      return bp - ap || ba - aa || String(a?.team || "").localeCompare(String(b?.team || ""));
    });
    const stepMs = rows.length ? RESULTS_REVEAL_MS / rows.length : RESULTS_REVEAL_MS;
    const visibleCount = Math.min(rows.length, Math.max(1, Math.floor((now - reveal.at) / stepMs) + 1));
    const revealFrom = Math.max(0, rows.length - visibleCount);
    const visible = rows.map((row, idx) => (idx < revealFrom ? { ...row, ghost: true } : row));
    const secondsLeft = Math.max(0, Math.ceil((reveal.at + RESULTS_REVEAL_MS - now) / 1000));

    const boardTitle = "Prompt Like a Pro Results";
    const metricLabel = "Prompt points";
    const rowsForView = visible.map((row) => ({
      ...row,
      displayScore: row.ghost ? "" : row.promptScore,
      metricKey: "prompt",
    }));
    const html = renderSingleLeaderboardLayout(rowsForView, state.sessionId, boardTitle, metricLabel);
    const signature = `${boardTitle}|${metricLabel}|${html}`;
    playerLeaderboardTitle.textContent = boardTitle;
    playerLeaderboardCopy.textContent = `Revealing bottom to top. Combined leaderboard in ${secondsLeft}s.`;
    mountPlayerLeaderboard(html, signature, "prompt-reveal");
    return;
  }

  const addCandidates = [];
  if (promptAt && now >= promptAt + RESULTS_REVEAL_MS && now < promptAt + RESULTS_REVEAL_MS + COMBINED_ADD_MS) {
    addCandidates.push({ type: "prompt", at: promptAt });
  }
  if (trustAt && now >= trustAt + RESULTS_REVEAL_MS && now < trustAt + RESULTS_REVEAL_MS + COMBINED_ADD_MS) {
    addCandidates.push({ type: "trust", at: trustAt });
  }
  addCandidates.sort((a, b) => b.at - a.at);
  const adding = addCandidates[0] || null;

  const rows = adding
    ? [...state.leaderboard].sort((a, b) => {
      const addA = adding.type === "trust" ? a.trustBonus : a.promptScore;
      const addB = adding.type === "trust" ? b.trustBonus : b.promptScore;
      const baseA = a.score - addA;
      const baseB = b.score - addB;
      return baseB - baseA || b.score - a.score || String(a?.team || "").localeCompare(String(b?.team || ""));
    })
    : [...state.leaderboard].sort((a, b) => {
      const bs = Number(b?.score) || 0;
      const as = Number(a?.score) || 0;
      const bp = Number(b?.promptScore) || 0;
      const ap = Number(a?.promptScore) || 0;
      return bs - as || bp - ap || String(a?.team || "").localeCompare(String(b?.team || ""));
    });
  const progress = adding ? Math.max(0, Math.min(1, (now - (adding.at + RESULTS_REVEAL_MS)) / COMBINED_ADD_MS)) : 1;
  const animatedRows = rows.map((row) => {
    if (!adding) return { ...row, displayScore: row.score };
    const addValue = adding.type === "trust" ? row.trustBonus : row.promptScore;
    const baseValue = row.score - addValue;
    return { ...row, displayScore: Math.round(baseValue + addValue * progress) };
  });

  const boardTitle = "Leaderboard";
  const metricLabel = "Total points";
  const rowsForView = animatedRows.map((row) => ({ ...row, metricKey: "combined" }));
  const html = renderSingleLeaderboardLayout(rowsForView, state.sessionId, boardTitle, metricLabel);
  const signature = `${boardTitle}|${metricLabel}|${html}`;
  playerLeaderboardTitle.textContent = boardTitle;
  playerLeaderboardCopy.textContent = adding
    ? `Adding ${adding.type === "trust" ? "Trust Who" : "Prompt Like a Pro"} points to leaderboard...`
    : "Combined points (Prompt Like a Pro + Trust Who).";
  const mode = adding ? `combined-add-${adding.type}` : "combined";
  const push = /^(.+)-reveal$/.test(lastPlayerLeaderboardMode) && mode.startsWith("combined");
  mountPlayerLeaderboard(html, signature, mode, { push });
  if (/^combined-add-/.test(previousMode) && mode === "combined") {
    window.LihaLottie?.playBig?.();
  }
}

function sessionTitleForGroup(sessionLabel) {
  return String(sessionLabel || "A").toUpperCase() === "B" ? "Session 2" : "Session 1";
}

function rankRowsMarkup(rows, sessionLabel) {
  return rows
    .map((row, idx) => {
      const rank = idx + 1;
      const topClass = rank === 1 && !row.ghost ? " is-top" : "";
      const delay = Math.min(360, (rows.length - idx - 1) * 95);
      const scoreKey = `${String(sessionLabel || "A").toUpperCase()}-${row.team || "ghost"}-${row.metricKey || "total"}`;
      const scoreValue = Number(row.displayScore);
      const scoreAttrs =
        !row.ghost && Number.isFinite(scoreValue)
          ? ` data-score-key="${scoreKey}" data-score-target="${scoreValue}"`
          : "";
      const ghostClass = row.ghost ? " is-ghost" : "";
      const rowKey = row.team || `ghost-${idx}`;
      return `<article class="lb-rank-row${topClass}${ghostClass}" data-row-key="${rowKey}" style="--row-delay:${delay}ms">
        <span class="lb-rank-number">${rank}</span>
        ${row.ghost
          ? '<span class="lb-team-icon lb-team-icon-ghost" aria-hidden="true"></span>'
          : `<img class="lb-team-icon" src="${teamIconPath(row.team)}" alt="${row.team.toUpperCase()} team" />`}
        <div class="lb-score-block">
          <span class="lb-score-divider" aria-hidden="true"></span>
          <strong${scoreAttrs}>${row.displayScore ?? ""}</strong>
        </div>
      </article>`;
    })
    .join("");
}

function renderSingleLeaderboardLayout(rows, sessionLabel, boardTitle = "Leaderboard", metricLabel = "Total points") {
  const listRows = rows.length ? rows : [{ team: "red", displayScore: 0 }];
  return `<div class="lb-main-grid lb-main-grid-single">
    <aside class="lb-title-card">${boardTitle}</aside>
    <section class="lb-session-grid lb-session-grid-single">
      <section class="lb-session-column">
        <h2>${sessionTitleForGroup(sessionLabel)}</h2>
        <p>${metricLabel}</p>
        <div class="lb-rank-list">
          ${rankRowsMarkup(listRows, sessionLabel)}
        </div>
      </section>
    </section>
  </div>`;
}

function desiredPlayerStage(current) {
  if (!current) return "";

  if (state.phase === "lobby") return "lobby";
  if (state.phase === "round") {
    if (!state.hasSeenRoundWelcome) return "welcome";
    if (current.player.submitted) return "completed";
    return state.playerReady ? "prompting" : "briefing";
  }
  if (state.phase === "leaderboard") return "completed";

  return current.player.progressStage || "lobby";
}

function syncPlayerStage(current) {
  const stage = desiredPlayerStage(current);
  if (!state.playerId || !stage) return;
  api("/api/player-stage", "POST", { playerId: state.playerId, stage }).catch(() => { });
}

function updateStageContent(current) {
  renderTeamChoices();
  renderBriefChoices();
  renderMiniTeamBoard();
  updateJobBriefContent();
  renderPlayerLeaderboard();
  updateTimer();

  if (state.sessionId && teamSessionLabel) {
    teamSessionLabel.textContent = `Group ${state.sessionId}`;
  }

  if (state.phase === "lobby") {
    lobbyTitle.textContent = "Lobby";
    lobbySubcopy.textContent = "Waiting for others to join...";
    renderTeamOrbits();
  }

  if (state.phase === "round") {
    if (state.roundPausedAt) {
      lobbyTitle.textContent = "Round paused";
      lobbySubcopy.textContent = "Master paused the timer. Stay ready.";
    } else {
      lobbyTitle.textContent = "Round live";
      lobbySubcopy.textContent = "Submit your prompt before time runs out.";
    }
  }

  if (!current) {
    welcomeMeta.textContent = state.sessionId
      ? `Passcode accepted for Group ${state.sessionId}.`
      : "Enter passcode to continue.";
    return;
  }

  state.playerTeam = current.team;
  localStorage.setItem("promptArenaPlayerTeam", state.playerTeam);
  const briefName = BRIEFS[state.selectedBrief]?.name || "No brief selected";
  playerSummary.textContent = briefName;
  playerSummary.classList.toggle("long-role-title", briefName.length >= 24);

  const canSubmit = state.phase === "round" && !state.roundPausedAt && !current.player.submitted;
  submitBtn.disabled = !canSubmit;

  if (current.player.submitted || state.failedAttempt) {
    renderResult(current);
  }
}

function computeStage(current) {
  if (state.isProcessing) return "processing";

  if (!state.playerId) {
    if (state.joinStep === "team" && state.sessionId) {
      return "team";
    }
    return "passcodeEntry";
  }

  if (state.phase === "leaderboard") return "playerLeaderboard";
  if (state.phase === "lobby") {
    if (state.teamEditMode && state.playerId) return "team";
    return "lobby";
  }

  if (state.phase === "round") {
    if (!state.hasSeenRoundWelcome) return "roundWelcome";
    if (state.forceBriefView && !current?.player?.submitted) return "brief";
    if (state.retryingFromFail && !current?.player?.submitted) return "prompt";
    if (state.failedAttempt || current?.player?.submitted) return "result";
    if (!state.briefConfirmed || !BRIEFS[state.selectedBrief]) return "briefPick";
    if (!state.playerReady) return "brief";
    return "prompt";
  }

  blockedTitle.textContent = "Game is not active.";
  blockedCopy.textContent = "Wait for your session to start the next game round.";
  return "blocked";
}

function clearLocalPlayerState() {
  state.playerId = "";
  state.sessionId = "";
  state.playerTeam = "";
  state.playerReady = false;
  state.passcode = "";
  state.joinStep = "passcode";
  state.selectedBrief = "";
  state.briefConfirmed = false;
  state.hasSeenRoundWelcome = false;
  state.failedAttempt = false;
  state.retryingFromFail = false;
  state.forceBriefView = false;
  state.teamEditMode = false;
  state.isProcessing = false;
  state.lastScore = "";
  state.lastFeedback = "";

  localStorage.removeItem("promptArenaPlayerId");
  localStorage.removeItem("promptArenaSessionId");
  localStorage.removeItem("promptArenaPlayerTeam");
  localStorage.removeItem("promptArenaPlayerReady");
  localStorage.removeItem("promptArenaPasscode");
  localStorage.removeItem("promptArenaJoinStep");
  localStorage.removeItem("promptArenaSelectedBrief");
  localStorage.removeItem("promptArenaBriefConfirmed");
  localStorage.removeItem("promptArenaRoundWelcomeSeen");
  localStorage.removeItem("promptArenaLastScore");
  localStorage.removeItem("promptArenaLastFeedback");

  const passcodeInput = document.getElementById("passcode");
  const promptInput = document.getElementById("prompt-input");
  if (passcodeInput) passcodeInput.value = "";
  if (promptInput) promptInput.value = "";
}

async function fetchState() {
  try {
    if (!state.sessionId) {
      updateStageContent(null);
      setStage(computeStage(null));
      return;
    }

    const data = await api(`/api/state?session=${encodeURIComponent(state.sessionId)}`);
    state.phase = data.phase;
    state.promptCompletedAt = data.promptCompletedAt;
    state.trustWho = data.trustWho || null;
    state.roundStartsAt = data.roundStartsAt;
    state.roundEndsAt = data.roundEndsAt;
    state.roundPausedAt = data.roundPausedAt;
    state.roundRemainingMs = data.roundRemainingMs;
    state.leaderboard = data.leaderboard || [];
    state.serverOffsetMs = data.serverTime - Date.now();

    const current = findCurrentPlayer();
    if (!current && state.playerId) {
      clearLocalPlayerState();
      updateStageContent(null);
      setStage(computeStage(null));
      return;
    }

    if (state.phase === "lobby" && state.playerReady) {
      state.playerReady = false;
      localStorage.setItem("promptArenaPlayerReady", "0");
    }
    if (state.phase === "lobby") {
      state.hasSeenRoundWelcome = false;
      state.selectedBrief = "";
      state.briefConfirmed = false;
      localStorage.removeItem("promptArenaRoundWelcomeSeen");
      localStorage.removeItem("promptArenaSelectedBrief");
      localStorage.removeItem("promptArenaBriefConfirmed");
    } else {
      state.teamEditMode = false;
    }

    if (state.phase !== "round") {
      state.failedAttempt = false;
      state.retryingFromFail = false;
      state.forceBriefView = false;
      state.isProcessing = false;
    }

    updateStageContent(current);
    const nextStage = computeStage(current);
    setStage(nextStage);
    syncPlayerStage(current);
  } catch (err) {
    showError(err.message);
  }
}

document.getElementById("check-passcode-btn").addEventListener("click", async () => {
  showError("");

  try {
    const passcode = document.getElementById("passcode").value.trim().toUpperCase();
    const res = await api("/api/passcode-check", "POST", { passcode });
    await requestFullscreenIfEnabled();

    state.passcode = passcode;
    state.sessionId = res.session;
    state.joinStep = "team";

    localStorage.setItem("promptArenaPasscode", state.passcode);
    localStorage.setItem("promptArenaSessionId", state.sessionId);
    localStorage.setItem("promptArenaJoinStep", state.joinStep);

    await fetchState();
  } catch (err) {
    showError(err.message);
  }
});

const passcodeInputEl = document.getElementById("passcode");
if (passcodeInputEl) {
  passcodeInputEl.addEventListener("input", () => {
    passcodeInputEl.value = passcodeInputEl.value.toUpperCase();
  });
}

document.getElementById("change-passcode-btn").addEventListener("click", () => {
  state.joinStep = "passcode";
  state.sessionId = "";
  state.passcode = "";
  localStorage.removeItem("promptArenaSessionId");
  localStorage.removeItem("promptArenaPasscode");
  localStorage.setItem("promptArenaJoinStep", "passcode");
  showError("");
  setStage("passcodeEntry");
});

document.getElementById("join-session-btn").addEventListener("click", async () => {
  showError("");

  try {
    if (state.playerId) {
      const res = await api("/api/player/change-team", "POST", {
        playerId: state.playerId,
        team: state.selectedTeam,
      });
      state.playerTeam = res.player.team;
      localStorage.setItem("promptArenaPlayerTeam", state.playerTeam);
      state.teamEditMode = false;
    } else {
      const res = await api("/api/join", "POST", {
        session: state.sessionId,
        team: state.selectedTeam,
        passcode: state.passcode,
      });

      state.playerId = res.playerId;
      state.playerTeam = res.player.team;
      state.playerReady = false;
      state.failedAttempt = false;
      state.retryingFromFail = false;

      localStorage.setItem("promptArenaPlayerId", state.playerId);
      localStorage.setItem("promptArenaPlayerTeam", state.playerTeam);
      localStorage.setItem("promptArenaPlayerReady", "0");
    }

    await fetchState();
  } catch (err) {
    showError(err.message);
  }
});

if (lobbyChangeTeamBtn) {
  lobbyChangeTeamBtn.addEventListener("click", () => {
    if (!state.playerId || state.phase !== "lobby") return;
    showError("");
    state.teamEditMode = true;
    setStage("team");
  });
}

document.getElementById("ready-to-prompt").addEventListener("click", async () => {
  state.forceBriefView = false;
  state.playerReady = true;
  localStorage.setItem("promptArenaPlayerReady", "1");
  await fetchState();
});

continueToBriefPickBtn.addEventListener("click", async () => {
  showError("");
  markWelcomeSeenAndAdvance();
});

confirmBriefBtn.addEventListener("click", async () => {
  showError("");
  if (!BRIEFS[state.selectedBrief]) {
    showError("Please pick a brief to continue.");
    return;
  }
  state.briefConfirmed = true;
  localStorage.setItem("promptArenaBriefConfirmed", "1");
  await fetchState();
});

document.getElementById("submit-prompt").addEventListener("click", async () => {
  showError("");
  submitResult.textContent = "";

  const prompt = document.getElementById("prompt-input").value;
  if (!prompt.trim()) {
    showError("Prompt is required.");
    return;
  }
  window.LihaLottie?.playSmallOnElement?.(submitBtn);

  state.isProcessing = true;
  state.retryingFromFail = false;
  setStage("processing");
  const startedAt = Date.now();

  try {
    const res = await api("/api/submit", "POST", {
      playerId: state.playerId,
      prompt,
      brief: state.selectedBrief,
    });

    state.lastScore = String(res.score);
    state.lastFeedback = res.feedback;
    localStorage.setItem("promptArenaLastScore", state.lastScore);
    localStorage.setItem("promptArenaLastFeedback", state.lastFeedback);

    if (res.failed) {
      state.failedAttempt = true;
    } else {
      state.failedAttempt = false;
      submitResult.textContent = `Score ${res.score}%. ${res.feedback}`;
    }
  } catch (err) {
    showError(err.message);
  } finally {
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(0, 5000 - elapsed);
    if (remaining) {
      await delay(remaining);
    }
    state.isProcessing = false;
    await fetchState();
  }
});

if (promptInputEl) {
  promptInputEl.setAttribute("maxlength", String(PROMPT_MAX_CHARS));
  promptInputEl.addEventListener("input", updatePromptCharCounter);
  updatePromptCharCounter();
}

if (resultNextBtn) {
  resultNextBtn.addEventListener("click", () => {
    if (resultNextBtn.disabled) return;
    state.failedAttempt = false;
    state.retryingFromFail = true;
    state.lastScore = "";
    state.lastFeedback = "";
    setStage("prompt");
  });
}

teamChoiceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.selectedTeam = button.dataset.teamChoice || "red";
    localStorage.setItem("promptArenaSelectedTeam", state.selectedTeam);
    renderTeamChoices();
  });
});

briefChoiceButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showError("");
    state.selectedBrief = button.dataset.briefChoice || "";
    state.briefConfirmed = false;
    localStorage.setItem("promptArenaSelectedBrief", state.selectedBrief);
    localStorage.removeItem("promptArenaBriefConfirmed");
    renderBriefChoices();
    updateJobBriefContent();
  });
});

if (copyBriefBtn) {
  copyBriefBtn.addEventListener("click", copyBriefToClipboard);
}

if (viewBriefBtn) {
  viewBriefBtn.addEventListener("click", () => {
    showError("");
    state.forceBriefView = true;
    state.retryingFromFail = false;
    state.playerReady = false;
    localStorage.setItem("promptArenaPlayerReady", "0");
    setStage("brief");
    syncPlayerStage(findCurrentPlayer());
  });
}

if (playerLogoutBtn) {
  playerLogoutBtn.addEventListener("click", () => {
    showError("");
    clearLocalPlayerState();
    updateStageContent(null);
    setStage("passcodeEntry");
  });
}

if (!PREVIEW.enabled) {
  setInterval(fetchState, 2000);
  setInterval(updateTimer, 500);
}

(async function init() {
  renderTeamChoices();
  renderMiniTeamBoard();
  if (PREVIEW.enabled) {
    showError("");
    state.selectedBrief = BRIEFS[PREVIEW.brief] ? PREVIEW.brief : "policy-officer";
    state.briefConfirmed = true;
    state.playerReady = true;
    state.hasSeenRoundWelcome = PREVIEW.stage !== "roundWelcome";
    state.lastScore = "87";
    state.lastFeedback = "Strong structure with clear hiring constraints and outputs.";
    state.sessionId = "A";
    state.playerId = "preview-player";
    state.playerTeam = state.selectedTeam;
    state.roundRemainingMs = 15 * 60 * 1000;
    state.leaderboard = [
      { team: "red", playerCount: 0, score: 230, promptScore: 160, trustBonus: 70, averagePercent: 80, players: [] },
      { team: "blue", playerCount: 0, score: 230, promptScore: 160, trustBonus: 70, averagePercent: 80, players: [] },
      {
        team: "green",
        playerCount: 1,
        score: 230,
        promptScore: 160,
        trustBonus: 70,
        averagePercent: 80,
        players: [{ id: "preview-player", submitted: PREVIEW.stage === "result", score: 87, feedback: state.lastFeedback }],
      },
      { team: "yellow", playerCount: 0, score: 230, promptScore: 160, trustBonus: 70, averagePercent: 80, players: [] },
    ];

    if (PREVIEW.stage === "lobby") {
      state.phase = "lobby";
    } else if (
      PREVIEW.stage === "roundWelcome" ||
      PREVIEW.stage === "briefPick" ||
      PREVIEW.stage === "brief" ||
      PREVIEW.stage === "prompt" ||
      PREVIEW.stage === "processing" ||
      PREVIEW.stage === "result"
    ) {
      state.phase = "round";
    } else if (PREVIEW.stage === "playerLeaderboard") {
      state.phase = "leaderboard";
    } else {
      state.phase = "closed";
    }

    const previewCurrent = {
      team: state.playerTeam,
      player: {
        id: state.playerId,
        submitted: PREVIEW.stage === "result",
        score: Number(state.lastScore),
        feedback: state.lastFeedback,
        sectionComments: {
          role: "Good inclusion of seniority and work mode.",
          context: "Missing specific certifications required.",
          responsibilities: "Clear articulation of primary duties."
        }
      },
    };

    state.roundStartsAt = Date.now() + 15_000;
    state.roundEndsAt = state.roundStartsAt + state.roundRemainingMs;
    if (PREVIEW.stage === "roundWelcome" && welcomeCountdownEl) welcomeCountdownEl.textContent = "15";

    resultTitle.textContent = `Nice work. Prompt score: ${state.lastScore}%`;
    resultSubcopy.textContent = state.lastFeedback;
    ringScore.textContent = `${state.lastScore}%`;
    updateJobBriefContent();
    renderBriefChoices();
    updateStageContent(previewCurrent);
    setStage(PREVIEW.stage);
    updateTimer();
    return;
  }

  if (state.playerId && !state.sessionId) {
    clearLocalPlayerState();
  }
  if (!state.playerId) {
    state.joinStep = "passcode";
    state.sessionId = "";
    state.passcode = "";
    localStorage.setItem("promptArenaJoinStep", "passcode");
    localStorage.removeItem("promptArenaSessionId");
    localStorage.removeItem("promptArenaPasscode");
  }
  await fetchState();
})();
