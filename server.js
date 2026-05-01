require("dotenv").config();
const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const http = require("http");
const https = require("https");
const os = require("os");
const path = require("path");

const { JOB_ROLES } = require("./src/constants.js");
const { analyzePrompt } = require("./src/services/geminiService.js");

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const USE_HTTPS = process.env.USE_HTTPS !== "0";
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || path.join(__dirname, "certs", "dev-key.pem");
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || path.join(__dirname, "certs", "dev-cert.pem");
const MASTER_KEY = process.env.MASTER_KEY || "master123";
const ANALYTICS_PATH = path.join(__dirname, "data", "game-analytics.json");

const SESSION_IDS = ["A", "B"];
const TEAMS = ["red", "blue", "green", "yellow"];
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
const MAX_TEAM_SIZE = 10;
const ROUND_DURATION_MS = 15 * 60 * 1000;
const WELCOME_DURATION_MS = 15 * 1000;
const TRUST_DURATION_MS = 15 * 60 * 1000;
const SOFT_SKILLS_TOTAL_ROUNDS = 3;
const SOFT_SKILLS_ROUND_DURATION_MS = 2 * 60 * 1000;
const SOFT_SKILLS_MAX_POINTS = TRUST_DURATION_MS / 1000;
const TEAM_SCORE_MULTIPLIER = 10;
const PROMPT_PASS_THRESHOLD = 80;
const PROMPT_FAIL_AWARD_SCORE = Number(process.env.PROMPT_FAIL_AWARD_SCORE || 50);
const COPY_PASTE_FEEDBACK =
  "Don’t directly copy the job brief word for word. Write the prompt in your own words, as you want to start training the AI on your own language.";
const NEAR_VERBATIM_COPY_THRESHOLD = 0.98;
const PLAYER_STAGES = new Set(["lobby", "welcome", "briefing", "prompting", "completed"]);
const ROOM_CODE_WORDS = [
  "apple",
  "berry",
  "cherry",
  "grape",
  "guava",
  "kiwi",
  "lemon",
  "mango",
  "melon",
  "olive",
  "peach",
  "pear",
  "plum",
];

const introDimensions = {
  objective: ["Innovation", "Precision", "Speed"],
  style: ["Bold", "Balanced", "Conservative"],
  context: ["Marketing", "Education", "Operations"],
};

function teamDisplayName(sessionId, team) {
  const sessionKey = String(sessionId || "").toUpperCase() === "B" ? "B" : "A";
  return TEAM_LABELS[sessionKey]?.[team] || String(team || "").toUpperCase();
}

const workflowPath = path.join(__dirname, "public", "data", "workflow.json");
let workflowTaskMap = new Map();
let workflowTotalAiMinutes = 0;

function loadWorkflowTaskMap() {
  try {
    if (!fs.existsSync(workflowPath)) {
      workflowTaskMap = new Map();
      workflowTotalAiMinutes = 0;
      return;
    }
    const workflow = JSON.parse(fs.readFileSync(workflowPath, "utf8"));
    const stages = Array.isArray(workflow?.stages) ? workflow.stages : [];
    const nextMap = new Map();
    let nextTotal = 0;
    for (const stage of stages) {
      const stageName = String(stage.workflow || "").trim();
      for (const task of Array.isArray(stage.tasks) ? stage.tasks : []) {
        const taskName = String(task.task || "").trim();
        if (!stageName || !taskName) continue;
        const category = String(task.category || "").toLowerCase();
        const aiMinutes = category.includes("people-centric") ? 0 : Math.max(0, Number(task.time_mins) || 0);
        nextMap.set(`${stageName}::${taskName}`, aiMinutes);
        nextTotal += aiMinutes;
      }
    }
    workflowTaskMap = nextMap;
    workflowTotalAiMinutes = nextTotal;
  } catch (err) {
    console.error("Could not load workflow task map:", err);
    workflowTaskMap = new Map();
    workflowTotalAiMinutes = 0;
  }
}

function createInitialSessionState() {
  const teams = {};
  for (const color of TEAMS) {
    teams[color] = [];
  }

  return {
    prompt: {
      phase: "closed",
      roundStartsAt: null,
      roundEndsAt: null,
      roundPausedAt: null,
      completedAt: null,
      roundRemainingMs: ROUND_DURATION_MS,
      joinCode: null,
      joinCodeGeneratedAt: null,
      players: {},
      teams,
      activeTrustBonus: Object.fromEntries(TEAMS.map((team) => [team, 0])),
      activeSoftSkillsBonus: Object.fromEntries(TEAMS.map((team) => [team, 0])),
      nextTrustBonus: Object.fromEntries(TEAMS.map((team) => [team, 0])),
      nextSoftSkillsBonus: Object.fromEntries(TEAMS.map((team) => [team, 0])),
      manualPointAdjustments: Object.fromEntries(TEAMS.map((team) => [team, 0])),
      analyticsLoggedCompletedAt: null,
    },
    trustWho: {
      runId: 0,
      phase: "closed",
      startsAt: null,
      endsAt: null,
      pausedAt: null,
      completedAt: null,
      remainingMs: TRUST_DURATION_MS,
      teamTimesMs: Object.fromEntries(TEAMS.map((team) => [team, null])),
      teamScores: Object.fromEntries(TEAMS.map((team) => [team, 0])),
      analyticsLoggedCompletedAt: null,
    },
    softSkills: {
      runId: 0,
      phase: "closed",
      startsAt: null,
      endsAt: null,
      pausedAt: null,
      completedAt: null,
      remainingMs: SOFT_SKILLS_ROUND_DURATION_MS,
      currentRound: 1,
      totalRounds: SOFT_SKILLS_TOTAL_ROUNDS,
      roundDurationMs: SOFT_SKILLS_ROUND_DURATION_MS,
      awaitingNextRound: false,
      teamTimesMs: Object.fromEntries(TEAMS.map((team) => [team, null])),
      teamScores: Object.fromEntries(TEAMS.map((team) => [team, 0])),
      analyticsLoggedCompletedAt: null,
    },
  };
}

loadWorkflowTaskMap();

function createInitialRootState() {
  const sessions = {};
  for (const sessionId of SESSION_IDS) {
    sessions[sessionId] = createInitialSessionState();
  }

  return {
    sessions,
    settings: {
      introVirtualKeyboardEnabled: false,
    },
    introResults: {},
    latestLeaderboard: {
      sessionId: null,
    },
    latestTrustWho: {
      sessionId: null,
      runId: 0,
    },
    latestSoftSkills: {
      sessionId: null,
      runId: 0,
    },
  };
}

const state = createInitialRootState();

function createInitialAnalyticsState() {
  return {
    version: 1,
    introSubmissions: [],
    promptSubmissions: [],
    promptRounds: [],
    trustRuns: [],
    softSkillsRuns: [],
    updatedAt: Date.now(),
  };
}

function loadAnalytics() {
  try {
    if (!fs.existsSync(ANALYTICS_PATH)) {
      return createInitialAnalyticsState();
    }
    const raw = fs.readFileSync(ANALYTICS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...createInitialAnalyticsState(),
      ...parsed,
      introSubmissions: Array.isArray(parsed?.introSubmissions) ? parsed.introSubmissions : [],
      promptSubmissions: Array.isArray(parsed?.promptSubmissions) ? parsed.promptSubmissions : [],
      promptRounds: Array.isArray(parsed?.promptRounds) ? parsed.promptRounds : [],
      trustRuns: Array.isArray(parsed?.trustRuns) ? parsed.trustRuns : [],
      softSkillsRuns: Array.isArray(parsed?.softSkillsRuns) ? parsed.softSkillsRuns : [],
      updatedAt: Number.isFinite(parsed?.updatedAt) ? parsed.updatedAt : Date.now(),
    };
  } catch (err) {
    console.error("Could not load analytics store:", err);
    return createInitialAnalyticsState();
  }
}

let analytics = loadAnalytics();

function persistAnalytics() {
  try {
    const dir = path.dirname(ANALYTICS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    analytics.updatedAt = Date.now();
    fs.writeFileSync(ANALYTICS_PATH, JSON.stringify(analytics, null, 2), "utf8");
  } catch (err) {
    console.error("Could not persist analytics store:", err);
  }
}

function msToSeconds(value) {
  return Math.max(0, Math.round((Number(value) || 0) / 1000));
}

function rowForTeam(leaderboardRows, team) {
  return leaderboardRows.find((row) => row.team === team) || null;
}

function recordPromptRoundCompletion(sessionId, session) {
  if (!(session.prompt.phase === "leaderboard" && Number.isFinite(session.prompt.completedAt))) {
    return;
  }
  if (session.prompt.analyticsLoggedCompletedAt === session.prompt.completedAt) {
    return;
  }

  const leaderboardRows = leaderboardForSession(session);
  const teams = TEAMS.map((team) => {
    const row = rowForTeam(leaderboardRows, team);
    return {
      team,
      promptPercent: row?.averagePercent || 0,
      promptPoints: row?.promptScore || 0,
      playerCount: row?.playerCount || 0,
      submissions: row?.submissions || 0,
      trustBonusApplied: row?.trustBonus || 0,
      softSkillsBonusApplied: row?.softSkillsBonus || 0,
    };
  });

  analytics.promptRounds.push({
    id: crypto.randomUUID(),
    session: sessionId,
    completedAt: session.prompt.completedAt,
    teams,
    ranking: leaderboardRows.map((row, index) => ({
      rank: index + 1,
      team: row.team,
      totalScore: row.score,
      promptPoints: row.promptScore,
      trustBonus: row.trustBonus,
      softSkillsBonus: row.softSkillsBonus,
    })),
  });

  session.prompt.analyticsLoggedCompletedAt = session.prompt.completedAt;
  persistAnalytics();
}

function recordTrustRunCompletion(sessionId, session) {
  if (!(session.trustWho.phase === "completed" && Number.isFinite(session.trustWho.completedAt))) {
    return;
  }
  if (session.trustWho.analyticsLoggedCompletedAt === session.trustWho.completedAt) {
    return;
  }

  const teams = TEAMS.map((team) => ({
    team,
    elapsedMs: Number(session.trustWho.teamTimesMs?.[team]) || null,
    elapsedSeconds: msToSeconds(session.trustWho.teamTimesMs?.[team]),
    points: Number(session.trustWho.teamScores?.[team]) || 0,
  }));

  const ranking = [...teams]
    .sort((a, b) => (b.points || 0) - (a.points || 0))
    .map((row, index) => ({ rank: index + 1, ...row }));

  analytics.trustRuns.push({
    id: crypto.randomUUID(),
    session: sessionId,
    runId: Number(session.trustWho.runId) || 0,
    completedAt: session.trustWho.completedAt,
    teams,
    ranking,
  });

  session.trustWho.analyticsLoggedCompletedAt = session.trustWho.completedAt;
  persistAnalytics();
}

function recordSoftSkillsRunCompletion(sessionId, session) {
  if (!(session.softSkills.phase === "completed" && Number.isFinite(session.softSkills.completedAt))) {
    return;
  }
  if (session.softSkills.analyticsLoggedCompletedAt === session.softSkills.completedAt) {
    return;
  }

  const teams = TEAMS.map((team) => ({
    team,
    elapsedMs: Number(session.softSkills.teamTimesMs?.[team]) || null,
    elapsedSeconds: msToSeconds(session.softSkills.teamTimesMs?.[team]),
    points: Number(session.softSkills.teamScores?.[team]) || 0,
  }));

  const ranking = [...teams]
    .sort((a, b) => (b.points || 0) - (a.points || 0))
    .map((row, index) => ({ rank: index + 1, ...row }));

  analytics.softSkillsRuns.push({
    id: crypto.randomUUID(),
    session: sessionId,
    runId: Number(session.softSkills.runId) || 0,
    completedAt: session.softSkills.completedAt,
    teams,
    ranking,
  });

  session.softSkills.analyticsLoggedCompletedAt = session.softSkills.completedAt;
  persistAnalytics();
}

function buildStatsSummary() {
  const introSubmissions = analytics.introSubmissions || [];
  const promptSubmissions = analytics.promptSubmissions || [];
  const promptRounds = analytics.promptRounds || [];
  const trustRuns = analytics.trustRuns || [];
  const softSkillsRuns = analytics.softSkillsRuns || [];

  const uniqueCompanies = new Set(
    introSubmissions
      .map((item) => String(item.companyName || "").trim())
      .filter(Boolean)
  );

  const selectedTaskCounts = new Map();
  for (const intro of introSubmissions) {
    for (const item of intro.selections || []) {
      const key = `${item.stage} | ${item.task}`;
      selectedTaskCounts.set(key, (selectedTaskCounts.get(key) || 0) + 1);
    }
  }

  const selectedTasks = [...selectedTaskCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const teamMetricRows = SESSION_IDS.flatMap((sessionId) =>
    TEAMS.map((team) => ({
      session: sessionId,
      team,
      key: `${sessionId}:${team}`,
      label: teamDisplayName(sessionId, team),
    }))
  );

  const promptTeamTotals = Object.fromEntries(teamMetricRows.map((row) => [row.key, { sum: 0, count: 0 }]));
  for (const row of promptSubmissions) {
    if (!row?.passed) continue;
    const sessionId = String(row.session || "").toUpperCase();
    const team = String(row.team || "").toLowerCase();
    const key = `${sessionId}:${team}`;
    if (!promptTeamTotals[key]) continue;
    promptTeamTotals[key].sum += Number(row.scoreCurved) || 0;
    promptTeamTotals[key].count += 1;
  }
  const promptTeamAverages = teamMetricRows.map((row) => {
    const item = promptTeamTotals[row.key];
    const average = item.count ? Math.round(item.sum / item.count) : 0;
    return { session: row.session, team: row.team, label: row.label, average };
  });

  const trustTeamTotals = Object.fromEntries(teamMetricRows.map((row) => [row.key, { sum: 0, count: 0 }]));
  for (const run of trustRuns) {
    const sessionId = String(run.session || "").toUpperCase();
    for (const row of run.teams || []) {
      const team = String(row.team || "").toLowerCase();
      const key = `${sessionId}:${team}`;
      if (!trustTeamTotals[key]) continue;
      trustTeamTotals[key].sum += Number(row.points) || 0;
      trustTeamTotals[key].count += 1;
    }
  }
  const trustTeamAverages = teamMetricRows.map((row) => {
    const item = trustTeamTotals[row.key];
    const average = item.count ? Math.round(item.sum / item.count) : 0;
    return { session: row.session, team: row.team, label: row.label, average };
  });

  const softSkillsTeamTotals = Object.fromEntries(teamMetricRows.map((row) => [row.key, { sum: 0, count: 0 }]));
  for (const run of softSkillsRuns) {
    const sessionId = String(run.session || "").toUpperCase();
    for (const row of run.teams || []) {
      const team = String(row.team || "").toLowerCase();
      const key = `${sessionId}:${team}`;
      if (!softSkillsTeamTotals[key]) continue;
      softSkillsTeamTotals[key].sum += Number(row.points) || 0;
      softSkillsTeamTotals[key].count += 1;
    }
  }
  const softSkillsTeamAverages = teamMetricRows.map((row) => {
    const item = softSkillsTeamTotals[row.key];
    const average = item.count ? Math.round(item.sum / item.count) : 0;
    return { session: row.session, team: row.team, label: row.label, average };
  });

  const introHours = introSubmissions.reduce((sum, row) => sum + (Number(row.unpickedHours) || 0), 0);

  return {
    updatedAt: analytics.updatedAt,
    totals: {
      introSubmissions: introSubmissions.length,
      uniqueCompanies: uniqueCompanies.size,
      promptSubmissions: promptSubmissions.length,
      promptPassed: promptSubmissions.filter((row) => row.passed).length,
      promptRounds: promptRounds.length,
      trustRuns: trustRuns.length,
      softSkillsRuns: softSkillsRuns.length,
      estimatedHoursSaved: Math.round(introHours * 10) / 10,
    },
    charts: {
      selectedTasks,
      promptTeamAverages,
      trustTeamAverages,
      softSkillsTeamAverages,
    },
    records: {
      introSubmissions,
      promptSubmissions,
      promptRounds,
      trustRuns,
      softSkillsRuns,
    },
  };
}

function escapeHtml(input) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildXlsFromStats(stats) {
  const introRows = (stats.records.introSubmissions || [])
    .map((row) => {
      const tasks = (row.selections || []).map((entry) => `${entry.stage}: ${entry.task}`).join(" | ");
      return `<tr>
        <td>${escapeHtml(Number.isFinite(Number(row.createdAt)) ? new Date(Number(row.createdAt)).toISOString() : "")}</td>
        <td>${escapeHtml(row.companyName || "Unknown")}</td>
        <td>${escapeHtml(tasks)}</td>
        <td>${escapeHtml((Number(row.unpickedHours) || 0).toFixed(1))}</td>
      </tr>`;
    })
    .join("");

  const promptRows = (stats.records.promptSubmissions || [])
    .map((row) => `<tr>
      <td>${escapeHtml(Number.isFinite(Number(row.createdAt)) ? new Date(Number(row.createdAt)).toISOString() : "")}</td>
      <td>${escapeHtml(String(row.session || "").toUpperCase())}</td>
      <td>${escapeHtml(teamDisplayName(row.session, row.team))}</td>
      <td>${escapeHtml(row.brief || "")}</td>
      <td>${escapeHtml(row.passed ? "PASS" : "FAIL")}</td>
      <td>${escapeHtml(Number(row.scoreRaw) || 0)}</td>
      <td>${escapeHtml(Number(row.scoreCurved) || 0)}</td>
    </tr>`)
    .join("");

  const trustRows = (stats.records.trustRuns || [])
    .flatMap((run) =>
      (run.teams || []).map(
        (row) => `<tr>
        <td>${escapeHtml(Number.isFinite(Number(run.completedAt)) ? new Date(Number(run.completedAt)).toISOString() : "")}</td>
        <td>${escapeHtml(String(run.session || "").toUpperCase())}</td>
        <td>${escapeHtml(Number(run.runId) || 0)}</td>
        <td>${escapeHtml(teamDisplayName(run.session, row.team))}</td>
        <td>${escapeHtml(Number(row.elapsedSeconds) || 0)}</td>
        <td>${escapeHtml(Number(row.points) || 0)}</td>
      </tr>`
      )
    )
    .join("");

  const softSkillsRows = (stats.records.softSkillsRuns || [])
    .flatMap((run) =>
      (run.teams || []).map(
        (row) => `<tr>
        <td>${escapeHtml(Number.isFinite(Number(run.completedAt)) ? new Date(Number(run.completedAt)).toISOString() : "")}</td>
        <td>${escapeHtml(String(run.session || "").toUpperCase())}</td>
        <td>${escapeHtml(Number(run.runId) || 0)}</td>
        <td>${escapeHtml(teamDisplayName(run.session, row.team))}</td>
        <td>${escapeHtml(Number(row.elapsedSeconds) || 0)}</td>
        <td>${escapeHtml(Number(row.points) || 0)}</td>
      </tr>`
      )
    )
    .join("");

  return `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Type" content="application/vnd.ms-excel; charset=UTF-8" />
  <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>LiHa Stats</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head>
<body>
  <table border="1">
    <tr><th colspan="4">Recruiter Focus Finder Submissions</th></tr>
    <tr><th>Created At</th><th>Company</th><th>Selections</th><th>Estimated Hours Saved</th></tr>
    ${introRows}
  </table>
  <br />
  <table border="1">
    <tr><th colspan="7">Prompt Submissions</th></tr>
    <tr><th>Created At</th><th>Session</th><th>Team</th><th>Brief</th><th>Status</th><th>Raw Score</th><th>Curved Score</th></tr>
    ${promptRows}
  </table>
  <br />
  <table border="1">
    <tr><th colspan="6">Trust Who Runs</th></tr>
    <tr><th>Completed At</th><th>Session</th><th>Run ID</th><th>Team</th><th>Elapsed Seconds</th><th>Points</th></tr>
    ${trustRows}
  </table>
  <br />
  <table border="1">
    <tr><th colspan="6">Soft Skills Significance Runs</th></tr>
    <tr><th>Completed At</th><th>Session</th><th>Run ID</th><th>Team</th><th>Elapsed Seconds</th><th>Points</th></tr>
    ${softSkillsRows}
  </table>
</body>
</html>`;
}

function getSession(sessionId) {
  return state.sessions[sessionId] || null;
}

function requireSession(sessionId, res) {
  const session = getSession(sessionId);
  if (!session) {
    res.status(400).json({ error: "Invalid session. Use A or B." });
    return null;
  }
  return session;
}

function findPlayerSession(playerId) {
  for (const sessionId of SESSION_IDS) {
    const session = state.sessions[sessionId];
    if (session.prompt.players[playerId]) {
      return { sessionId, session, player: session.prompt.players[playerId] };
    }
  }
  return null;
}

function resetTimerFields(session) {
  session.prompt.roundStartsAt = null;
  session.prompt.roundEndsAt = null;
  session.prompt.roundPausedAt = null;
  session.prompt.roundRemainingMs = ROUND_DURATION_MS;
}

function teamScorePercent(session, team) {
  const scoredPlayers = session.prompt.teams[team]
    .map((playerId) => session.prompt.players[playerId])
    .map((player) => {
      if (!player) return null;
      if (player.submitted) return Number(player.score) || 0;
      if (Number.isFinite(player.failedAwardScore) && player.failedAwardScore > 0) return Number(player.failedAwardScore) || 0;
      return null;
    })
    .filter((value) => Number.isFinite(value));

  if (!scoredPlayers.length) {
    return 0;
  }

  const sum = scoredPlayers.reduce((total, value) => total + value, 0);
  return Math.round(sum / scoredPlayers.length);
}

function teamScorePoints(session, team) {
  return Math.round(teamScorePercent(session, team) * TEAM_SCORE_MULTIPLIER);
}

function markRoundCompletedPlayers(session) {
  for (const playerId of Object.keys(session.prompt.players)) {
    const player = session.prompt.players[playerId];
    if (!player.submitted) {
      player.progressStage = "completed";
    }
  }
}

function markRoundBriefingPlayers(session) {
  for (const playerId of Object.keys(session.prompt.players)) {
    const player = session.prompt.players[playerId];
    if (!player.submitted) {
      player.progressStage = "briefing";
    }
  }
}

function evaluatePrompt(prompt) {
  const trimmed = prompt.trim();
  const len = trimmed.length;

  let score = 10;
  const notes = [];

  if (len < 20) {
    notes.push("Prompt is too short. Add more detail and constraints.");
  } else if (len < 60) {
    score += 15;
    notes.push("Solid start. Add constraints for a stronger result.");
  } else if (len <= 260) {
    score += 30;
    notes.push("Good length for a clear and complete request.");
  } else {
    score += 20;
    notes.push("Detailed prompt, but it may be a bit long.");
  }

  const signals = [
    {
      regex: /\b(explain|analyze|compare|summarize|design|create|generate)\b/i,
      points: 12,
      note: "Clear action verb detected.",
    },
    {
      regex: /\bfor\b.+\b(audience|team|students|customers|executives)\b/i,
      points: 12,
      note: "Audience/context specified.",
    },
    {
      regex: /\b(steps|bullet|table|format|json|outline|sections)\b/i,
      points: 12,
      note: "Output format is defined.",
    },
    {
      regex: /\b(limit|exactly|at most|within|under|no more than)\b/i,
      points: 12,
      note: "Constraints included.",
    },
    {
      regex: /\b(example|sample|scenario|assume|given)\b/i,
      points: 8,
      note: "Useful grounding details included.",
    },
  ];

  for (const signal of signals) {
    if (signal.regex.test(trimmed)) {
      score += signal.points;
      notes.push(signal.note);
    }
  }

  if (/\?/.test(trimmed)) {
    score += 6;
    notes.push("Question framing improves clarity.");
  }

  score = Math.max(0, Math.min(100, score));
  return { score, feedback: notes.join(" ") };
}

function curvePromptScore(rawScore) {
  const clamped = Math.max(0, Math.min(100, Number(rawScore) || 0));
  return Math.max(0, Math.min(100, Math.ceil(clamped / 5) * 5));
}

const ROLE_RELEVANCE_KEYWORDS = {
  "policy-officer": [
    "policy",
    "legislation",
    "consultation",
    "regulated",
    "stakeholder",
    "briefs",
    "recommendations",
    "government",
  ],
  "business-analyst": [
    "requirements",
    "stakeholders",
    "process",
    "current-state",
    "future-state",
    "workshops",
    "agile",
    "analysis",
  ],
  "customer-service-representative": [
    "customer",
    "phone",
    "chat",
    "email",
    "crm",
    "ticket",
    "escalation",
    "service",
  ],
  "sg-data-ai-specialist": [
    "data",
    "ai",
    "model",
    "dashboard",
    "python",
    "sql",
    "analytics",
    "visualisation",
  ],
  "sg-risk-compliance-officer": [
    "risk",
    "compliance",
    "regulatory",
    "audit",
    "controls",
    "policy",
    "governance",
    "reports",
  ],
  "sg-business-development-manager": [
    "pipeline",
    "prospects",
    "accounts",
    "regional",
    "b2b",
    "revenue",
    "deals",
    "clients",
  ],
  "in-software-engineer": [
    "software",
    "code",
    "architecture",
    "debug",
    "deployment",
    "agile",
    "javascript",
    "python",
  ],
  "in-business-data-analyst": [
    "sql",
    "dashboard",
    "analysis",
    "insights",
    "stakeholders",
    "visualisation",
    "data",
    "reports",
  ],
  "in-sales-development-representative": [
    "outbound",
    "prospecting",
    "crm",
    "pipeline",
    "leads",
    "demo",
    "sales",
    "account executives",
  ],
};

const EXPECTED_KNOWLEDGE_SIGNALS = {
  "policy-officer": [
    "policy",
    "legislation",
    "regulatory",
    "government",
    "consultation",
    "stakeholder",
    "risk",
  ],
  "business-analyst": [
    "requirements documentation",
    "requirements",
    "business analysis",
    "process mapping",
    "current-state",
    "future-state",
    "data analysis",
    "agile",
    "scrum",
    "workshops",
  ],
  "customer-service-representative": [
    "crm",
    "ticketing",
    "customer support",
    "escalation",
    "service quality",
    "contact center",
    "phone",
    "chat",
    "email",
  ],
  "sg-data-ai-specialist": [
    "python",
    "r",
    "sql",
    "tableau",
    "power bi",
    "data science",
    "analytics",
    "data governance",
  ],
  "sg-risk-compliance-officer": [
    "risk management",
    "internal audit",
    "regulatory requirements",
    "compliance",
    "controls",
    "law",
    "finance",
    "policies",
  ],
  "sg-business-development-manager": [
    "b2b sales",
    "business development",
    "account management",
    "regional markets",
    "pipeline",
    "negotiation",
    "commercial",
    "revenue",
  ],
  "in-software-engineer": [
    "java",
    "python",
    "javascript",
    "software development lifecycle",
    "agile",
    "architecture",
    "code reviews",
    "scalability",
  ],
  "in-business-data-analyst": [
    "sql",
    "excel",
    "power bi",
    "tableau",
    "analytics",
    "statistics",
    "business analysis",
    "data visualisation",
  ],
  "in-sales-development-representative": [
    "sales",
    "business development",
    "crm",
    "prospecting",
    "pipeline",
    "saas",
    "lead qualification",
    "presentations",
  ],
};

function roleRelevanceScore(roleId, prompt) {
  const text = String(prompt || "").toLowerCase();
  const keywords = ROLE_RELEVANCE_KEYWORDS[roleId] || [];
  if (!keywords.length) return 100;
  const hits = keywords.filter((keyword) => text.includes(keyword)).length;
  return Math.max(0, Math.min(100, Math.round((hits / keywords.length) * 100)));
}

function hasExpectedKnowledgeSignal(roleId, prompt) {
  const text = normalizeForSimilarity(prompt);
  const signals = EXPECTED_KNOWLEDGE_SIGNALS[roleId] || [];
  const hasRoleSignal = signals.some((signal) => text.includes(normalizeForSimilarity(signal)));
  const hasExperienceInPattern = /\bexperience\s+(in|with)\s+[a-z0-9][a-z0-9\s,\/&\-\+\.]{2,}\b/i.test(String(prompt || ""));
  return hasRoleSignal || hasExperienceInPattern;
}

const EXPANSION_SIGNALS = [
  /\b(output|format|json|table|structure|sections?)\b/i,
  /\bmust[- ]have|nice[- ]to[- ]have|required|mandatory|optional\b/i,
  /\bdisqualif|exclude|screen[- ]out|knock[- ]out\b/i,
  /\b(screening questions?|interview questions?)\b/i,
  /\bboolean|x-ray|string|site:|intitle:\b/i,
  /\bscore|rubric|weight(ed|ing)?|criteria\b/i,
  /\bconstraints?|under|at most|no more than|exactly\b/i,
  /\bdeliverable|response template|return in\b/i,
];

function expansionUsefulnessScore(prompt) {
  const text = String(prompt || "");
  const hits = EXPANSION_SIGNALS.filter((signal) => signal.test(text)).length;
  return Math.max(0, Math.min(100, Math.round((hits / EXPANSION_SIGNALS.length) * 100)));
}

function candidFailComment(alignmentScore, expansionScore, sectionScores) {
  const role = Number(sectionScores?.role) || 0;
  const context = Number(sectionScores?.context) || 0;
  const responsibilities = Number(sectionScores?.responsibilities) || 0;

  const weakest = [
    { key: "role details", value: role },
    { key: "context", value: context },
    { key: "responsibilities", value: responsibilities },
  ].sort((a, b) => a.value - b.value)[0]?.key;

  let alignmentHint = "role alignment is weak";
  if (alignmentScore >= 60) alignmentHint = "role alignment is acceptable";
  if (alignmentScore >= 80) alignmentHint = "role alignment is strong";

  let expansionHint = "it lacks actionable sourcing detail";
  if (expansionScore >= 60) expansionHint = "it includes some sourcing detail";
  if (expansionScore >= 80) expansionHint = "it includes strong sourcing detail";

  return `${alignmentHint} and ${expansionHint}. Strengthen role-specific ${weakest || "details"}, sourcing constraints, and clear output instructions.`;
}

function normalizeForSimilarity(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value) {
  const tokens = normalizeForSimilarity(value).split(" ").filter((token) => token.length >= 3);
  return new Set(tokens);
}

function overlapRatio(a, b) {
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (!setA.size || !setB.size) return 0;
  let hits = 0;
  for (const token of setA) {
    if (setB.has(token)) hits += 1;
  }
  return hits / Math.max(setA.size, setB.size);
}

function expansionBeyondJDRatio(prompt, jd) {
  const promptSet = tokenSet(prompt);
  const jdSet = tokenSet(jd);
  if (!promptSet.size) return 0;
  let added = 0;
  for (const token of promptSet) {
    if (!jdSet.has(token)) added += 1;
  }
  return added / promptSet.size;
}

function feedbackMentionsCopy(feedback) {
  const text = String(feedback || "").toLowerCase();
  return (
    text.includes("near-verbatim") ||
    text.includes("copy of the job description") ||
    text.includes("copy-paste") ||
    text.includes("too close to the jd") ||
    text.includes("lacking unique value")
  );
}

function strongPromptComment(roleTitle) {
  return `Strong prompt for ${roleTitle}. It is specific, role-aligned, and gives clear sourcing instructions and output structure.`;
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

function normalizeSectionMaps(rawScores, rawComments) {
  const scores = {};
  const comments = {};

  for (const [k, v] of Object.entries(rawScores || {})) {
    const key = canonicalSectionKey(k, k);
    if (!key) continue;
    scores[key] = Math.max(0, Math.min(100, Number(v) || 0));
  }

  for (const [k, v] of Object.entries(rawComments || {})) {
    const key = canonicalSectionKey(k, k);
    if (!key) continue;
    comments[key] = String(v || "");
  }

  return { scores, comments };
}

async function runPromptScoring(prompt, brief) {
  const roleId = brief || "policy-officer";
  const role = JOB_ROLES.find((r) => r.id === roleId) || JOB_ROLES[0];

  let metrics = null;
  let feedback = "";
  let sectionScores = {};
  let sectionComments = {};
  let totalScore = 0;
  let engine = "gemini";

  try {
    const aiAnalysis = await analyzePrompt(role, prompt);
    metrics = Array.isArray(aiAnalysis?.metrics) ? aiAnalysis.metrics : [];
    feedback = String(aiAnalysis?.overallComment || "");
    totalScore = Math.max(0, Math.min(100, Number(aiAnalysis?.totalScore) || 0));

    for (const metric of metrics) {
      const checklist = Array.isArray(metric?.checklist) ? metric.checklist : [];
      const total = checklist.length;
      const key = canonicalSectionKey(metric?.id, metric?.title);
      if (!key) continue;
      if (key === "context" && hasExpectedKnowledgeSignal(role.id, prompt)) {
        checklist.forEach((item) => {
          const itemName = String(item?.item || "").toLowerCase();
          if (itemName.includes("expected knowledge")) {
            item.present = true;
          }
        });
      }
      const present = checklist.filter((item) => item?.present).length;
      sectionScores[key] = total ? Math.round((present / total) * 100) : 0;
      sectionComments[key] = String(metric?.comment || "");
    }

    const normalized = normalizeSectionMaps(sectionScores, sectionComments);
    sectionScores = normalized.scores;
    sectionComments = normalized.comments;
  } catch (err) {
    console.error("Gemini err:", err);
    const fallback = evaluatePrompt(prompt);
    engine = "fallback";
    feedback = String(fallback?.feedback || "");
    totalScore = Math.max(0, Math.min(100, Number(fallback?.score) || 0));
  }

  const baseRawScore = Math.max(0, Math.min(100, Number(totalScore) || 0));
  const relevanceScore = roleRelevanceScore(role.id, prompt);
  const expansionScore = expansionUsefulnessScore(prompt);

  const promptNormalized = normalizeForSimilarity(prompt);
  const jdNormalized = normalizeForSimilarity(role.baseJobDescription);
  const jdOverlap = overlapRatio(promptNormalized, jdNormalized);
  const jdExpansionRatio = expansionBeyondJDRatio(promptNormalized, jdNormalized);
  const looksLikeJDCopy = jdOverlap >= 0.85 || promptNormalized.includes(jdNormalized.slice(0, Math.min(220, jdNormalized.length)));
  if (looksLikeJDCopy) {
    if (jdExpansionRatio < 0.05 && expansionScore < 25) {
      const copyNote = "This is very close to the JD. Add a bit more sourcing strategy, filters, and output instructions to pass.";
      feedback = feedback ? `${feedback} ${copyNote}` : copyNote;
    } else {
      const copyNote = "Good move adding detail beyond the JD. Keep refining constraints and structure to reach excellence.";
      feedback = feedback ? `${feedback} ${copyNote}` : copyNote;
    }
  }

  const roleSection = Number(sectionScores?.role) || 0;
  const contextSection = Number(sectionScores?.context) || 0;
  const responsibilitiesSection = Number(sectionScores?.responsibilities) || 0;
  const criteriaPoints =
    (Math.max(0, Math.min(100, roleSection)) / 100) * 30 +
    (Math.max(0, Math.min(100, responsibilitiesSection)) / 100) * 29 +
    (Math.max(0, Math.min(100, contextSection)) / 100) * 20;
  const expansionBonusPoints = Math.floor(Math.max(0, jdExpansionRatio) * 50);
  const rawScore = Math.max(0, Math.min(100, Math.round(criteriaPoints + expansionBonusPoints)));

  // Guard against LLM false positives about copy/paste when detector disagrees.
  if (!looksLikeJDCopy && feedbackMentionsCopy(feedback)) {
    feedback = rawScore >= PROMPT_PASS_THRESHOLD ? strongPromptComment(role.title) : feedback;
  }

  const curvedScore = rawScore;
  const failed = curvedScore < PROMPT_PASS_THRESHOLD;
  if (failed) {
    feedback = candidFailComment(relevanceScore, expansionScore, sectionScores);
  }
  if (looksLikeJDCopy && jdOverlap >= NEAR_VERBATIM_COPY_THRESHOLD) {
    feedback = COPY_PASTE_FEEDBACK;
  }

  return {
    engine,
    brief: role.id,
    roleTitle: role.title,
    baseRawScore,
    relevanceScore,
    expansionScore,
    jdOverlap: Number(jdOverlap.toFixed(3)),
    jdExpansionRatio: Number(jdExpansionRatio.toFixed(3)),
    looksLikeJDCopy,
    passThreshold: PROMPT_PASS_THRESHOLD,
    failed,
    rawScore,
    curvedScore,
    feedback,
    sectionScores,
    sectionComments,
    metrics,
  };
}

function finalizeIfTimeExpired(session) {
  if (session.prompt.phase === "round" && session.prompt.roundEndsAt && Date.now() >= session.prompt.roundEndsAt) {
    session.prompt.roundRemainingMs = 0;
    session.prompt.roundEndsAt = null;
    session.prompt.roundPausedAt = null;
    session.prompt.phase = "leaderboard";
    session.prompt.completedAt = Date.now();
    markRoundCompletedPlayers(session);
  }
}

function trustRemainingMs(session) {
  if (session.trustWho.endsAt) {
    return Math.max(0, session.trustWho.endsAt - Date.now());
  }
  return Math.max(0, session.trustWho.remainingMs || 0);
}

function trustElapsedMs(session) {
  return TRUST_DURATION_MS - trustRemainingMs(session);
}

function trustScoreFromElapsed(elapsedMs) {
  return Math.max(0, Math.round((TRUST_DURATION_MS - elapsedMs) / 1000));
}

function finalizeTrustIfExpired(session) {
  if (session.trustWho.phase === "running" && session.trustWho.endsAt && Date.now() >= session.trustWho.endsAt) {
    session.trustWho.phase = "completed";
    session.trustWho.completedAt = Date.now();
    session.trustWho.remainingMs = 0;
    session.trustWho.endsAt = null;
    session.trustWho.pausedAt = null;
    session.prompt.nextTrustBonus = { ...session.trustWho.teamScores };
  }
}

function maybeCompleteTrust(session) {
  const finishedAll = TEAMS.every((team) => Number.isFinite(session.trustWho.teamTimesMs[team]));
  if (!finishedAll) {
    return false;
  }
  session.trustWho.phase = "completed";
  session.trustWho.completedAt = Date.now();
  session.trustWho.endsAt = null;
  session.trustWho.pausedAt = null;
  session.trustWho.remainingMs = trustRemainingMs(session);
  session.prompt.nextTrustBonus = { ...session.trustWho.teamScores };
  return true;
}

function softSkillsRemainingMs(session) {
  if (session.softSkills.endsAt) {
    return Math.max(0, session.softSkills.endsAt - Date.now());
  }
  return Math.max(0, session.softSkills.remainingMs || 0);
}

function softSkillsElapsedMs(session) {
  const roundDurationMs = Number(session.softSkills.roundDurationMs) || SOFT_SKILLS_ROUND_DURATION_MS;
  return roundDurationMs - softSkillsRemainingMs(session);
}

function softSkillsScoreFromElapsed(elapsedMs) {
  const totalRoundSeconds = (SOFT_SKILLS_TOTAL_ROUNDS * SOFT_SKILLS_ROUND_DURATION_MS) / 1000;
  const pointsPerSecond = SOFT_SKILLS_MAX_POINTS / Math.max(1, totalRoundSeconds);
  const remainingSeconds = Math.max(0, (SOFT_SKILLS_ROUND_DURATION_MS - (Number(elapsedMs) || 0)) / 1000);
  return Math.max(0, Math.round(remainingSeconds * pointsPerSecond));
}

function completeSoftSkillsRound(session, completedAt = Date.now()) {
  const currentRound = Number(session.softSkills.currentRound) || 1;
  const totalRounds = Number(session.softSkills.totalRounds) || SOFT_SKILLS_TOTAL_ROUNDS;

  if (currentRound >= totalRounds) {
    session.softSkills.phase = "completed";
    session.softSkills.completedAt = completedAt;
    session.softSkills.remainingMs = 0;
    session.softSkills.endsAt = null;
    session.softSkills.pausedAt = null;
    session.softSkills.awaitingNextRound = false;
    session.prompt.nextSoftSkillsBonus = { ...session.softSkills.teamScores };
    return;
  }

  session.softSkills.phase = "paused";
  session.softSkills.remainingMs = 0;
  session.softSkills.endsAt = null;
  session.softSkills.pausedAt = completedAt;
  session.softSkills.awaitingNextRound = true;
}

function finalizeSoftSkillsIfExpired(session) {
  if (session.softSkills.phase === "running" && session.softSkills.endsAt && Date.now() >= session.softSkills.endsAt) {
    const now = Date.now();
    const roundDurationMs = Number(session.softSkills.roundDurationMs) || SOFT_SKILLS_ROUND_DURATION_MS;
    for (const team of TEAMS) {
      if (!Number.isFinite(session.softSkills.teamTimesMs[team])) {
        session.softSkills.teamTimesMs[team] = roundDurationMs;
      }
    }
    completeSoftSkillsRound(session, now);
  }
}

function maybeCompleteSoftSkills(session) {
  const finishedAll = TEAMS.every((team) => Number.isFinite(session.softSkills.teamTimesMs[team]));
  if (!finishedAll) {
    return false;
  }
  completeSoftSkillsRound(session, Date.now());
  return true;
}

function leaderboardForSession(session) {
  return TEAMS.map((team) => {
    const playerIds = session.prompt.teams[team];
    const players = playerIds.map((playerId) => {
      const player = session.prompt.players[playerId];
      return {
        id: player.id,
        name: player.name,
        score: player.score,
        feedback: player.feedback,
        sectionScores: player.sectionScores,
        sectionComments: player.sectionComments,
        submitted: player.submitted,
        progressStage: player.progressStage || "lobby",
      };
    });

    const promptCompleted = session.prompt.phase === "leaderboard" && Number.isFinite(session.prompt.completedAt);
    const promptPoints = promptCompleted ? teamScorePoints(session, team) : 0;
    const promptPercent = promptCompleted ? teamScorePercent(session, team) : 0;

    const effectiveTrustBonus =
      session.trustWho.phase === "completed"
        ? session.trustWho.teamScores?.[team] || 0
        : session.prompt.activeTrustBonus?.[team] || 0;
    const effectiveSoftSkillsBonus =
      session.softSkills.phase === "completed"
        ? session.softSkills.teamScores?.[team] || 0
        : session.prompt.activeSoftSkillsBonus?.[team] || 0;

    const manualAdjustment = Number(session.prompt.manualPointAdjustments?.[team]) || 0;
    const adjustedScore = Math.max(0, promptPoints + effectiveTrustBonus + effectiveSoftSkillsBonus + manualAdjustment);

    return {
      team,
      promptScore: promptPoints,
      trustBonus: effectiveTrustBonus,
      softSkillsBonus: effectiveSoftSkillsBonus,
      manualAdjustment,
      score: adjustedScore,
      averagePercent: promptPercent,
      playerCount: playerIds.length,
      submissions: players.filter((p) => p.submitted).length,
      players,
    };
  }).sort((a, b) => b.score - a.score);
}

function publicSessionState(sessionId) {
  const session = state.sessions[sessionId];
  finalizeIfTimeExpired(session);
  finalizeTrustIfExpired(session);
  finalizeSoftSkillsIfExpired(session);
  recordPromptRoundCompletion(sessionId, session);
  recordTrustRunCompletion(sessionId, session);
  recordSoftSkillsRunCompletion(sessionId, session);

  return {
    session: sessionId,
    phase: session.prompt.phase,
    promptCompletedAt: session.prompt.completedAt,
    roundStartsAt: session.prompt.roundStartsAt,
    roundEndsAt: session.prompt.roundEndsAt,
    roundPausedAt: session.prompt.roundPausedAt,
    roundRemainingMs: session.prompt.roundRemainingMs,
    joinCodeEnabled: Boolean(session.prompt.joinCode),
    trustWho: publicTrustWhoState(sessionId),
    softSkills: publicSoftSkillsState(sessionId),
    serverTime: Date.now(),
    leaderboard: leaderboardForSession(session),
  };
}

function publicTrustWhoState(sessionId) {
  const session = state.sessions[sessionId];
  finalizeTrustIfExpired(session);
  recordTrustRunCompletion(sessionId, session);

  return {
    session: sessionId,
    runId: session.trustWho.runId,
    phase: session.trustWho.phase,
    completedAt: session.trustWho.completedAt,
    remainingMs: trustRemainingMs(session),
    teamTimesMs: session.trustWho.teamTimesMs,
    teamScores: session.trustWho.teamScores,
    serverTime: Date.now(),
  };
}

function publicSoftSkillsState(sessionId) {
  const session = state.sessions[sessionId];
  finalizeSoftSkillsIfExpired(session);
  recordSoftSkillsRunCompletion(sessionId, session);

  return {
    session: sessionId,
    runId: session.softSkills.runId,
    phase: session.softSkills.phase,
    currentRound: Number(session.softSkills.currentRound) || 1,
    totalRounds: Number(session.softSkills.totalRounds) || SOFT_SKILLS_TOTAL_ROUNDS,
    roundDurationMs: Number(session.softSkills.roundDurationMs) || SOFT_SKILLS_ROUND_DURATION_MS,
    awaitingNextRound: Boolean(session.softSkills.awaitingNextRound),
    completedAt: session.softSkills.completedAt,
    remainingMs: softSkillsRemainingMs(session),
    teamTimesMs: session.softSkills.teamTimesMs,
    teamScores: session.softSkills.teamScores,
    serverTime: Date.now(),
  };
}

function publicAllSessionsState() {
  const data = {};
  for (const sessionId of SESSION_IDS) {
    data[sessionId] = publicSessionState(sessionId);
  }
  return {
    serverTime: Date.now(),
    sessions: data,
  };
}

function resolveChallengeDisplaySession(gameKey, latestSessionId) {
  const latestValid = SESSION_IDS.includes(latestSessionId) ? latestSessionId : null;
  const challengeFor = (sessionId) => state.sessions[sessionId]?.[gameKey] || {};
  const running = SESSION_IDS.filter((sessionId) => challengeFor(sessionId).phase === "running");

  // If exactly one session is live, always show it even if another session is claimed.
  if (running.length === 1) {
    return running[0];
  }

  // If both sessions are live, keep claim-screen behavior as the tie-breaker.
  if (running.length > 1) {
    if (latestValid && running.includes(latestValid)) return latestValid;
    return [...running].sort((a, b) => (challengeFor(b).startsAt || 0) - (challengeFor(a).startsAt || 0))[0];
  }

  if (latestValid) {
    return latestValid;
  }

  // Fallback to the most recently active run; default to A if both are untouched.
  const ranked = [...SESSION_IDS].sort((a, b) => {
    const ca = challengeFor(a);
    const cb = challengeFor(b);
    const aActiveAt = Math.max(ca.completedAt || 0, ca.startsAt || 0, ca.pausedAt || 0);
    const bActiveAt = Math.max(cb.completedAt || 0, cb.startsAt || 0, cb.pausedAt || 0);
    return bActiveAt - aActiveAt;
  });
  return ranked[0] || "A";
}

function resolveLeaderboardDisplaySession(latestSessionId) {
  const latestValid = SESSION_IDS.includes(latestSessionId) ? latestSessionId : null;
  if (latestValid) {
    return latestValid;
  }

  const ranked = [...SESSION_IDS].sort((a, b) => {
    const pa = state.sessions[a]?.prompt || {};
    const pb = state.sessions[b]?.prompt || {};
    const aActiveAt = Math.max(pa.completedAt || 0, pa.roundStartsAt || 0, pa.roundPausedAt || 0, pa.joinCodeGeneratedAt || 0);
    const bActiveAt = Math.max(pb.completedAt || 0, pb.roundStartsAt || 0, pb.roundPausedAt || 0, pb.joinCodeGeneratedAt || 0);
    return bActiveAt - aActiveAt;
  });
  return ranked[0] || "A";
}

function generateJoinCode() {
  const idx = crypto.randomInt(0, ROOM_CODE_WORDS.length);
  return ROOM_CODE_WORDS[idx].toUpperCase();
}

function assignUniqueJoinCode(sessionId) {
  const inUse = new Set(
    SESSION_IDS.filter((id) => id !== sessionId)
      .map((id) => state.sessions[id].prompt.joinCode)
      .filter(Boolean)
  );

  let attempts = 0;
  let code = generateJoinCode();
  while (inUse.has(code) && attempts < 20) {
    code = generateJoinCode();
    attempts += 1;
  }
  return code;
}

function requireMaster(req, res, next) {
  const key = req.header("x-master-key") || req.body?.masterKey;
  if (key !== MASTER_KEY) {
    return res.status(401).json({ error: "Unauthorized master access." });
  }
  next();
}

function setPhase(session, phase) {
  session.prompt.phase = phase;
  if (phase === "closed") {
    resetTimerFields(session);
  }
  if (phase === "lobby") {
    resetTimerFields(session);
  }
  if (phase === "leaderboard") {
    session.prompt.roundEndsAt = null;
    session.prompt.roundPausedAt = null;
    if (session.prompt.roundRemainingMs < 0) {
      session.prompt.roundRemainingMs = 0;
    }
    markRoundCompletedPlayers(session);
  }
}

app.use(express.json());
app.use(express.static("public"));

app.get("/aux", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "aux.html"));
});

app.get("/docs", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "docs.html"));
});

app.get("/documentation", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "docs.html"));
});

app.get("/prompt-sandbox", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "prompt-sandbox.html"));
});

app.get("/stats", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "stats.html"));
});

app.get("/recruiter-focus-finder", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "recruiterfocusfinder.html"));
});

app.get("/ai-trust-test", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "ai-trust-test.html"));
});

app.get("/prompt-like-a-pro", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "prompt-like-a-pro.html"));
});

app.get("/prompt-like-a-pro-legacy", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "prompt-like-a-pro-legacy.html"));
});

app.get("/hiring-assistant-demo", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "hiring-assistant-demo.html"));
});

app.get("/human-skills-in-the-age-of-ai", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "human-skills-in-the-age-of-ai.html"));
});

app.get("/ai-adoption-plan", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "ai-adoption-plan.html"));
});

app.get("/resources-and-takeaways", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "resources-and-takeaways.html"));
});

app.get("/dev-cert.pem", (req, res) => {
  if (!fs.existsSync(SSL_CERT_PATH)) {
    return res.status(404).send("Certificate not found. Run: npm run cert");
  }
  res.type("application/x-pem-file");
  res.sendFile(SSL_CERT_PATH);
});

app.get("/api/config", (_, res) => {
  res.json({
    sessions: SESSION_IDS,
    teams: TEAMS,
    maxTeamSize: MAX_TEAM_SIZE,
    roundDurationMs: ROUND_DURATION_MS,
    welcomeDurationMs: WELCOME_DURATION_MS,
    introVirtualKeyboardEnabled: Boolean(state.settings?.introVirtualKeyboardEnabled),
    introDimensions,
  });
});

app.get("/api/state", (req, res) => {
  const sessionId = String(req.query.session || "A").toUpperCase();
  const session = requireSession(sessionId, res);
  if (!session) return;
  res.json(publicSessionState(sessionId));
});

app.get("/api/sessions-state", (_, res) => {
  res.json(publicAllSessionsState());
});

app.get("/api/trust-who/display", (_, res) => {
  const sessionId = resolveChallengeDisplaySession("trustWho", state.latestTrustWho.sessionId);
  const trust = publicTrustWhoState(sessionId);
  const prompt = publicSessionState(sessionId);

  res.json({
    latestSession: sessionId,
    trustWho: trust,
    leaderboard: prompt.leaderboard,
    promptPhase: prompt.phase,
    serverTime: Date.now(),
  });
});

app.get("/api/soft-skills/display", (_, res) => {
  const sessionId = resolveChallengeDisplaySession("softSkills", state.latestSoftSkills.sessionId);
  const soft = publicSoftSkillsState(sessionId);
  const prompt = publicSessionState(sessionId);

  res.json({
    latestSession: sessionId,
    softSkills: soft,
    leaderboard: prompt.leaderboard,
    promptPhase: prompt.phase,
    serverTime: Date.now(),
  });
});

app.get("/api/leaderboard/display", (_, res) => {
  const sessionId = resolveLeaderboardDisplaySession(state.latestLeaderboard.sessionId);
  const session = publicSessionState(sessionId);

  res.json({
    latestSession: sessionId,
    session,
    serverTime: Date.now(),
  });
});

app.post("/api/passcode-check", (req, res) => {
  const providedCode = String(req.body?.passcode || "")
    .trim()
    .toUpperCase();

  if (!providedCode) {
    return res.status(400).json({ error: "Passcode is required." });
  }

  let matchedSessionId = null;
  for (const sessionId of SESSION_IDS) {
    if (state.sessions[sessionId].prompt.joinCode === providedCode) {
      matchedSessionId = sessionId;
      break;
    }
  }

  if (!matchedSessionId) {
    return res.status(401).json({ error: "Invalid passcode." });
  }

  const session = state.sessions[matchedSessionId];
  if (session.prompt.phase !== "lobby") {
    return res.status(400).json({ error: `Group ${matchedSessionId} lobby is not open yet.` });
  }

  res.json({ session: matchedSessionId, phase: session.prompt.phase });
});

app.post("/api/intro", (req, res) => {
  const { objective, style, context, selections, companyName } = req.body || {};
  const safeCompanyName = String(companyName || "").trim().slice(0, 120);

  if (Array.isArray(selections) && selections.length > 0) {
    const cleaned = selections
      .map((entry) => ({
        stage: String(entry?.stage || "").trim(),
        task: String(entry?.task || "").trim(),
      }))
      .filter((entry) => entry.stage && entry.task);

    if (!cleaned.length) {
      return res.status(400).json({ error: "Pick at least one focus action." });
    }

    const byStage = {};
    for (const item of cleaned) {
      if (!byStage[item.stage]) byStage[item.stage] = [];
      byStage[item.stage].push(item.task);
    }

    const stageNames = Object.keys(byStage);
    const stageSummary = stageNames.join(", ");
    const actionCount = cleaned.length;
    const result = `Focus plan across ${stageNames.length} stages (${stageSummary}). ${actionCount} actions selected. Priority first step: ${cleaned[0].task}.`;

    const introId = crypto.randomUUID();
    const pickedAiMinutes = cleaned.reduce((sum, item) => {
      const key = `${item.stage}::${item.task}`;
      return sum + (workflowTaskMap.get(key) || 0);
    }, 0);
    const unpickedMinutes = Math.max(0, workflowTotalAiMinutes - pickedAiMinutes);
    const unpickedHours = Math.round((unpickedMinutes / 60) * 10) / 10;

    state.introResults[introId] = { selections: cleaned, result };
    analytics.introSubmissions.push({
      id: introId,
      createdAt: Date.now(),
      companyName: safeCompanyName || "Unknown",
      selections: cleaned,
      result,
      unpickedHours,
    });
    persistAnalytics();
    return res.json({ introId, result, note: "This intro result does not affect game scores." });
  }

  if (!objective || !style || !context) {
    return res.status(400).json({ error: "Pick at least one focus action." });
  }

  const result = `${style} ${objective} strategy for ${context}. Team energy projected: ${["High", "Medium", "Focused"][Math.floor(Math.random() * 3)]
    }.`;

  const introId = crypto.randomUUID();
  state.introResults[introId] = { objective, style, context, result };
  analytics.introSubmissions.push({
    id: introId,
    createdAt: Date.now(),
    companyName: safeCompanyName || "Unknown",
    selections: [
      { stage: "objective", task: String(objective || "") },
      { stage: "style", task: String(style || "") },
      { stage: "context", task: String(context || "") },
    ],
    result,
    unpickedHours: 0,
  });
  persistAnalytics();

  return res.json({ introId, result, note: "This intro result does not affect game scores." });
});

app.post("/api/join", (req, res) => {
  const { session: sessionRaw, team, passcode, joinCode } = req.body || {};
  const sessionId = String(sessionRaw || "").toUpperCase();
  const session = requireSession(sessionId, res);
  if (!session) return;

  finalizeIfTimeExpired(session);

  if (session.prompt.phase !== "lobby") {
    return res.status(400).json({ error: `Group ${sessionId} has not started lobby yet.` });
  }

  const providedCode = String(passcode || joinCode || "")
    .trim()
    .toUpperCase();

  if (!session.prompt.joinCode) {
    return res.status(400).json({ error: "Passcode is not active yet. Ask the team lead to open the lobby." });
  }

  if (!providedCode || providedCode !== session.prompt.joinCode) {
    return res.status(401).json({ error: "Invalid passcode." });
  }

  if (!TEAMS.includes(team)) {
    return res.status(400).json({ error: "Invalid team." });
  }

  if (session.prompt.teams[team].length >= MAX_TEAM_SIZE) {
    return res.status(400).json({ error: `Team ${team} is full (${MAX_TEAM_SIZE}).` });
  }

  const playerId = crypto.randomUUID();
  const playerNumber = session.prompt.teams[team].length + 1;
  const player = {
    id: playerId,
    name: `Player ${playerNumber}`,
    team,
    score: 0,
    failedAwardScore: 0,
    submitted: false,
    progressStage: "lobby",
    prompt: "",
    feedback: "",
  };

  session.prompt.players[playerId] = player;
  session.prompt.teams[team].push(playerId);

  res.json({ playerId, player, session: sessionId, state: publicSessionState(sessionId) });
});

app.post("/api/player/change-team", (req, res) => {
  const { playerId, team } = req.body || {};
  const found = findPlayerSession(playerId);
  if (!found) {
    return res.status(404).json({ error: "Player not found." });
  }

  if (!TEAMS.includes(team)) {
    return res.status(400).json({ error: "Invalid team." });
  }

  const { session, player, sessionId } = found;
  finalizeIfTimeExpired(session);

  if (session.prompt.phase !== "lobby") {
    return res.status(400).json({ error: "Team can only be changed while lobby is open." });
  }

  if (player.team === team) {
    return res.json({ ok: true, player, session: sessionId, state: publicSessionState(sessionId) });
  }

  const targetTeamSize = session.prompt.teams[team].filter((id) => id !== player.id).length;
  if (targetTeamSize >= MAX_TEAM_SIZE) {
    return res.status(400).json({ error: `Team ${team} is full (${MAX_TEAM_SIZE}).` });
  }

  for (const t of TEAMS) {
    session.prompt.teams[t] = session.prompt.teams[t].filter((id) => id !== player.id);
  }
  session.prompt.teams[team].push(player.id);
  player.team = team;

  res.json({ ok: true, player, session: sessionId, state: publicSessionState(sessionId) });
});

app.post("/api/submit", async (req, res) => {
  const { playerId, prompt, brief } = req.body || {};
  const found = findPlayerSession(playerId);

  if (!found) {
    return res.status(404).json({ error: "Player not found." });
  }

  const { session, player, sessionId } = found;
  finalizeIfTimeExpired(session);

  if (session.prompt.phase !== "round") {
    return res.status(400).json({ error: "Round is not active." });
  }

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  if (player.submitted) {
    return res.status(400).json({ error: "This player has already submitted a prompt." });
  }

  const scored = await runPromptScoring(prompt, brief);
  const rawScore = scored.rawScore;
  if (scored.failed) {
    const failAwardScore = Math.max(0, Math.min(100, PROMPT_FAIL_AWARD_SCORE));
    player.failedAwardScore = failAwardScore;
    player.progressStage = "prompting";
    analytics.promptSubmissions.push({
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      session: sessionId,
      team: player.team,
      playerId: player.id,
      brief: scored.brief,
      passed: false,
      scoreRaw: rawScore,
      scoreCurved: scored.curvedScore,
      failAwardScore: failAwardScore,
      sectionScores: scored.sectionScores || {},
    });
    persistAnalytics();
    return res.json({
      failed: true,
      score: scored.curvedScore,
      failAwardScore: failAwardScore,
      feedback: scored.feedback,
      sectionScores: scored.sectionScores,
      sectionComments: scored.sectionComments,
      teamScore: teamScorePoints(session, player.team),
      session: sessionId,
      state: publicSessionState(sessionId),
    });
  }

  player.prompt = prompt.trim();
  player.score = scored.curvedScore;
  player.failedAwardScore = 0;
  player.feedback = scored.feedback;
  player.sectionScores = scored.sectionScores;
  player.sectionComments = scored.sectionComments;
  player.submitted = true;
  player.progressStage = "completed";
  analytics.promptSubmissions.push({
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    session: sessionId,
    team: player.team,
    playerId: player.id,
    brief: scored.brief,
    passed: true,
    scoreRaw: rawScore,
    scoreCurved: player.score,
    sectionScores: player.sectionScores || {},
  });
  persistAnalytics();

  res.json({
    failed: false,
    score: player.score,
    feedback: player.feedback,
    sectionScores: player.sectionScores,
    sectionComments: player.sectionComments,
    teamScore: teamScorePoints(session, player.team),
    session: sessionId,
    state: publicSessionState(sessionId),
  });
});

app.post("/api/master/prompt-sandbox", requireMaster, async (req, res) => {
  const { prompt, brief } = req.body || {};
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  try {
    const scored = await runPromptScoring(prompt, brief);
    return res.json(scored);
  } catch (err) {
    console.error("Prompt sandbox error:", err);
    return res.status(500).json({ error: "Could not score prompt." });
  }
});

app.post("/api/prompt-like-a-pro/score", async (req, res) => {
  const { prompt, brief } = req.body || {};
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  try {
    const scored = await runPromptScoring(prompt, brief);
    return res.json(scored);
  } catch (err) {
    console.error("Prompt Like a Pro score error:", err);
    return res.status(500).json({ error: "Could not score prompt." });
  }
});

app.post("/api/player-stage", (req, res) => {
  const { playerId, stage } = req.body || {};
  const found = findPlayerSession(playerId);

  if (!found) {
    return res.status(404).json({ error: "Player not found." });
  }

  if (!PLAYER_STAGES.has(stage)) {
    return res.status(400).json({ error: "Invalid player stage." });
  }

  const { player } = found;
  if (player.submitted) {
    player.progressStage = "completed";
    return res.json({ ok: true, stage: player.progressStage });
  }

  player.progressStage = stage;
  res.json({ ok: true, stage: player.progressStage });
});

app.post("/api/master/auth", requireMaster, (_, res) => {
  res.json({ ok: true });
});

app.get("/api/master/session-status", requireMaster, (_, res) => {
  const sessions = {};
  for (const sessionId of SESSION_IDS) {
    sessions[sessionId] = {
      ...publicSessionState(sessionId),
      joinCode: state.sessions[sessionId].prompt.joinCode,
      generatedAt: state.sessions[sessionId].prompt.joinCodeGeneratedAt,
      trustWho: publicTrustWhoState(sessionId),
      softSkills: publicSoftSkillsState(sessionId),
    };
  }
  res.json({
    sessions,
    latestLeaderboardSession: state.latestLeaderboard.sessionId,
    introVirtualKeyboardEnabled: Boolean(state.settings?.introVirtualKeyboardEnabled),
    serverTime: Date.now(),
  });
});

app.post("/api/master/settings/intro-virtual-keyboard", requireMaster, (req, res) => {
  const enabled = Boolean(req.body?.enabled);
  state.settings.introVirtualKeyboardEnabled = enabled;
  res.json({ ok: true, introVirtualKeyboardEnabled: enabled });
});

app.get("/api/master/join-code", requireMaster, (req, res) => {
  const sessionId = String(req.query.session || "").toUpperCase();
  const session = requireSession(sessionId, res);
  if (!session) return;

  res.json({
    joinCode: session.prompt.joinCode,
    generatedAt: session.prompt.joinCodeGeneratedAt,
  });
});

app.post("/api/master/generate-join-code", requireMaster, (req, res) => {
  const sessionId = String(req.body?.session || "").toUpperCase();
  const session = requireSession(sessionId, res);
  if (!session) return;

  session.prompt.joinCode = assignUniqueJoinCode(sessionId);
  session.prompt.joinCodeGeneratedAt = Date.now();
  res.json({
    joinCode: session.prompt.joinCode,
    generatedAt: session.prompt.joinCodeGeneratedAt,
    session: sessionId,
  });
});

app.post("/api/master/start-game", requireMaster, (req, res) => {
  const sessionId = String(req.body?.session || "").toUpperCase();
  const session = requireSession(sessionId, res);
  if (!session) return;

  const nextBonus = { ...session.prompt.nextTrustBonus };
  const nextSoftSkillsBonus = {
    ...Object.fromEntries(TEAMS.map((team) => [team, 0])),
    ...(session.prompt.nextSoftSkillsBonus || {}),
  };
  const freshPrompt = createInitialSessionState().prompt;
  session.prompt = freshPrompt;
  session.prompt.phase = "lobby";
  session.prompt.joinCode = assignUniqueJoinCode(sessionId);
  session.prompt.joinCodeGeneratedAt = Date.now();
  session.prompt.activeTrustBonus = nextBonus;
  session.prompt.activeSoftSkillsBonus = nextSoftSkillsBonus;
  session.prompt.nextTrustBonus = Object.fromEntries(TEAMS.map((team) => [team, 0]));
  session.prompt.nextSoftSkillsBonus = Object.fromEntries(TEAMS.map((team) => [team, 0]));
  session.prompt.manualPointAdjustments = Object.fromEntries(TEAMS.map((team) => [team, 0]));
  state.latestLeaderboard = { sessionId };

  res.json({
    ...publicSessionState(sessionId),
    joinCode: session.prompt.joinCode,
    generatedAt: session.prompt.joinCodeGeneratedAt,
  });
});

app.post("/api/master/trust/start", requireMaster, (req, res) => {
  const sessionId = String(req.body?.session || "").toUpperCase();
  const session = requireSession(sessionId, res);
  if (!session) return;

  session.trustWho.runId += 1;
  session.trustWho.phase = "running";
  session.trustWho.startsAt = Date.now();
  session.trustWho.remainingMs = TRUST_DURATION_MS;
  session.trustWho.endsAt = Date.now() + TRUST_DURATION_MS;
  session.trustWho.pausedAt = null;
  session.trustWho.completedAt = null;
  session.trustWho.teamTimesMs = Object.fromEntries(TEAMS.map((team) => [team, null]));
  session.trustWho.teamScores = Object.fromEntries(TEAMS.map((team) => [team, 0]));
  state.latestTrustWho = { sessionId, runId: session.trustWho.runId };

  res.json(publicTrustWhoState(sessionId));
});

app.post("/api/master/trust/claim-screen", requireMaster, (req, res) => {
  const sessionId = String(req.body?.session || "").toUpperCase();
  const session = requireSession(sessionId, res);
  if (!session) return;

  state.latestTrustWho = { sessionId, runId: session.trustWho.runId };
  res.json(publicTrustWhoState(sessionId));
});

app.post("/api/master/trust/pause", requireMaster, (req, res) => {
  const sessionId = String(req.body?.session || "").toUpperCase();
  const session = requireSession(sessionId, res);
  if (!session) return;

  finalizeTrustIfExpired(session);
  if (session.trustWho.phase !== "running") {
    return res.status(400).json({ error: "Trust Who timer is not running." });
  }

  session.trustWho.remainingMs = trustRemainingMs(session);
  session.trustWho.endsAt = null;
  session.trustWho.pausedAt = Date.now();
  session.trustWho.phase = "paused";

  res.json(publicTrustWhoState(sessionId));
});

app.post("/api/master/trust/resume", requireMaster, (req, res) => {
  const sessionId = String(req.body?.session || "").toUpperCase();
  const session = requireSession(sessionId, res);
  if (!session) return;

  if (session.trustWho.phase !== "paused") {
    return res.status(400).json({ error: "Trust Who timer is not paused." });
  }

  const remaining = Math.max(1, session.trustWho.remainingMs || TRUST_DURATION_MS);
  session.trustWho.phase = "running";
  session.trustWho.pausedAt = null;
  session.trustWho.endsAt = Date.now() + remaining;

  res.json(publicTrustWhoState(sessionId));
});

app.post("/api/master/trust/restart", requireMaster, (req, res) => {
  const sessionId = String(req.body?.session || "").toUpperCase();
  const session = requireSession(sessionId, res);
  if (!session) return;

  session.trustWho.runId += 1;
  session.trustWho.phase = "running";
  session.trustWho.startsAt = Date.now();
  session.trustWho.remainingMs = TRUST_DURATION_MS;
  session.trustWho.endsAt = Date.now() + TRUST_DURATION_MS;
  session.trustWho.pausedAt = null;
  session.trustWho.completedAt = null;
  session.trustWho.teamTimesMs = Object.fromEntries(TEAMS.map((team) => [team, null]));
  session.trustWho.teamScores = Object.fromEntries(TEAMS.map((team) => [team, 0]));
  state.latestTrustWho = { sessionId, runId: session.trustWho.runId };

  res.json(publicTrustWhoState(sessionId));
});

app.post("/api/master/trust/finish-team", requireMaster, (req, res) => {
  const sessionId = String(req.body?.session || "").toUpperCase();
  const team = String(req.body?.team || "").toLowerCase();
  const session = requireSession(sessionId, res);
  if (!session) return;

  if (!TEAMS.includes(team)) {
    return res.status(400).json({ error: "Invalid team." });
  }

  finalizeTrustIfExpired(session);
  if (session.trustWho.phase !== "running" && session.trustWho.phase !== "paused") {
    return res.status(400).json({ error: "Trust Who game is not active." });
  }

  if (!Number.isFinite(session.trustWho.teamTimesMs[team])) {
    const elapsed = trustElapsedMs(session);
    session.trustWho.teamTimesMs[team] = elapsed;
    session.trustWho.teamScores[team] = trustScoreFromElapsed(elapsed);
    maybeCompleteTrust(session);
    recordTrustRunCompletion(sessionId, session);
  }

  res.json(publicTrustWhoState(sessionId));
});

app.post("/api/master/soft/start", requireMaster, (req, res) => {
  const sessionId = String(req.body?.session || "").toUpperCase();
  const session = requireSession(sessionId, res);
  if (!session) return;

  session.softSkills.runId += 1;
  session.softSkills.phase = "running";
  session.softSkills.startsAt = Date.now();
  session.softSkills.remainingMs = SOFT_SKILLS_ROUND_DURATION_MS;
  session.softSkills.endsAt = Date.now() + SOFT_SKILLS_ROUND_DURATION_MS;
  session.softSkills.pausedAt = null;
  session.softSkills.completedAt = null;
  session.softSkills.currentRound = 1;
  session.softSkills.totalRounds = SOFT_SKILLS_TOTAL_ROUNDS;
  session.softSkills.roundDurationMs = SOFT_SKILLS_ROUND_DURATION_MS;
  session.softSkills.awaitingNextRound = false;
  session.softSkills.teamTimesMs = Object.fromEntries(TEAMS.map((team) => [team, null]));
  session.softSkills.teamScores = Object.fromEntries(TEAMS.map((team) => [team, 0]));
  state.latestSoftSkills = { sessionId, runId: session.softSkills.runId };

  res.json(publicSoftSkillsState(sessionId));
});

app.post("/api/master/soft/claim-screen", requireMaster, (req, res) => {
  const sessionId = String(req.body?.session || "").toUpperCase();
  const session = requireSession(sessionId, res);
  if (!session) return;

  state.latestSoftSkills = { sessionId, runId: session.softSkills.runId };
  res.json(publicSoftSkillsState(sessionId));
});

app.post("/api/master/leaderboard/claim-screen", requireMaster, (req, res) => {
  const sessionId = String(req.body?.session || "").toUpperCase();
  const session = requireSession(sessionId, res);
  if (!session) return;

  state.latestLeaderboard = { sessionId };
  res.json({
    latestSession: sessionId,
    session: publicSessionState(sessionId),
    serverTime: Date.now(),
  });
});

app.post("/api/master/soft/pause", requireMaster, (req, res) => {
  const sessionId = String(req.body?.session || "").toUpperCase();
  const session = requireSession(sessionId, res);
  if (!session) return;

  finalizeSoftSkillsIfExpired(session);
  if (session.softSkills.phase !== "running") {
    return res.status(400).json({ error: "Soft Skills Significance timer is not running." });
  }

  session.softSkills.remainingMs = softSkillsRemainingMs(session);
  session.softSkills.endsAt = null;
  session.softSkills.pausedAt = Date.now();
  session.softSkills.phase = "paused";
  session.softSkills.awaitingNextRound = false;

  res.json(publicSoftSkillsState(sessionId));
});

app.post("/api/master/soft/resume", requireMaster, (req, res) => {
  const sessionId = String(req.body?.session || "").toUpperCase();
  const session = requireSession(sessionId, res);
  if (!session) return;

  if (session.softSkills.phase !== "paused") {
    return res.status(400).json({ error: "Soft Skills Significance timer is not paused." });
  }

  const remaining = Math.max(1, session.softSkills.remainingMs || SOFT_SKILLS_ROUND_DURATION_MS);
  const startingNextRound = Boolean(session.softSkills.awaitingNextRound);
  const now = Date.now();
  session.softSkills.phase = "running";
  session.softSkills.pausedAt = null;
  if (startingNextRound) {
    const currentRound = Number(session.softSkills.currentRound) || 1;
    const totalRounds = Number(session.softSkills.totalRounds) || SOFT_SKILLS_TOTAL_ROUNDS;
    session.softSkills.currentRound = Math.min(totalRounds, currentRound + 1);
    session.softSkills.teamTimesMs = Object.fromEntries(TEAMS.map((team) => [team, null]));
    session.softSkills.remainingMs = SOFT_SKILLS_ROUND_DURATION_MS;
    session.softSkills.startsAt = now;
    session.softSkills.endsAt = now + SOFT_SKILLS_ROUND_DURATION_MS;
  } else {
    session.softSkills.endsAt = now + remaining;
  }
  session.softSkills.awaitingNextRound = false;

  res.json(publicSoftSkillsState(sessionId));
});

app.post("/api/master/soft/restart", requireMaster, (req, res) => {
  const sessionId = String(req.body?.session || "").toUpperCase();
  const session = requireSession(sessionId, res);
  if (!session) return;

  session.softSkills.runId += 1;
  session.softSkills.phase = "running";
  session.softSkills.startsAt = Date.now();
  session.softSkills.remainingMs = SOFT_SKILLS_ROUND_DURATION_MS;
  session.softSkills.endsAt = Date.now() + SOFT_SKILLS_ROUND_DURATION_MS;
  session.softSkills.pausedAt = null;
  session.softSkills.completedAt = null;
  session.softSkills.currentRound = 1;
  session.softSkills.totalRounds = SOFT_SKILLS_TOTAL_ROUNDS;
  session.softSkills.roundDurationMs = SOFT_SKILLS_ROUND_DURATION_MS;
  session.softSkills.awaitingNextRound = false;
  session.softSkills.teamTimesMs = Object.fromEntries(TEAMS.map((team) => [team, null]));
  session.softSkills.teamScores = Object.fromEntries(TEAMS.map((team) => [team, 0]));
  state.latestSoftSkills = { sessionId, runId: session.softSkills.runId };

  res.json(publicSoftSkillsState(sessionId));
});

app.post("/api/master/soft/finish-team", requireMaster, (req, res) => {
  const sessionId = String(req.body?.session || "").toUpperCase();
  const team = String(req.body?.team || "").toLowerCase();
  const session = requireSession(sessionId, res);
  if (!session) return;

  if (!TEAMS.includes(team)) {
    return res.status(400).json({ error: "Invalid team." });
  }

  finalizeSoftSkillsIfExpired(session);
  const awaitingNextRound = Boolean(session.softSkills.awaitingNextRound);
  if (session.softSkills.phase !== "running" && !(session.softSkills.phase === "paused" && !awaitingNextRound)) {
    return res.status(400).json({ error: "Soft Skills Significance game is not active." });
  }

  if (!Number.isFinite(session.softSkills.teamTimesMs[team])) {
    const elapsed = softSkillsElapsedMs(session);
    session.softSkills.teamTimesMs[team] = elapsed;
    session.softSkills.teamScores[team] = (session.softSkills.teamScores[team] || 0) + softSkillsScoreFromElapsed(elapsed);
    maybeCompleteSoftSkills(session);
    recordSoftSkillsRunCompletion(sessionId, session);
  }

  res.json(publicSoftSkillsState(sessionId));
});

app.post("/api/master/start-round", requireMaster, (req, res) => {
  const sessionId = String(req.body?.session || "").toUpperCase();
  const session = requireSession(sessionId, res);
  if (!session) return;

  const now = Date.now();
  session.prompt.roundRemainingMs = ROUND_DURATION_MS;
  session.prompt.roundStartsAt = now + WELCOME_DURATION_MS;
  session.prompt.roundEndsAt = session.prompt.roundStartsAt + session.prompt.roundRemainingMs;
  session.prompt.roundPausedAt = null;
  session.prompt.completedAt = null;
  session.prompt.phase = "round";
  session.prompt.manualPointAdjustments = Object.fromEntries(TEAMS.map((team) => [team, 0]));
  markRoundBriefingPlayers(session);
  state.latestLeaderboard = { sessionId };

  res.json(publicSessionState(sessionId));
});

app.post("/api/master/pause-round", requireMaster, (req, res) => {
  const sessionId = String(req.body?.session || "").toUpperCase();
  const session = requireSession(sessionId, res);
  if (!session) return;

  finalizeIfTimeExpired(session);

  if (session.prompt.phase !== "round" || !session.prompt.roundEndsAt) {
    return res.status(400).json({ error: "Round is not running." });
  }

  const now = Date.now();
  session.prompt.roundRemainingMs = Math.max(0, session.prompt.roundEndsAt - now);
  session.prompt.roundEndsAt = null;
  session.prompt.roundPausedAt = now;

  res.json(publicSessionState(sessionId));
});

app.post("/api/master/resume-round", requireMaster, (req, res) => {
  const sessionId = String(req.body?.session || "").toUpperCase();
  const session = requireSession(sessionId, res);
  if (!session) return;

  if (!session.prompt.roundPausedAt) {
    return res.status(400).json({ error: "Round is not paused." });
  }

  const now = Date.now();
  const remaining = Math.max(1, session.prompt.roundRemainingMs || ROUND_DURATION_MS);

  session.prompt.roundStartsAt = now;
  session.prompt.roundEndsAt = now + remaining;
  session.prompt.roundPausedAt = null;
  session.prompt.phase = "round";

  res.json(publicSessionState(sessionId));
});

app.post("/api/master/end-round", requireMaster, (req, res) => {
  const sessionId = String(req.body?.session || "").toUpperCase();
  const session = requireSession(sessionId, res);
  if (!session) return;

  if (session.prompt.roundEndsAt) {
    session.prompt.roundRemainingMs = Math.max(0, session.prompt.roundEndsAt - Date.now());
  }
  session.prompt.roundEndsAt = null;
  session.prompt.roundPausedAt = null;
  session.prompt.completedAt = Date.now();
  session.prompt.phase = "leaderboard";
  markRoundCompletedPlayers(session);
  recordPromptRoundCompletion(sessionId, session);
  state.latestLeaderboard = { sessionId };

  res.json(publicSessionState(sessionId));
});

app.post("/api/master/close-game", requireMaster, (req, res) => {
  const sessionId = String(req.body?.session || "").toUpperCase();
  const session = requireSession(sessionId, res);
  if (!session) return;

  const keepTrust = session.trustWho;
  const keepSoftSkills = session.softSkills;
  state.sessions[sessionId] = createInitialSessionState();
  state.sessions[sessionId].trustWho = keepTrust;
  state.sessions[sessionId].softSkills = keepSoftSkills;
  res.json(publicSessionState(sessionId));
});

app.post("/api/master/reset-session", requireMaster, (req, res) => {
  const sessionId = String(req.body?.session || "").toUpperCase();
  const session = requireSession(sessionId, res);
  if (!session) return;

  state.sessions[sessionId] = createInitialSessionState();
  if (state.latestTrustWho.sessionId === sessionId) {
    state.latestTrustWho = { sessionId: null, runId: 0 };
  }
  if (state.latestSoftSkills.sessionId === sessionId) {
    state.latestSoftSkills = { sessionId: null, runId: 0 };
  }
  if (state.latestLeaderboard.sessionId === sessionId) {
    state.latestLeaderboard = { sessionId: null };
  }
  res.json(publicSessionState(sessionId));
});

app.post("/api/master/push-manual-points", requireMaster, (req, res) => {
  const sessionId = String(req.body?.session || "").toUpperCase();
  const session = requireSession(sessionId, res);
  if (!session) return;

  const scores = req.body?.scores;
  if (!scores || typeof scores !== "object") {
    return res.status(400).json({ error: "Point deltas payload is required." });
  }

  if (!session.prompt.manualPointAdjustments || typeof session.prompt.manualPointAdjustments !== "object") {
    session.prompt.manualPointAdjustments = Object.fromEntries(TEAMS.map((team) => [team, 0]));
  }

  let pushed = false;
  for (const team of TEAMS) {
    const raw = scores[team];
    if (raw === "" || raw === null || typeof raw === "undefined") continue;
    const delta = Number(raw);
    if (!Number.isFinite(delta)) {
      return res.status(400).json({ error: `Invalid point delta for team ${team}.` });
    }
    const roundedDelta = Math.round(delta);
    if (roundedDelta === 0) continue;
    const current = Number(session.prompt.manualPointAdjustments?.[team]) || 0;
    session.prompt.manualPointAdjustments[team] = current + roundedDelta;
    pushed = true;
  }

  if (!pushed) {
    return res.status(400).json({ error: "No point changes submitted." });
  }

  state.latestLeaderboard = { sessionId };
  res.json(publicSessionState(sessionId));
});

app.get("/api/stats", (req, res) => {
  res.json(buildStatsSummary());
});

app.get("/api/stats/export.xls", (req, res) => {
  const stats = buildStatsSummary();
  const xls = buildXlsFromStats(stats);
  res.setHeader("Content-Type", "application/vnd.ms-excel; charset=UTF-8");
  res.setHeader("Content-Disposition", `attachment; filename="liha-game-stats-${Date.now()}.xls"`);
  res.send(`\uFEFF${xls}`);
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});

function firstLanIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const entries = interfaces[name] || [];
    for (const entry of entries) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }
  return null;
}

function startHttpServer() {
  const lanIp = firstLanIp();
  http.createServer(app).listen(PORT, HOST, () => {
    console.log(`Game server running on http://localhost:${PORT}`);
    if (lanIp) {
      console.log(`LAN access: http://${lanIp}:${PORT}`);
    }
  });
}

function startHttpsServer() {
  const lanIp = firstLanIp();
  const tls = {
    key: fs.readFileSync(SSL_KEY_PATH, "utf8"),
    cert: fs.readFileSync(SSL_CERT_PATH, "utf8"),
  };

  https.createServer(tls, app).listen(PORT, HOST, () => {
    console.log(`Game server running on https://localhost:${PORT}`);
    if (lanIp) {
      console.log(`LAN access: https://${lanIp}:${PORT}`);
    }
  });
}

if (USE_HTTPS) {
  if (fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH)) {
    startHttpsServer();
  } else {
    console.log("HTTPS requested but certificate files were not found.");
    console.log(`Missing files: ${SSL_KEY_PATH} and/or ${SSL_CERT_PATH}`);
    console.log("Run: npm run cert");
    console.log("Falling back to HTTP for now.");
    startHttpServer();
  }
} else {
  startHttpServer();
}
