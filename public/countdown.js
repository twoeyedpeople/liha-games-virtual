const titleEl = document.getElementById("countdown-title");
const copyEl = document.getElementById("countdown-copy");
const groupEl = document.getElementById("countdown-group");
const timerEl = document.getElementById("countdown-timer");
const boardEl = document.getElementById("countdown-board");
const transitionLoaderEl = document.getElementById("countdown-transition-loader");
const transitionLoaderFillEl = document.getElementById("countdown-transition-fill");
const TEAM_ORDER = ["red", "blue", "green", "yellow"];
const SWITCH_TO_COMBINED_MS = 10_000;
const COMBINED_ADD_MS = 3_000;
const COMPLETION_FLASH_MS = 500;
const TIMES_HOLD_MS = 5_000;
const CHALLENGE_MODE = window.COUNTDOWN_CHALLENGE === "soft" ? "soft" : "trust";
const CHALLENGE_LABEL = CHALLENGE_MODE === "soft" ? "Soft Skills Significance" : "Trust Who";
const CHALLENGE_DATA_KEY = CHALLENGE_MODE === "soft" ? "softSkills" : "trustWho";
const CHALLENGE_DISPLAY_ENDPOINT = CHALLENGE_MODE === "soft" ? "/api/soft-skills/display" : "/api/trust-who/display";
let lastBoardSignature = "";
let lastBoardMode = "";
let boardPushTimer = 0;
const visibleRowsByMode = new Map();
const stageEl = document.querySelector(".stage");

if (stageEl) {
  stageEl.classList.add("is-stage-entering");
  window.setTimeout(() => {
    stageEl.classList.remove("is-stage-entering");
  }, 760);
}
const PREVIEW = (() => {
  const params = new URLSearchParams(window.location.search);
  const enabled = params.get("preview") === "1";
  const stageRaw = (params.get("stage") || params.get("phase") || "live").toLowerCase();
  const groupRaw = (params.get("group") || params.get("session") || "A").toUpperCase();
  const stage = stageRaw === "combined" || stageRaw === "results" ? stageRaw : "live";
  const group = groupRaw === "B" ? "B" : "A";
  return { enabled, stage, group };
})();

function teamIconPath(sessionLabel, team) {
  const group = String(sessionLabel || "A").toUpperCase() === "B" ? "B" : "A";
  const byTeam = { red: "01", green: "02", yellow: "03", blue: "04" };
  const code = byTeam[team] || "01";
  return `/assets/images/team-${group}_${code}.png`;
}

function teamCell(sessionLabel, team) {
  return `<span class="team-cell"><img class="team-icon" src="${teamIconPath(sessionLabel, team)}" alt="${team} team" />${team.toUpperCase()}</span>`;
}

function triggerBoardEnter(force = false) {
  if (!boardEl) return;
  if (!force && boardEl.classList.contains("is-board-entering")) return;
  boardEl.classList.remove("is-board-entering");
  void boardEl.offsetWidth;
  boardEl.classList.add("is-board-entering");
  window.setTimeout(() => {
    boardEl.classList.remove("is-board-entering");
  }, 720);
}

function applyRowReveal(mode) {
  const prev = visibleRowsByMode.get(mode) || new Set();
  const next = new Set();
  boardEl.querySelectorAll(".countdown-rank-card[data-row-key]:not(.is-ghost)").forEach((row) => {
    const key = row.dataset.rowKey || "";
    if (!key) return;
    next.add(key);
    if (!prev.has(key)) {
      row.classList.add("is-reveal-in");
    }
  });
  visibleRowsByMode.set(mode, next);
}

function tryPatchScoresInPlace(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  const nextRows = [...temp.querySelectorAll(".countdown-rank-card[data-row-key]:not(.is-ghost)")];
  const currentRows = [...boardEl.querySelectorAll(".countdown-rank-card[data-row-key]:not(.is-ghost)")];
  if (!nextRows.length || nextRows.length !== currentRows.length) return false;
  for (let i = 0; i < nextRows.length; i += 1) {
    const nextKey = nextRows[i].dataset.rowKey;
    const currentKey = currentRows[i].dataset.rowKey;
    if (nextKey !== currentKey) return false;
  }
  for (let i = 0; i < nextRows.length; i += 1) {
    const nextValue = nextRows[i].querySelector(".countdown-rank-value")?.textContent ?? "";
    const currentValueEl = currentRows[i].querySelector(".countdown-rank-value");
    if (currentValueEl && currentValueEl.textContent !== nextValue) {
      currentValueEl.textContent = nextValue;
    }
  }
  return true;
}

function paintBoard(html, mode, { animate = false, push = false } = {}) {
  const signature = `${mode}|${html}`;
  if (signature === lastBoardSignature) return;

  const prevMode = lastBoardMode;
  const modeChanged = prevMode !== mode;
  if (!modeChanged && mode === "combined-add" && tryPatchScoresInPlace(html)) {
    lastBoardSignature = signature;
    return;
  }

  const shouldPush = push && Boolean(boardEl.innerHTML.trim());
  const paint = () => {
    boardEl.innerHTML = html;
    applyRowReveal(mode);
    lastBoardSignature = signature;
    lastBoardMode = mode;
    if (mode === "combined" && prevMode === "combined-add") {
      window.LihaLottie?.playBig?.();
    }
  };

  if (!shouldPush) {
    paint();
    if (animate || modeChanged) {
      triggerBoardEnter(true);
    }
    return;
  }

  if (boardPushTimer) {
    clearTimeout(boardPushTimer);
    boardPushTimer = 0;
  }
  boardEl.classList.remove("is-push-in-right");
  boardEl.classList.add("is-push-out-left");
  boardPushTimer = window.setTimeout(() => {
    boardEl.classList.remove("is-push-out-left");
    paint();
    boardEl.classList.add("is-push-in-right");
    window.setTimeout(() => boardEl.classList.remove("is-push-in-right"), 380);
    boardPushTimer = 0;
  }, 190);
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

function formatFinishMs(ms) {
  const min = Math.floor(ms / 60000).toString();
  const sec = Math.floor((ms % 60000) / 1000)
    .toString()
    .padStart(2, "0");
  return `${min}:${sec}`;
}

function finishedTeams(trust) {
  return TEAM_ORDER.map((team) => ({ team, ms: trust.teamTimesMs?.[team] }))
    .filter((row) => Number.isFinite(row.ms))
    .sort((a, b) => a.ms - b.ms);
}

function teamAccent(team) {
  const byTeam = {
    red: "var(--orange)",
    green: "#6daa50",
    yellow: "#f5ba5e",
    blue: "#368ee7",
  };
  return byTeam[team] || "#7fb3f4";
}

function rankCardMarkup(sessionLabel, rows, formatValue, metricLabel) {
  return rows
    .map((row, idx) => {
      const rank = String(idx + 1).padStart(2, "0");
      const delay = Math.min(360, (rows.length - idx - 1) * 95);
      if (row.ghost) {
        return `<article class="countdown-rank-card is-ghost" data-row-key="ghost-${idx}" style="--row-delay:${delay}ms">
          <span class="countdown-rank-label">#${rank}</span>
          <div class="countdown-rank-value-row">
            <span class="countdown-rank-accent"></span>
            <strong class="countdown-rank-value"></strong>
          </div>
          <span class="countdown-rank-icon countdown-rank-icon-ghost" aria-hidden="true"></span>
        </article>`;
      }
      const topClass = idx === 0 ? " is-top" : "";
      const rawValue = formatValue(row);
      const numericValue = Number(rawValue);
      const scoreKey = `${String(sessionLabel || "A").toUpperCase()}-${metricLabel}-${row.team || "ghost"}`;
      const scoreAttrs =
        metricLabel !== "time" && Number.isFinite(numericValue)
          ? ` data-score-key="${scoreKey}" data-score-target="${numericValue}"`
          : "";
      const rowKey = row.team || `row-${idx}`;
      return `<article class="countdown-rank-card${topClass}" data-row-key="${rowKey}" style="--row-delay:${delay}ms">
        <span class="countdown-rank-label">#${rank}</span>
        <div class="countdown-rank-value-row">
          <span class="countdown-rank-accent" style="background:${teamAccent(row.team)}"></span>
          <strong class="countdown-rank-value"${scoreAttrs}>${rawValue}</strong>
        </div>
        <img class="countdown-rank-icon" src="${teamIconPath(sessionLabel, row.team)}" alt="${row.team.toUpperCase()} team" />
      </article>`;
    })
    .join("");
}

function rowsWithGhosts(rows, total = 4) {
  const clipped = rows.slice(0, total).map((row) => ({ ...row }));
  const missing = Math.max(0, total - clipped.length);
  const ghosts = Array.from({ length: missing }, () => ({ ghost: true }));
  return [...clipped, ...ghosts];
}

function trustResultRows(trust) {
  return TEAM_ORDER.map((team) => ({
    team,
    score: trust.teamScores?.[team] || 0,
    ms: trust.teamTimesMs?.[team],
  }))
    .filter((row) => Number.isFinite(row.ms))
    .sort((a, b) => b.score - a.score || a.ms - b.ms);
}

function renderPreview() {
  const session = PREVIEW.group;
  const trust = {
    phase: PREVIEW.stage === "live" ? "running" : "completed",
    remainingMs: 10 * 60 * 1000,
    currentRound: CHALLENGE_MODE === "soft" ? 2 : 1,
    totalRounds: CHALLENGE_MODE === "soft" ? 3 : 1,
    teamTimesMs: {
      red: 3 * 60 * 1000 + 47 * 1000,
      green: 6 * 60 * 1000 + 5 * 1000,
      yellow: 7 * 60 * 1000,
      blue: 9 * 60 * 1000 + 23 * 1000,
    },
    teamScores: {
      red: 900,
      green: 872,
      yellow: 858,
      blue: 840,
    },
  };
  const leaderboard = [
    { team: "red", score: 2090, promptScore: 1190 },
    { team: "green", score: 2072, promptScore: 1200 },
    { team: "yellow", score: 2058, promptScore: 1200 },
    { team: "blue", score: 2040, promptScore: 1200 },
  ];

  setTimerTitle(softRoundLabel(trust));
  groupEl.textContent = `Group ${session}`;
  timerEl.textContent = formatMs(trust.remainingMs);
  timerEl.classList.remove("hidden");

  if (PREVIEW.stage === "combined") {
    setSimpleTitle("Leaderboard");
    timerEl.classList.add("hidden");
    copyEl.textContent = "Showing combined group leaderboard.";
    hideTransitionLoader();
    const html = renderCombinedLeaderboard(session, leaderboard, { progress: 1 });
    paintBoard(html, "preview-combined", { animate: true });
    return;
  }
  if (PREVIEW.stage === "results") {
    setSimpleTitle(`${CHALLENGE_LABEL} Results`);
    timerEl.classList.add("hidden");
    copyEl.textContent = `${CHALLENGE_LABEL} complete. Showing ${CHALLENGE_LABEL} results.`;
    hideTransitionLoader();
    const html = renderPointsLeaderboard(session, trust);
    paintBoard(html, "preview-results", { animate: true });
    return;
  }

  copyEl.textContent = `Live ${CHALLENGE_LABEL} timing board. Teams appear as they finish.`;
  hideTransitionLoader();
  const html = renderTrustBoard(session, trust);
  paintBoard(html, "preview-live", { animate: true });
}

function softRoundLabel(challenge) {
  if (CHALLENGE_MODE !== "soft") return "";
  const currentRound = Number(challenge?.currentRound) || 1;
  const totalRounds = Number(challenge?.totalRounds) || 3;
  return `Round ${currentRound} of ${totalRounds}`;
}

function setSimpleTitle(text) {
  titleEl.classList.remove("has-round-pill");
  titleEl.textContent = text;
}

function setTimerTitle(roundLabel = "") {
  if (CHALLENGE_MODE === "soft" && roundLabel) {
    titleEl.classList.add("has-round-pill");
    titleEl.textContent = "";
    const main = document.createElement("span");
    main.className = "countdown-title-main";
    main.textContent = "Timer";
    const pill = document.createElement("span");
    pill.className = "countdown-round-pill";
    pill.textContent = roundLabel;
    titleEl.append(main, pill);
    return;
  }
  setSimpleTitle("Timer");
}

function renderTrustBoard(sessionLabel, trust, { highlightTop = false } = {}) {
  const finished = finishedTeams(trust);
  const rows = rowsWithGhosts(highlightTop ? finished : finished, 4);
  return rankCardMarkup(sessionLabel, rows, (row) => formatFinishMs(row.ms), "time");
}

function renderPointsLeaderboard(sessionLabel, trust) {
  const rows = trustResultRows(trust);
  return rankCardMarkup(sessionLabel, rows, (row) => `${row.score}`, "points");
}

function renderCombinedLeaderboard(sessionLabel, leaderboard, { addingType = null, progress = 1 } = {}) {
  const source = [...(leaderboard || [])];
  if (addingType) {
    source.sort((a, b) => {
      const addA = addingType === "trust" ? a.trustBonus : addingType === "soft" ? a.softSkillsBonus : a.promptScore;
      const addB = addingType === "trust" ? b.trustBonus : addingType === "soft" ? b.softSkillsBonus : b.promptScore;
      const baseA = a.score - addA;
      const baseB = b.score - addB;
      return baseB - baseA || b.score - a.score;
    });
  } else {
    source.sort((a, b) => b.score - a.score || b.promptScore - a.promptScore);
  }

  const rows = source.map((row) => {
    if (!addingType) return row;
    const addValue = addingType === "trust" ? row.trustBonus : addingType === "soft" ? row.softSkillsBonus : row.promptScore;
    const baseValue = row.score - addValue;
    return { ...row, score: Math.round(baseValue + addValue * progress) };
  });

  return rankCardMarkup(sessionLabel, rows, (row) => `${row.score}`, "total");
}

function setTransitionLoader(progress, label = "Preparing points results...") {
  if (!transitionLoaderEl || !transitionLoaderFillEl) return;
  transitionLoaderEl.classList.remove("hidden");
  const labelEl = transitionLoaderEl.querySelector(".countdown-transition-label");
  if (labelEl) labelEl.textContent = label;
  transitionLoaderFillEl.style.width = `${Math.max(0, Math.min(1, progress)) * 100}%`;
}

function hideTransitionLoader() {
  if (!transitionLoaderEl || !transitionLoaderFillEl) return;
  transitionLoaderEl.classList.add("hidden");
  transitionLoaderFillEl.style.width = "0%";
}

async function fetchDisplay() {
  try {
    const res = await fetch(CHALLENGE_DISPLAY_ENDPOINT);
    const data = await res.json();

    const session = data.latestSession;
    const trust = data[CHALLENGE_DATA_KEY] || {};
    const roundLabel = softRoundLabel(trust);

    setTimerTitle(roundLabel);
    groupEl.textContent =
      session
        ? CHALLENGE_MODE === "soft" && roundLabel
          ? `Group ${session} · ${roundLabel}`
          : `Group ${session}`
        : "-";
    timerEl.textContent = formatMs(Math.max(0, trust.remainingMs || 0));
    timerEl.classList.remove("hidden");

    if (!session || !trust.runId) {
      copyEl.textContent = `Waiting for the latest ${CHALLENGE_LABEL} run to start.`;
      const html = rankCardMarkup(session || "A", rowsWithGhosts([], 4), () => "", "time");
      paintBoard(html, "idle");
      timerEl.classList.remove("is-finish-flash");
      hideTransitionLoader();
      return;
    }

    if (CHALLENGE_MODE === "soft" && trust.phase === "paused" && trust.awaitingNextRound) {
      setTimerTitle(roundLabel);
      timerEl.classList.remove("hidden");
      timerEl.classList.remove("is-finish-flash");
      copyEl.textContent = `${CHALLENGE_LABEL} ready. Start ${roundLabel || "next round"} from control.`;
      hideTransitionLoader();
      const html = renderTrustBoard(session, trust);
      paintBoard(html, "soft-round-ready");
      return;
    }

    if (trust.phase === "completed") {
      const completedAt = Number.isFinite(trust.completedAt) ? trust.completedAt : data.serverTime || Date.now();
      const holdUntil = completedAt + TIMES_HOLD_MS;
      const now = Number.isFinite(data.serverTime) ? data.serverTime : Date.now();
      const allFinished = TEAM_ORDER.every((team) => Number.isFinite(trust.teamTimesMs?.[team]));
      const pointsRevealMs = Math.max(500, SWITCH_TO_COMBINED_MS - TIMES_HOLD_MS);
      const pointsRevealEnd = holdUntil + pointsRevealMs;

      if (now < holdUntil) {
        const secondsLeft = Math.max(0, Math.ceil((holdUntil - now) / 1000));
        setTimerTitle(roundLabel);
        timerEl.classList.remove("hidden");
        if (allFinished && now < completedAt + COMPLETION_FLASH_MS) {
          timerEl.classList.add("is-finish-flash");
        } else {
          timerEl.classList.remove("is-finish-flash");
        }
        copyEl.textContent = `${CHALLENGE_LABEL} complete. Final times locked. Points results in ${secondsLeft}s.`;
        const html = renderTrustBoard(session, trust);
        paintBoard(html, "hold-times");
        setTransitionLoader((now - completedAt) / TIMES_HOLD_MS);
        return;
      }

      timerEl.classList.remove("is-finish-flash");

      if (now < pointsRevealEnd) {
        const secondsLeft = Math.max(0, Math.ceil((pointsRevealEnd - now) / 1000));
        setSimpleTitle(`${CHALLENGE_LABEL} Results`);
        timerEl.classList.add("hidden");
        copyEl.textContent =
          CHALLENGE_MODE === "soft"
            ? `${CHALLENGE_LABEL} results live.`
            : `${CHALLENGE_LABEL} results live. Combined leaderboard in ${secondsLeft}s.`;
        const ordered = trustResultRows(trust);
        const stepMs = ordered.length ? pointsRevealMs / ordered.length : pointsRevealMs;
        const visibleCount = Math.min(ordered.length, Math.max(1, Math.floor((now - holdUntil) / stepMs) + 1));
        const revealFrom = Math.max(0, ordered.length - visibleCount);
        const rows = ordered.map((row, idx) => (idx < revealFrom ? { ...row, ghost: true } : row));
        const html = rankCardMarkup(session, rows, (row) => `${row.score}`, "points");
        paintBoard(html, "reveal-points");
        hideTransitionLoader();
        return;
      }

      if (CHALLENGE_MODE === "soft") {
        setSimpleTitle(`${CHALLENGE_LABEL} Results`);
        timerEl.classList.add("hidden");
        copyEl.textContent = `${CHALLENGE_LABEL} final tally.`;
        const rows = trustResultRows(trust);
        const html = rankCardMarkup(session, rows, (row) => `${row.score}`, "points");
        paintBoard(html, "reveal-points");
        hideTransitionLoader();
        return;
      }

      const switchAt = completedAt + SWITCH_TO_COMBINED_MS;
      const addEndAt = switchAt + COMBINED_ADD_MS;
      const progress = Math.max(0, Math.min(1, (now - switchAt) / COMBINED_ADD_MS));
      setSimpleTitle("Leaderboard");
      timerEl.classList.add("hidden");
      copyEl.textContent =
        now < addEndAt
          ? `Adding ${CHALLENGE_LABEL} points to leaderboard...`
          : "Showing combined group leaderboard.";
      const html = renderCombinedLeaderboard(session, data.leaderboard || [], {
        addingType: now < addEndAt ? CHALLENGE_MODE : null,
        progress,
      });
      const mode = now < addEndAt ? "combined-add" : "combined";
      const push = lastBoardMode === "reveal-points" && mode === "combined-add";
      paintBoard(html, mode, { push });
      hideTransitionLoader();
      return;
    }

    copyEl.textContent = `Live ${CHALLENGE_LABEL} timing board. Teams appear as they finish.`;
    timerEl.classList.remove("is-finish-flash");
    hideTransitionLoader();
    const html = renderTrustBoard(session, trust);
    paintBoard(html, "live");
  } catch (_err) {
    copyEl.textContent = "Could not load countdown data.";
    timerEl.classList.remove("is-finish-flash");
    hideTransitionLoader();
  }
}

if (PREVIEW.enabled) {
  renderPreview();
} else {
  setInterval(fetchDisplay, 250);
  fetchDisplay();
}
