const state = {
  key: sessionStorage.getItem("promptArenaMasterKey") || "",
  serverOffsetMs: 0,
  latestLeaderboardSession: null,
  introVirtualKeyboardEnabled: false,
  sessions: {
    A: null,
    B: null,
  },
};

const SESSION_IDS = ["A", "B"];
const TEAM_ORDER = ["red", "blue", "green", "yellow"];
const TEAM_LABELS = {
  A: {
    red: "Heart",
    blue: "Thumbs Up",
    green: "Clap",
    yellow: "Idea",
  },
  B: {
    red: "Heart Link",
    blue: "Paper Plane",
    green: "Chat",
    yellow: "Smile",
  },
};

const authCard = document.getElementById("auth-card");
const controlCard = document.getElementById("control-card");
const landingView = document.getElementById("master-landing");
const gameView = document.getElementById("master-game-view");
const masterStatusBadge = document.getElementById("master-status-badge");
const masterTimer = document.getElementById("master-timer");
const masterStatus = document.getElementById("master-status");
const masterError = document.getElementById("master-error");
const slotsWrap = document.getElementById("master-team-slots");
const board = document.getElementById("master-leaderboard");
const boardTitle = document.getElementById("master-leaderboard-title");
const boardCopy = document.getElementById("master-leaderboard-copy");
const joinCodeEl = document.getElementById("master-join-code");
const joinCodeWrap = document.getElementById("join-code-wrap");

const lobbyActions = document.getElementById("master-lobby-actions");
const roundActions = document.getElementById("master-round-actions");
const pauseToggleBtn = document.getElementById("pause-toggle-btn");
const startRoundBtn = document.getElementById("start-round-btn");
const gameTitle = document.getElementById("master-game-title");
const focusEyebrow = document.getElementById("master-focus-eyebrow");

const promptViewPanel = document.getElementById("prompt-view-panel");
const promptLeaderboardPanel = document.getElementById("prompt-leaderboard-panel");
const trustViewPanel = document.getElementById("trust-view-panel");
const challengeControlsTitleEl = document.getElementById("challenge-controls-title");
const challengeResultsEl = document.getElementById("challenge-results");
const RESULTS_REVEAL_MS = 10_000;
const COMBINED_ADD_MS = 3_000;

let selectedSession = "A";
let selectedGame = "prompt";
let portalView = "landing";

const CHALLENGE_CONFIG = {
  trust: {
    key: "trustWho",
    label: "Trust Who",
    routeBase: "/api/master/trust",
    shortLabel: "Trust",
    scoreField: "trustBonus",
  },
  soft: {
    key: "softSkills",
    label: "Soft Skills Significance",
    routeBase: "/api/master/soft",
    shortLabel: "Soft Skills",
    scoreField: "softSkillsBonus",
  },
};

function currentChallengeConfig() {
  return CHALLENGE_CONFIG[selectedGame] || CHALLENGE_CONFIG.trust;
}

function teamIconPath(sessionLabel, team) {
  const group = String(sessionLabel || "A").toUpperCase() === "B" ? "B" : "A";
  const byTeam = { red: "01", green: "02", yellow: "03", blue: "04" };
  const code = byTeam[team] || "01";
  return `/assets/images/team-${group}_${code}.png`;
}

function teamLabel(sessionLabel, team) {
  const group = String(sessionLabel || "A").toUpperCase() === "B" ? "B" : "A";
  return TEAM_LABELS[group]?.[team] || team.toUpperCase();
}

function teamCell(sessionLabel, team) {
  return `<span class="team-cell"><img class="team-icon" src="${teamIconPath(sessionLabel, team)}" alt="${teamLabel(sessionLabel, team)}" />${teamLabel(sessionLabel, team)}</span>`;
}

function showError(message = "") {
  masterError.textContent = message;
}

function setAuthed(authed) {
  authCard.classList.toggle("hidden", authed);
  controlCard.classList.toggle("hidden", !authed);
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

function formatTrustTime(ms) {
  if (!Number.isFinite(ms)) return "--:--";
  return formatMs(ms);
}

function currentSession() {
  return state.sessions[selectedSession];
}

function stageLabel(player) {
  const stage = player.progressStage || "lobby";
  if (stage === "completed") return `Completed ${player.score || 0}%`;
  if (stage === "welcome") return "Welcome (15s)";
  if (stage === "prompting") return "Prompting";
  if (stage === "briefing") return "Briefing";
  return "Lobby";
}

function stageClass(player) {
  const stage = player.progressStage || "lobby";
  if (stage === "completed") return "status-completed";
  if (stage === "welcome") return "status-welcome";
  if (stage === "prompting") return "status-prompting";
  if (stage === "briefing") return "status-briefing";
  return "status-lobby";
}

function renderSlots(session) {
  const byTeam = new Map((session.leaderboard || []).map((row) => [row.team, row]));

  slotsWrap.innerHTML = TEAM_ORDER.map((team) => {
    const row = byTeam.get(team) || { players: [] };
    const slots = Array.from({ length: 10 }, (_, idx) => {
      const player = row.players[idx];
      if (!player) {
        return `<div class="team-slot empty">
          <strong>Player ${idx + 1}</strong>
          <span>Open slot</span>
        </div>`;
      }

      return `<div class="team-slot filled ${stageClass(player)}">
        <strong>${player.name || `Player ${idx + 1}`}</strong>
        <span>${stageLabel(player)}</span>
      </div>`;
    }).join("");

    return `<div class="team-slot-card team-${team}">
      <h4>${teamLabel(selectedSession, team)}</h4>
      <div class="team-slot-list">${slots}</div>
    </div>`;
  }).join("");
}

function renderPromptLeaderboard(session) {
  const now = Date.now() + state.serverOffsetMs;
  const promptAt = Number.isFinite(session.promptCompletedAt) ? session.promptCompletedAt : null;
  const trustAt = Number.isFinite(session?.trustWho?.completedAt) ? session.trustWho.completedAt : null;
  const softAt = Number.isFinite(session?.softSkills?.completedAt) ? session.softSkills.completedAt : null;

  function scoreFieldForType(type) {
    if (type === "trust") return "trustBonus";
    if (type === "soft") return "softSkillsBonus";
    return "promptScore";
  }

  function eventLabel(type) {
    if (type === "trust") return "Trust Who";
    if (type === "soft") return "Soft Skills Significance";
    return "Prompt Like a Pro";
  }

  const reveals = [];
  if (promptAt && now < promptAt + RESULTS_REVEAL_MS) reveals.push({ type: "prompt", at: promptAt });
  if (trustAt && now < trustAt + RESULTS_REVEAL_MS) reveals.push({ type: "trust", at: trustAt });
  if (softAt && now < softAt + RESULTS_REVEAL_MS) reveals.push({ type: "soft", at: softAt });
  reveals.sort((a, b) => b.at - a.at);
  const reveal = reveals[0] || null;

  if (reveal?.type === "trust" || reveal?.type === "soft") {
    const metric = scoreFieldForType(reveal.type);
    const rows = [...(session.leaderboard || [])].sort((a, b) => a[metric] - b[metric] || a.score - b.score);
    const stepMs = rows.length ? RESULTS_REVEAL_MS / rows.length : RESULTS_REVEAL_MS;
    const visibleCount = Math.min(rows.length, Math.max(1, Math.floor((now - reveal.at) / stepMs) + 1));
    const visible = rows.slice(0, visibleCount);
    const totalRows = rows.length || 1;
    const secondsLeft = Math.max(0, Math.ceil((reveal.at + RESULTS_REVEAL_MS - now) / 1000));

    boardTitle.textContent = `${eventLabel(reveal.type)} Results`;
    boardCopy.textContent = `Revealing bottom to top. Combined leaderboard in ${secondsLeft}s.`;
    board.innerHTML = `<table>
      <thead>
        <tr>
          <th>Order</th>
          <th>Team</th>
          <th>Points</th>
        </tr>
      </thead>
      <tbody>
        ${visible
          .map(
            (row, idx) => `<tr>
              <td>${totalRows - idx}</td>
              <td>${teamCell(selectedSession, row.team)}</td>
              <td>${row[metric] || 0}</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
    return;
  }

  if (reveal?.type === "prompt") {
    const rows = [...(session.leaderboard || [])].sort((a, b) => a.promptScore - b.promptScore || a.averagePercent - b.averagePercent);
    const stepMs = rows.length ? RESULTS_REVEAL_MS / rows.length : RESULTS_REVEAL_MS;
    const visibleCount = Math.min(rows.length, Math.max(1, Math.floor((now - reveal.at) / stepMs) + 1));
    const visible = rows.slice(0, visibleCount);
    const totalRows = rows.length || 1;
    const secondsLeft = Math.max(0, Math.ceil((reveal.at + RESULTS_REVEAL_MS - now) / 1000));

    boardTitle.textContent = "Prompt Like a Pro Results";
    boardCopy.textContent = `Revealing bottom to top. Combined leaderboard in ${secondsLeft}s.`;
    board.innerHTML = `<table>
      <thead>
        <tr>
          <th>Order</th>
          <th>Team</th>
          <th>Average %</th>
          <th>Points</th>
        </tr>
      </thead>
      <tbody>
        ${visible
          .map(
            (row, idx) => `<tr>
              <td>${totalRows - idx}</td>
              <td>${teamCell(selectedSession, row.team)}</td>
              <td>${row.averagePercent}%</td>
              <td>${row.promptScore}</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
    return;
  }

  const addCandidates = [];
  if (promptAt && now >= promptAt + RESULTS_REVEAL_MS && now < promptAt + RESULTS_REVEAL_MS + COMBINED_ADD_MS) {
    addCandidates.push({ type: "prompt", at: promptAt });
  }
  if (trustAt && now >= trustAt + RESULTS_REVEAL_MS && now < trustAt + RESULTS_REVEAL_MS + COMBINED_ADD_MS) {
    addCandidates.push({ type: "trust", at: trustAt });
  }
  if (softAt && now >= softAt + RESULTS_REVEAL_MS && now < softAt + RESULTS_REVEAL_MS + COMBINED_ADD_MS) {
    addCandidates.push({ type: "soft", at: softAt });
  }
  addCandidates.sort((a, b) => b.at - a.at);
  const adding = addCandidates[0] || null;
  const progress = adding ? Math.max(0, Math.min(1, (now - (adding.at + RESULTS_REVEAL_MS)) / COMBINED_ADD_MS)) : 1;

  boardTitle.textContent = "Leaderboard";
  boardCopy.textContent = adding
    ? `Adding ${eventLabel(adding.type)} points to leaderboard...`
    : "Combined points (Prompt Like a Pro + Trust Who + Soft Skills Significance).";
  const rows = [...(session.leaderboard || [])]
    .sort((a, b) => b.score - a.score || b.promptScore - a.promptScore)
    .map((row, idx) => {
      const addValue = adding ? row[scoreFieldForType(adding.type)] || 0 : 0;
      const baseValue = row.score - addValue;
      const total = adding ? Math.round(baseValue + addValue * progress) : row.score;
      return `<tr>
        <td>${idx + 1}</td>
        <td>${teamCell(selectedSession, row.team)}</td>
        <td>${total}</td>
      </tr>`;
    })
    .join("");

  board.innerHTML = `<table>
    <thead>
      <tr>
        <th>Rank</th>
        <th>Team</th>
        <th>Total Points</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderChallengeResults(session, game) {
  const cfg = CHALLENGE_CONFIG[game] || CHALLENGE_CONFIG.trust;
  const challenge = session?.[cfg.key] || {};
  const rows = TEAM_ORDER.map((team) => {
    const ms = challenge.teamTimesMs?.[team];
    const score = challenge.teamScores?.[team] || 0;
    return `<tr>
      <td>${teamCell(selectedSession, team)}</td>
      <td>${formatTrustTime(ms)}</td>
      <td>${score}</td>
    </tr>`;
  }).join("");

  challengeResultsEl.innerHTML = `<table>
    <thead>
      <tr>
        <th>Team</th>
        <th>Finish Time</th>
        <th>${cfg.shortLabel} Score</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function sessionCardLabel(session, game) {
  if (game === "trust" || game === "soft") {
    const cfg = CHALLENGE_CONFIG[game];
    const challenge = session?.[cfg.key] || {};
    const phase = challenge.phase || "closed";
    const times = challenge.teamTimesMs || {};
    const allFinished = TEAM_ORDER.every((team) => Number.isFinite(times[team]));
    const completed = phase === "completed" || Number.isFinite(challenge.completedAt) || allFinished;

    if (completed) {
      return { button: `Open ${cfg.label}`, note: "Run complete.", state: "Completed", tone: "done", completed: true };
    }
    if (phase === "running") {
      if (game === "soft") {
        const currentRound = Number(challenge.currentRound) || 1;
        const totalRounds = Number(challenge.totalRounds) || 3;
        return {
          button: `Open ${cfg.label}`,
          note: `Timer is live. Round ${currentRound} of ${totalRounds}.`,
          state: `Round ${currentRound}/${totalRounds}`,
          tone: "live",
          completed: false,
        };
      }
      return { button: `Open ${cfg.label}`, note: "Timer is live.", state: "Live", tone: "live", completed: false };
    }
    if (phase === "paused") {
      if (game === "soft") {
        const currentRound = Number(challenge.currentRound) || 1;
        const totalRounds = Number(challenge.totalRounds) || 3;
        const awaitingNextRound = Boolean(challenge.awaitingNextRound);
        const nextRound = Math.min(totalRounds, currentRound + 1);
        return {
          button: `Open ${cfg.label}`,
          note: awaitingNextRound
            ? `Round ${currentRound} of ${totalRounds} complete. Start round ${nextRound} when ready.`
            : `Timer paused at round ${currentRound} of ${totalRounds}.`,
          state: `Round ${currentRound}/${totalRounds}`,
          tone: "paused",
          completed: false,
        };
      }
      return { button: `Open ${cfg.label}`, note: "Timer paused.", state: "Paused", tone: "paused", completed: false };
    }
    return {
      button: `Open ${cfg.label}`,
      note: "Open controls, then start when ready.",
      state: "Ready",
      tone: "ready",
      completed: false,
    };
  }

  if (!session) {
    return {
      button: "Start Game Lobby",
      note: "Open lobby and generate passcode.",
      state: "Ready",
      tone: "ready",
      completed: false,
    };
  }

  if (session.phase === "leaderboard") {
    return {
      button: "Prompt Completed",
      note: "Round complete. Review results or start next lobby.",
      state: "Completed",
      tone: "done",
      completed: true,
    };
  }
  if (session.phase === "round") {
    return {
      button: "Prompt In Progress",
      note: "Round is live. Open to manage timer and end game.",
      state: "Live",
      tone: "live",
      completed: false,
    };
  }
  if (session.phase === "lobby") {
    return {
      button: "Prompt Lobby Open",
      note: "Players can join with passcode.",
      state: "Lobby",
      tone: "paused",
      completed: false,
    };
  }
  return {
    button: "Start Game Lobby",
    note: "Lobby has not started yet.",
    state: "Ready",
    tone: "ready",
    completed: false,
  };
}

function renderLanding() {
  const cards = SESSION_IDS.map((sessionId) => {
    const session = state.sessions[sessionId];
    const promptMeta = sessionCardLabel(session, "prompt");
    const trustMeta = sessionCardLabel(session, "trust");
    const softMeta = sessionCardLabel(session, "soft");
    const passcode = session?.joinCode || "------";
    const claimedSession = String(state.latestLeaderboardSession || "").toUpperCase();
    const isClaimed = claimedSession === sessionId;

    return `<section class="master-session-card">
      <div class="master-session-head">
        <div>
          <p class="eyebrow">Group ${sessionId}</p>
          <h3>Session ${sessionId}</h3>
        </div>
        <div class="master-session-actions">
          <button
            data-session-claim-leaderboard="${sessionId}"
            class="ghost master-claim-btn ${isClaimed ? "is-claimed" : "is-unclaimed"}"
          >
            ${isClaimed ? "Leaderboard Claimed" : "Claim Leaderboard"}
          </button>
        </div>
      </div>

      <article class="master-game-card">
        <div class="master-game-card-head">
          <h4>1. Trust Who</h4>
          <span class="master-state-badge tone-${trustMeta.tone}">${trustMeta.state}</span>
        </div>
        <p class="tiny-note">${trustMeta.note}</p>
        <div class="actions-row master-card-actions">
          <button data-session-open="${sessionId}" data-game="trust">${trustMeta.button}</button>
        </div>
      </article>

      <article class="master-game-card">
        <div class="master-game-card-head">
          <h4>2. Soft Skills Significance</h4>
          <span class="master-state-badge tone-${softMeta.tone}">${softMeta.state}</span>
        </div>
        <p class="tiny-note">${softMeta.note}</p>
        <div class="actions-row master-card-actions">
          <button data-session-open="${sessionId}" data-game="soft">${softMeta.button}</button>
        </div>
      </article>

      <article class="master-game-card">
        <div class="master-game-card-head">
          <h4>3. Prompt Like a Pro</h4>
          <span class="master-state-badge tone-${promptMeta.tone}">${promptMeta.state}</span>
        </div>
        <p class="tiny-note">${promptMeta.note}</p>
        <p class="tiny-note"><strong>Passcode:</strong> ${passcode}</p>
        <div class="actions-row master-card-actions">
          <button data-session-open="${sessionId}" data-game="prompt">${promptMeta.button}</button>
        </div>
      </article>

      <div class="actions-row master-reset-row">
        <button data-session-reset="${sessionId}" class="danger master-reset-btn">Reset Session</button>
      </div>

      <section class="master-points-card">
        <h5>Manual Team Points Push</h5>
        <p class="tiny-note">Enter absolute values, choose add/subtract, then push. Each push is cumulative.</p>
        <div class="master-points-grid">
          <label>
            <span>${teamLabel(sessionId, "red")}</span>
            <input type="number" step="1" data-manual-score="${sessionId}" data-team="red" placeholder="0" />
          </label>
          <label>
            <span>${teamLabel(sessionId, "blue")}</span>
            <input type="number" step="1" data-manual-score="${sessionId}" data-team="blue" placeholder="0" />
          </label>
          <label>
            <span>${teamLabel(sessionId, "yellow")}</span>
            <input type="number" step="1" data-manual-score="${sessionId}" data-team="yellow" placeholder="0" />
          </label>
          <label>
            <span>${teamLabel(sessionId, "green")}</span>
            <input type="number" step="1" data-manual-score="${sessionId}" data-team="green" placeholder="0" />
          </label>
        </div>
        <div class="actions-row master-points-actions">
          <label class="master-points-op">
            <span>Mode</span>
            <select data-manual-op="${sessionId}">
              <option value="add">Add</option>
              <option value="subtract">Subtract</option>
            </select>
          </label>
          <button data-session-push-points="${sessionId}">Push Team Points</button>
        </div>
      </section>
    </section>`;
  }).join("");

  landingView.innerHTML = `<section class="master-landing-head">
    <h2>Game Sessions</h2>
    <p class="tiny-note">Manage games in sequence: Trust Who, Soft Skills Significance, then Prompt Like a Pro.</p>
  </section>
  <div class="master-landing-grid">${cards}</div>
  <section class="master-settings-card">
    <h3>Display Settings</h3>
    <label class="master-toggle-row" for="intro-vkbd-toggle">
      <span>
        <strong>Intro Virtual Keyboard</strong>
        <small>Enable touchscreen keyboard on Recruiter Focus Finder welcome input.</small>
      </span>
      <input id="intro-vkbd-toggle" type="checkbox" ${state.introVirtualKeyboardEnabled ? "checked" : ""} />
    </label>
  </section>`;

  landingView.querySelectorAll("[data-session-open]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedSession = button.dataset.sessionOpen;
      selectedGame = button.dataset.game || "prompt";
      const session = state.sessions[selectedSession];

      if (selectedGame === "prompt") {
        if (!session || session.phase === "closed") {
          runAction("/api/master/start-game", selectedSession);
          return;
        }
        portalView = "focused";
        renderMasterView();
        return;
      }

      portalView = "focused";
      renderMasterView();
    });
  });

  landingView.querySelectorAll("[data-session-reset]").forEach((button) => {
    button.addEventListener("click", () => {
      const sessionId = button.dataset.sessionReset;
      const confirmed = window.confirm(
        `Reset Session ${sessionId}? This will reset the session and permanently wipe the leaderboard for this group.`
      );
      if (!confirmed) return;
      runAction("/api/master/reset-session", sessionId);
    });
  });
  landingView.querySelectorAll("[data-session-claim-leaderboard]").forEach((button) => {
    button.addEventListener("click", () => {
      const sessionId = button.dataset.sessionClaimLeaderboard;
      runAction("/api/master/leaderboard/claim-screen", sessionId);
    });
  });

  landingView.querySelectorAll("[data-session-push-points]").forEach((button) => {
    button.addEventListener("click", () => {
      const sessionId = button.dataset.sessionPushPoints;
      const inputs = landingView.querySelectorAll(`[data-manual-score="${sessionId}"]`);
      const opSelect = landingView.querySelector(`[data-manual-op="${sessionId}"]`);
      const mode = opSelect?.value === "subtract" ? "subtract" : "add";
      const scores = {};
      const deltas = [];
      inputs.forEach((input) => {
        const team = input.dataset.team;
        if (!team) return;
        const raw = Number(input.value);
        if (!Number.isFinite(raw) || raw === 0) {
          scores[team] = "";
          return;
        }
        const delta = Math.abs(Math.round(raw)) * (mode === "subtract" ? -1 : 1);
        scores[team] = delta;
        deltas.push(`${mode === "subtract" ? "-" : "+"}${Math.abs(delta)} ${teamLabel(sessionId, team)}`);
      });
      if (!deltas.length) {
        showError("Enter at least one non-zero team value.");
        return;
      }
      const confirmed = window.confirm(`Confirm ${mode === "subtract" ? "subtracting" : "adding"} points:\n${deltas.join("\n")}`);
      if (!confirmed) return;
      runAction("/api/master/push-manual-points", sessionId, { scores }).then(() => {
        inputs.forEach((input) => {
          input.value = "";
        });
      });
    });
  });

  const introKeyboardToggle = document.getElementById("intro-vkbd-toggle");
  if (introKeyboardToggle) {
    introKeyboardToggle.addEventListener("change", () => {
      runAction("/api/master/settings/intro-virtual-keyboard", null, {
        enabled: introKeyboardToggle.checked,
      });
    });
  }
}

function renderPromptFocus(session) {
  promptViewPanel.classList.remove("hidden");
  promptLeaderboardPanel.classList.remove("hidden");
  trustViewPanel.classList.add("hidden");
  joinCodeWrap.classList.remove("hidden");

  const nowServer = Date.now() + state.serverOffsetMs;
  const warmupActive =
    session.phase === "round" &&
    Number.isFinite(session.roundStartsAt) &&
    nowServer < session.roundStartsAt;
  const hasWelcomePlayers = (session.leaderboard || []).some((row) =>
    (row.players || []).some((player) => (player.progressStage || "") === "welcome")
  );

  lobbyActions.classList.toggle("hidden", session.phase !== "lobby");
  roundActions.classList.toggle("hidden", session.phase !== "round" || warmupActive || hasWelcomePlayers);

  const totalPlayers = (session.leaderboard || []).reduce((sum, row) => sum + (row.playerCount || 0), 0);
  startRoundBtn.disabled = totalPlayers === 0;

  if (session.phase === "lobby") {
    masterStatus.textContent = "Players are joining. Start when ready.";
    masterStatusBadge.textContent = `GROUP ${selectedSession} LOBBY`;
  } else if (session.phase === "round" && (warmupActive || hasWelcomePlayers)) {
    masterStatus.textContent = "Welcome countdown running (15s), then brief selection starts.";
    masterStatusBadge.textContent = `GROUP ${selectedSession} WELCOME`;
  } else if (session.phase === "round" && session.roundPausedAt) {
    masterStatus.textContent = "Round paused.";
    masterStatusBadge.textContent = `GROUP ${selectedSession} PAUSED`;
  } else if (session.phase === "round") {
    masterStatus.textContent = "Round running.";
    masterStatusBadge.textContent = `GROUP ${selectedSession} LIVE`;
  } else if (session.phase === "leaderboard") {
    masterStatus.textContent = "Round complete.";
    masterStatusBadge.textContent = `GROUP ${selectedSession} COMPLETE`;
  } else {
    masterStatus.textContent = "Lobby not started.";
    masterStatusBadge.textContent = `GROUP ${selectedSession} READY`;
  }

  if (warmupActive) {
    masterTimer.textContent = formatMs(Math.max(0, session.roundStartsAt - nowServer));
  } else if (session.roundEndsAt) {
    masterTimer.textContent = formatMs(Math.max(0, session.roundEndsAt - nowServer));
  } else {
    masterTimer.textContent = formatMs(Math.max(0, session.roundRemainingMs || 0));
  }

  pauseToggleBtn.textContent = session.roundPausedAt ? "Resume Timer" : "Pause Timer";
  joinCodeEl.textContent = session.phase === "leaderboard" ? "------" : session.joinCode || "------";

  renderSlots(session);
  renderPromptLeaderboard(session);
}

function renderChallengeFocus(session, game) {
  const cfg = CHALLENGE_CONFIG[game] || CHALLENGE_CONFIG.trust;
  const challenge = session?.[cfg.key] || {};
  promptViewPanel.classList.add("hidden");
  promptLeaderboardPanel.classList.add("hidden");
  trustViewPanel.classList.remove("hidden");
  joinCodeWrap.classList.add("hidden");
  lobbyActions.classList.add("hidden");
  roundActions.classList.add("hidden");

  challengeControlsTitleEl.textContent = `${cfg.label} Controls`;

  const phase = challenge.phase || "closed";
  if (phase === "running") {
    if (game === "soft") {
      const currentRound = Number(challenge.currentRound) || 1;
      const totalRounds = Number(challenge.totalRounds) || 3;
      masterStatus.textContent = `${cfg.label} timer running. Round ${currentRound} of ${totalRounds}.`;
      masterStatusBadge.textContent = `GROUP ${selectedSession} SOFT ROUND ${currentRound}/${totalRounds}`;
    } else {
      masterStatus.textContent = `${cfg.label} timer running.`;
      masterStatusBadge.textContent = `GROUP ${selectedSession} ${cfg.shortLabel.toUpperCase()} LIVE`;
    }
  } else if (phase === "paused") {
    if (game === "soft") {
      const currentRound = Number(challenge.currentRound) || 1;
      const totalRounds = Number(challenge.totalRounds) || 3;
      const awaitingNextRound = Boolean(challenge.awaitingNextRound);
      const nextRound = Math.min(totalRounds, currentRound + 1);
      masterStatus.textContent = awaitingNextRound
        ? `${cfg.label} round ${currentRound} complete. Start round ${nextRound} when ready.`
        : `${cfg.label} timer paused at round ${currentRound} of ${totalRounds}.`;
      masterStatusBadge.textContent = `GROUP ${selectedSession} SOFT ROUND ${currentRound}/${totalRounds}`;
    } else {
      masterStatus.textContent = `${cfg.label} timer paused.`;
      masterStatusBadge.textContent = `GROUP ${selectedSession} ${cfg.shortLabel.toUpperCase()} PAUSED`;
    }
  } else if (phase === "completed") {
    masterStatus.textContent = `${cfg.label} complete.`;
    masterStatusBadge.textContent = `GROUP ${selectedSession} ${cfg.shortLabel.toUpperCase()} COMPLETE`;
  } else {
    masterStatus.textContent = `${cfg.label} not started.`;
    masterStatusBadge.textContent = `GROUP ${selectedSession} ${cfg.shortLabel.toUpperCase()} READY`;
  }

  masterTimer.textContent = formatMs(Math.max(0, challenge.remainingMs || 0));

  const toggleBtn = document.getElementById("challenge-toggle-btn");
  if (phase === "running") {
    toggleBtn.textContent = "Pause";
    toggleBtn.classList.add("ghost");
  } else if (phase === "paused") {
    if (game === "soft" && challenge.awaitingNextRound) {
      const currentRound = Number(challenge.currentRound) || 1;
      const totalRounds = Number(challenge.totalRounds) || 3;
      const nextRound = Math.min(totalRounds, currentRound + 1);
      toggleBtn.textContent = `Start Round ${nextRound}`;
    } else {
      toggleBtn.textContent = "Resume";
    }
    toggleBtn.classList.remove("ghost");
  } else {
    toggleBtn.textContent = "Start";
    toggleBtn.classList.remove("ghost");
  }

  document.querySelectorAll("[data-challenge-team]").forEach((button) => {
    const team = button.dataset.challengeTeam;
    const finished = Number.isFinite(challenge.teamTimesMs?.[team]);
    button.textContent = `${teamLabel(selectedSession, team)} Finish`;
    button.disabled = finished || !(phase === "running" || phase === "paused");
  });

  renderChallengeResults(session, game);
}

function renderMasterView() {
  const focused = portalView === "focused";
  landingView.classList.toggle("hidden", focused);
  gameView.classList.toggle("hidden", !focused);

  if (!focused) {
    masterStatusBadge.textContent = "READY";
    renderLanding();
    return;
  }

  const session = currentSession();
  if (!session) {
    masterStatus.textContent = "Session unavailable.";
    return;
  }

  if (focusEyebrow) {
    focusEyebrow.textContent = `Group ${selectedSession}`;
  }
  gameTitle.textContent =
    selectedGame === "trust"
      ? "Trust Who?"
      : selectedGame === "soft"
        ? "Soft Skills Significance"
        : "Prompt Like A Pro";

  if (selectedGame === "trust" || selectedGame === "soft") {
    renderChallengeFocus(session, selectedGame);
  } else {
    renderPromptFocus(session);
  }
}

async function request(path, method = "GET", body, useMaster = false) {
  const headers = { "Content-Type": "application/json" };
  if (useMaster) headers["x-master-key"] = state.key;

  const res = await fetch(path, {
    method,
    headers,
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
    if (parsed?.error) throw new Error(parsed.error);
    throw new Error(raw || `Request failed (${res.status}).`);
  }

  if (parsed) return parsed;
  throw new Error("API returned non-JSON response.");
}

async function fetchState() {
  if (!state.key) return;

  try {
    const data = await request("/api/master/session-status", "GET", undefined, true);
    state.sessions = data.sessions || { A: null, B: null };
    state.latestLeaderboardSession = data.latestLeaderboardSession || null;
    state.introVirtualKeyboardEnabled = Boolean(data.introVirtualKeyboardEnabled);
    state.serverOffsetMs = (data.serverTime || Date.now()) - Date.now();
    const editingManualScore =
      portalView === "landing" &&
      document.activeElement &&
      document.activeElement.matches &&
      document.activeElement.matches("[data-manual-score], [data-manual-op]");
    if (editingManualScore) return;
    renderMasterView();
  } catch (err) {
    showError(err.message);
  }
}

async function runAction(path, sessionId, extra = {}) {
  showError("");
  try {
    const body = sessionId ? { session: sessionId, ...extra } : extra;
    await request(path, "POST", body, true);

    if (path === "/api/master/start-game" || path === "/api/master/trust/start" || path === "/api/master/soft/start") {
      selectedSession = sessionId;
      portalView = "focused";
    }

    if (path === "/api/master/reset-session") {
      portalView = "landing";
      if (selectedSession === sessionId) {
        selectedSession = "A";
      }
    }

    await fetchState();
  } catch (err) {
    showError(err.message);
  }
}

document.getElementById("auth-btn").addEventListener("click", async () => {
  const key = document.getElementById("master-key").value.trim();
  if (!key) {
    showError("Master key is required.");
    return;
  }

  state.key = key;
  showError("");

  try {
    await request("/api/master/auth", "POST", {}, true);
    sessionStorage.setItem("promptArenaMasterKey", state.key);
    setAuthed(true);
    await fetchState();
  } catch (err) {
    state.key = "";
    sessionStorage.removeItem("promptArenaMasterKey");
    setAuthed(false);
    showError(err.message);
  }
});

document.getElementById("start-round-btn").addEventListener("click", () => runAction("/api/master/start-round", selectedSession));
document.getElementById("end-round-btn").addEventListener("click", () => runAction("/api/master/end-round", selectedSession));
document.getElementById("pause-toggle-btn").addEventListener("click", () => {
  const session = currentSession();
  if (!session) return;
  const path = session.roundPausedAt ? "/api/master/resume-round" : "/api/master/pause-round";
  runAction(path, selectedSession);
});

document.getElementById("challenge-toggle-btn").addEventListener("click", () => {
  const cfg = currentChallengeConfig();
  const phase = currentSession()?.[cfg.key]?.phase || "closed";
  if (phase === "running") {
    runAction(`${cfg.routeBase}/pause`, selectedSession);
    return;
  }
  if (phase === "paused") {
    runAction(`${cfg.routeBase}/resume`, selectedSession);
    return;
  }
  runAction(`${cfg.routeBase}/start`, selectedSession);
});
document.getElementById("challenge-claim-screen-btn").addEventListener("click", () => {
  const cfg = currentChallengeConfig();
  runAction(`${cfg.routeBase}/claim-screen`, selectedSession);
});
document.getElementById("challenge-restart-btn").addEventListener("click", () => {
  const cfg = currentChallengeConfig();
  const confirmed = window.confirm(
    `Restart ${cfg.label} for Group ${selectedSession}? This clears current times and starts the timer again.`
  );
  if (!confirmed) return;
  runAction(`${cfg.routeBase}/restart`, selectedSession);
});
document.querySelectorAll("[data-challenge-team]").forEach((button) => {
  button.addEventListener("click", () => {
    const cfg = currentChallengeConfig();
    runAction(`${cfg.routeBase}/finish-team`, selectedSession, { team: button.dataset.challengeTeam });
  });
});

document.getElementById("back-to-portal-btn").addEventListener("click", () => {
  portalView = "landing";
  renderMasterView();
});

setInterval(fetchState, 2000);

(async function init() {
  if (!state.key) {
    setAuthed(false);
    return;
  }

  try {
    await request("/api/master/auth", "POST", {}, true);
    setAuthed(true);
    await fetchState();
  } catch (_err) {
    state.key = "";
    sessionStorage.removeItem("promptArenaMasterKey");
    setAuthed(false);
  }
})();
