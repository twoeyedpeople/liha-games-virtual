const statCardsEl = document.getElementById("stat-cards");
const updatedEl = document.getElementById("stats-updated");
const introTableEl = document.getElementById("table-intro");

const selectedTasksEl = document.getElementById("chart-selected-tasks");
const promptTeamsEl = document.getElementById("chart-prompt-teams");
const trustTeamsEl = document.getElementById("chart-trust-teams");
const softTeamsEl = document.getElementById("chart-soft-teams");
const companiesEl = document.getElementById("chart-companies");

const refreshBtn = document.getElementById("stats-refresh");

function fmtDate(ts) {
  if (!Number.isFinite(ts)) return "--";
  return new Date(ts).toLocaleString();
}

function escapeHtml(input) {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderBars(container, rows, valueKey, maxValue, teamMode = false) {
  if (!rows.length) {
    container.innerHTML = "<p>No data yet.</p>";
    return;
  }

  const max = Math.max(1, maxValue || 0, ...rows.map((row) => Number(row[valueKey]) || 0));
  container.innerHTML = rows
    .map((row) => {
      const value = Number(row[valueKey]) || 0;
      const width = Math.min(100, Math.round((value / max) * 100));
      const label = escapeHtml(row.label || row.team || "-");
      const cls = teamMode ? ` team-${String(row.team || "").toLowerCase()}` : "";
      return `<article class="simple-bar">
        <div class="simple-bar-head">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
        <div class="simple-bar-track"><div class="simple-bar-fill${cls}" style="width:${width}%"></div></div>
      </article>`;
    })
    .join("");
}

function renderStatCards(summary) {
  const rows = [
    { label: "Recruiter Focus Finder submissions", value: summary.totals.introSubmissions },
    { label: "Unique companies", value: summary.totals.uniqueCompanies },
    { label: "Prompt rounds", value: summary.totals.promptRounds },
    { label: "Trust Who runs", value: summary.totals.trustRuns },
    { label: "Soft Skills runs", value: summary.totals.softSkillsRuns },
    { label: "Prompt submissions", value: summary.totals.promptSubmissions },
    { label: "Passed prompts", value: summary.totals.promptPassed },
    { label: "Estimated hours saved", value: summary.totals.estimatedHoursSaved },
  ];

  statCardsEl.innerHTML = rows
    .map((row) => `<article class="stat-card"><p>${escapeHtml(row.label)}</p><strong>${escapeHtml(row.value)}</strong></article>`)
    .join("");
}

function renderIntroTable(introSubmissions) {
  const rows = [...introSubmissions]
    .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
    .slice(0, 100);

  introTableEl.innerHTML = rows
    .map((row) => {
      const selections = (row.selections || [])
        .map((entry) => `${entry.stage}: ${entry.task}`)
        .join(" | ");
      return `<tr>
        <td>${escapeHtml(fmtDate(Number(row.createdAt)))}</td>
        <td>${escapeHtml(row.companyName || "Unknown")}</td>
        <td>${escapeHtml(selections)}</td>
        <td>${escapeHtml(Number(row.unpickedHours || 0).toFixed(1))}</td>
      </tr>`;
    })
    .join("");

  if (!rows.length) {
    introTableEl.innerHTML = `<tr><td colspan="4">No intro submissions yet.</td></tr>`;
  }
}

function computeCompanyCounts(introSubmissions) {
  const counts = new Map();
  for (const row of introSubmissions) {
    const name = String(row.companyName || "Unknown").trim() || "Unknown";
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

async function loadStats() {
  try {
    const response = await fetch("/api/stats", { cache: "no-store" });
    const stats = await response.json();
    if (!response.ok) {
      throw new Error(stats?.error || "Could not load stats");
    }

    updatedEl.textContent = `Last updated: ${fmtDate(Number(stats.updatedAt))}`;
    renderStatCards(stats);

    renderBars(selectedTasksEl, stats.charts?.selectedTasks || [], "count");
    renderBars(promptTeamsEl, stats.charts?.promptTeamAverages || [], "average", 100, true);
    renderBars(trustTeamsEl, stats.charts?.trustTeamAverages || [], "average", 900, true);
    renderBars(softTeamsEl, stats.charts?.softSkillsTeamAverages || [], "average", 900, true);
    renderBars(companiesEl, computeCompanyCounts(stats.records?.introSubmissions || []), "count");

    renderIntroTable(stats.records?.introSubmissions || []);
  } catch (err) {
    updatedEl.textContent = err.message || "Could not load stats.";
  }
}

refreshBtn.addEventListener("click", loadStats);
loadStats();
