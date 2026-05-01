const tableWrap = document.getElementById("board-table-wrap");
const titleEl = document.getElementById("board-title");
const copyEl = document.getElementById("board-copy");

const RESULTS_REVEAL_MS = 10_000;
const COMBINED_ADD_MS = 3_000;
let lastBothLayout = "dual";
let lastRenderSignature = "";
let lastRenderMode = "";
const scoreCache = new Map();
const scoreRaf = new Map();
let boardPushTimer = 0;
const visibleRowsByMode = new Map();
const stageEl = document.querySelector(".stage");

if (stageEl) {
  stageEl.classList.add("is-stage-entering");
  window.setTimeout(() => {
    stageEl.classList.remove("is-stage-entering");
  }, 760);
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function triggerBoardEnter(force = false) {
  if (!tableWrap) return;
  if (!force && tableWrap.classList.contains("is-board-entering")) return;
  tableWrap.classList.remove("is-board-entering");
  void tableWrap.offsetWidth;
  tableWrap.classList.add("is-board-entering");
  window.setTimeout(() => {
    tableWrap.classList.remove("is-board-entering");
  }, 720);
}

function animateScoreValue(el, key, target, from) {
  if (scoreRaf.has(key)) {
    cancelAnimationFrame(scoreRaf.get(key));
    scoreRaf.delete(key);
  }
  if (!Number.isFinite(target)) return;

  const start = Number.isFinite(from) ? from : target;
  if (start === target) {
    el.textContent = `${target}`;
    scoreCache.set(key, target);
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
      scoreRaf.set(key, rafId);
      return;
    }
    scoreRaf.delete(key);
    scoreCache.set(key, target);
  };

  const rafId = requestAnimationFrame(tick);
  scoreRaf.set(key, rafId);
}

function animateBoardScores(scopeEl) {
  const scoreEls = scopeEl.querySelectorAll("[data-score-key][data-score-target]");
  scoreEls.forEach((el) => {
    const key = el.dataset.scoreKey || "";
    const target = Number(el.dataset.scoreTarget);
    if (!key || !Number.isFinite(target)) return;
    const previous = scoreCache.has(key) ? scoreCache.get(key) : Number(el.textContent) || target;
    animateScoreValue(el, key, target, previous);
  });
}

function applyRowReveal(mode) {
  const prev = visibleRowsByMode.get(mode) || new Set();
  const next = new Set();
  tableWrap.querySelectorAll(".lb-rank-row[data-row-key]:not(.is-ghost)").forEach((row) => {
    const key = row.dataset.rowKey || "";
    if (!key) return;
    next.add(key);
    if (!prev.has(key)) {
      row.classList.add("is-reveal-in");
    }
  });
  visibleRowsByMode.set(mode, next);
}

function mountBoardHtml(html, signature, mode, { push = false } = {}) {
  if (signature === lastRenderSignature) return;
  const prevMode = lastRenderMode;
  const shouldPush = push && Boolean(tableWrap.innerHTML.trim());
  const modeChanged = prevMode !== mode;

  if (!modeChanged && mode.includes("add") && tryPatchScoresInPlace(html)) {
    lastRenderSignature = signature;
    return;
  }

  const paint = () => {
    tableWrap.innerHTML = html;
    if (prevMode !== mode) {
      scoreCache.clear();
    }
    applyRowReveal(mode);
    animateBoardScores(tableWrap);
    lastRenderSignature = signature;
    lastRenderMode = mode;
    if (mode === "combined" && prevMode.includes("add")) {
      window.LihaLottie?.playBig?.();
    }
  };

  if (!shouldPush) {
    if (prevMode !== mode) {
      triggerBoardEnter(true);
    }
    paint();
    return;
  }

  if (boardPushTimer) {
    clearTimeout(boardPushTimer);
    boardPushTimer = 0;
  }
  tableWrap.classList.remove("is-push-in-right");
  tableWrap.classList.add("is-push-out-left");
  boardPushTimer = window.setTimeout(() => {
    tableWrap.classList.remove("is-push-out-left");
    paint();
    tableWrap.classList.add("is-push-in-right");
    window.setTimeout(() => tableWrap.classList.remove("is-push-in-right"), 380);
    boardPushTimer = 0;
  }, 190);
}

function tryPatchScoresInPlace(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  const nextRows = [...temp.querySelectorAll(".lb-rank-row[data-row-key]:not(.is-ghost)")];
  const currentRows = [...tableWrap.querySelectorAll(".lb-rank-row[data-row-key]:not(.is-ghost)")];
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

function teamIconPath(sessionLabel, team) {
  const group = String(sessionLabel || "A").toUpperCase() === "B" ? "B" : "A";
  const byTeam = { red: "01", green: "02", yellow: "03", blue: "04" };
  const code = byTeam[team] || "01";
  return `/assets/images/team-${group}_${code}.png`;
}

function modeFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const fullscreen = params.get("fullscreen") === "1";
  const explicit = (params.get("group") || params.get("session") || "").toUpperCase();
  if (explicit === "SINGLE" || params.get("single") === "1") return "SINGLE";
  if (!params.get("group") && !params.get("session") && fullscreen) return "BOTH";
  if (explicit === "BOTH") return "BOTH";
  if (explicit === "B") return "B";
  return "A";
}

function sessionLabel(groupLabel) {
  return String(groupLabel).toUpperCase() === "B" ? "Session 2" : "Session 1";
}

function activeReveal(session, now) {
  const promptAt = Number.isFinite(session?.promptCompletedAt) ? session.promptCompletedAt : null;
  const trustAt = Number.isFinite(session?.trustWho?.completedAt) ? session.trustWho.completedAt : null;
  const softAt = Number.isFinite(session?.softSkills?.completedAt) ? session.softSkills.completedAt : null;
  const reveals = [];

  if (promptAt && now < promptAt + RESULTS_REVEAL_MS) {
    reveals.push({ type: "prompt", at: promptAt });
  }
  if (trustAt && now < trustAt + RESULTS_REVEAL_MS) {
    reveals.push({ type: "trust", at: trustAt });
  }
  if (softAt && now < softAt + RESULTS_REVEAL_MS) {
    reveals.push({ type: "soft", at: softAt });
  }

  if (!reveals.length) return null;
  reveals.sort((a, b) => b.at - a.at);
  return reveals[0];
}

function recentRevealForAdd(session, now) {
  const promptAt = Number.isFinite(session?.promptCompletedAt) ? session.promptCompletedAt : null;
  const trustAt = Number.isFinite(session?.trustWho?.completedAt) ? session.trustWho.completedAt : null;
  const softAt = Number.isFinite(session?.softSkills?.completedAt) ? session.softSkills.completedAt : null;
  const candidates = [];

  if (promptAt && now >= promptAt + RESULTS_REVEAL_MS && now < promptAt + RESULTS_REVEAL_MS + COMBINED_ADD_MS) {
    candidates.push({ type: "prompt", at: promptAt });
  }
  if (trustAt && now >= trustAt + RESULTS_REVEAL_MS && now < trustAt + RESULTS_REVEAL_MS + COMBINED_ADD_MS) {
    candidates.push({ type: "trust", at: trustAt });
  }
  if (softAt && now >= softAt + RESULTS_REVEAL_MS && now < softAt + RESULTS_REVEAL_MS + COMBINED_ADD_MS) {
    candidates.push({ type: "soft", at: softAt });
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.at - a.at);
  return candidates[0];
}

function sortedForReveal(rows, type) {
  const metric = type === "trust" ? "trustBonus" : type === "soft" ? "softSkillsBonus" : "promptScore";
  if (type === "trust" || type === "soft") {
    return [...rows].sort((a, b) => {
      const bm = Number(b?.[metric]) || 0;
      const am = Number(a?.[metric]) || 0;
      const bt = Number(b?.score) || 0;
      const at = Number(a?.score) || 0;
      return bm - am || bt - at || String(a?.team || "").localeCompare(String(b?.team || ""));
    });
  }
  return [...rows].sort((a, b) => {
    const bm = Number(b?.[metric]) || 0;
    const am = Number(a?.[metric]) || 0;
    const bp = Number(b?.averagePercent) || 0;
    const ap = Number(a?.averagePercent) || 0;
    return bm - am || bp - ap || String(a?.team || "").localeCompare(String(b?.team || ""));
  });
}

function sortedCombined(rows) {
  return [...rows].sort((a, b) => {
    const bs = Number(b?.score) || 0;
    const as = Number(a?.score) || 0;
    const bp = Number(b?.promptScore) || 0;
    const ap = Number(a?.promptScore) || 0;
    return bs - as || bp - ap || String(a?.team || "").localeCompare(String(b?.team || ""));
  });
}

function revealSlice(rows, startedAt, now) {
  if (!rows.length) return [];
  const elapsed = Math.max(0, now - startedAt);
  const stepMs = RESULTS_REVEAL_MS / rows.length;
  const count = Math.min(rows.length, Math.max(1, Math.floor(elapsed / stepMs) + 1));
  const revealFrom = Math.max(0, rows.length - count);
  return rows.map((row, idx) => (idx < revealFrom ? { ...row, ghost: true } : row));
}

function boardViewModel(session, label, now = Date.now()) {
  const reveal = activeReveal(session, now);
  if (reveal) {
    const revealRows = revealSlice(sortedForReveal(session?.leaderboard || [], reveal.type), reveal.at, now);
    return {
      label,
      sessionName: sessionLabel(label),
      mode: "reveal",
      reveal,
      rows: revealRows,
      secondsLeft: Math.max(0, Math.ceil((reveal.at + RESULTS_REVEAL_MS - now) / 1000)),
    };
  }

  const adding = recentRevealForAdd(session, now);
  const progress = adding ? Math.max(0, Math.min(1, (now - (adding.at + RESULTS_REVEAL_MS)) / COMBINED_ADD_MS)) : 1;
  const rowsRaw = [...(session?.leaderboard || [])];
  const rows = !adding || progress >= 1
    ? sortedCombined(rowsRaw)
    : [...rowsRaw].sort((a, b) => {
        const addA = adding.type === "trust" ? a.trustBonus : adding.type === "soft" ? a.softSkillsBonus : a.promptScore;
        const addB = adding.type === "trust" ? b.trustBonus : adding.type === "soft" ? b.softSkillsBonus : b.promptScore;
        const baseA = a.score - addA;
        const baseB = b.score - addB;
        return baseB - baseA || b.score - a.score;
      });
  return {
    label,
    sessionName: sessionLabel(label),
    mode: "combined",
    adding,
    rows,
    progress,
  };
}

function rowScore(row, vm) {
  if (row.ghost) return "";
  if (vm.mode === "reveal") {
    return vm.reveal.type === "trust" ? row.trustBonus : vm.reveal.type === "soft" ? row.softSkillsBonus : row.promptScore;
  }

  if (!vm.adding) return row.score;
  const addValue = vm.adding.type === "trust" ? row.trustBonus : vm.adding.type === "soft" ? row.softSkillsBonus : row.promptScore;
  const baseValue = row.score - addValue;
  return Math.round(baseValue + addValue * vm.progress);
}

function rankRowsMarkup(vm) {
  return vm.rows
    .map((row, idx) => {
      const score = rowScore(row, vm);
      const rank = idx + 1;
      const topClass = rank === 1 && !row.ghost ? " is-top" : "";
      const delay = Math.min(360, (vm.rows.length - idx - 1) * 95);
      const numericScore = Number(score);
      const scoreKey = `${vm.sessionName}-${vm.mode === "reveal" ? vm.reveal.type : "combined"}-${row.team || "ghost"}`;
      const scoreAttrs =
        !row.ghost && Number.isFinite(numericScore)
          ? ` data-score-key="${scoreKey}" data-score-target="${numericScore}"`
          : "";
      const ghostClass = row.ghost ? " is-ghost" : "";
      const rowKey = row.team || `ghost-${idx}`;
      return `<article class="lb-rank-row${topClass}${ghostClass}" data-row-key="${rowKey}" style="--row-delay:${delay}ms">
        <span class="lb-rank-number">${rank}</span>
        ${row.ghost
          ? '<span class="lb-team-icon lb-team-icon-ghost" aria-hidden="true"></span>'
          : `<img class="lb-team-icon" src="${teamIconPath(vm.label, row.team)}" alt="${row.team.toUpperCase()} team" />`}
        <div class="lb-score-block">
          <span class="lb-score-divider" aria-hidden="true"></span>
          <strong${scoreAttrs}>${score}</strong>
        </div>
      </article>`;
    })
    .join("");
}

function panelCopy(vm) {
  if (vm.mode === "reveal") {
    return vm.reveal.type === "trust"
      ? "Trust Who points"
      : vm.reveal.type === "soft"
        ? "Soft Skills Significance points"
        : "Prompt points";
  }
  return "Total points";
}

function sessionColumnMarkup(vm) {
  return `<section class="lb-session-column">
    <h2>${vm.sessionName}</h2>
    <p>${panelCopy(vm)}</p>
    <div class="lb-rank-list">
      ${rankRowsMarkup(vm)}
    </div>
  </section>`;
}

function displayTitle(vmA, vmB) {
  const modes = [vmA?.mode, vmB?.mode];
  if (modes.includes("reveal")) {
    const reveal = vmA.mode === "reveal" ? vmA.reveal : vmB.reveal;
    return reveal.type === "trust"
      ? "Trust Who Results"
      : reveal.type === "soft"
        ? "Soft Skills Significance Results"
        : "Prompt Like a Pro Results";
  }
  return "Leaderboard";
}

function titleCardClass(title) {
  return String(title || "").length > 24 ? "lb-title-card lb-title-card-long" : "lb-title-card";
}

function dualLayoutMarkup(vmA, vmB, title, animate = false) {
  return `<div class="lb-main-grid${animate ? " lb-animate-in" : ""}">
    <aside class="${titleCardClass(title)}">${title}</aside>
    <section class="lb-session-grid">
      ${sessionColumnMarkup(vmA)}
      ${sessionColumnMarkup(vmB)}
    </section>
  </div>`;
}

function singleLayoutMarkup(vm, title, animate = false) {
  return `<div class="lb-main-grid lb-main-grid-single${animate ? " lb-animate-in" : ""}">
    <aside class="${titleCardClass(title)}">${title}</aside>
    <section class="lb-session-grid lb-session-grid-single">
      ${sessionColumnMarkup(vm)}
    </section>
  </div>`;
}

async function fetchState() {
  const mode = modeFromQuery();

  try {
    if (mode === "BOTH") {
      const res = await fetch("/api/sessions-state");
      const data = await res.json();
      const groupA = data.sessions?.A || {};
      const groupB = data.sessions?.B || {};
      const vmA = boardViewModel(groupA, "A", data.serverTime || Date.now());
      const vmB = boardViewModel(groupB, "B", data.serverTime || Date.now());
      const revealA = vmA.mode === "reveal";
      const revealB = vmB.mode === "reveal";
      const showHijack = revealA || revealB;
      const hijackVm =
        revealA && revealB
          ? (vmA.reveal.at >= vmB.reveal.at ? vmA : vmB)
          : revealA
            ? vmA
            : vmB;
      const heading = showHijack
        ? (hijackVm.reveal.type === "trust"
            ? "Trust Who Results"
            : hijackVm.reveal.type === "soft"
              ? "Soft Skills Significance Results"
              : "Prompt Like a Pro Results")
        : "Leaderboard";

      titleEl.textContent = heading;
      if (showHijack) {
        copyEl.textContent = `Showing ${hijackVm.sessionName} game results. Leaderboard update in ${hijackVm.secondsLeft}s.`;
        const nextLayout = "single";
        const nextMode = `single-${hijackVm.reveal.type}`;
        const animate = lastBothLayout !== nextLayout;
        const html = singleLayoutMarkup(hijackVm, heading, animate);
        const signature = `${heading}|${html}`;
        mountBoardHtml(html, signature, nextMode);
        lastBothLayout = "single";
      } else {
        const addingVm = vmA.adding ? vmA : vmB.adding ? vmB : null;
        copyEl.textContent = addingVm
          ? `Adding ${addingVm.adding.type === "trust" ? "Trust Who" : addingVm.adding.type === "soft" ? "Soft Skills Significance" : "Prompt Like a Pro"} points to leaderboard...`
          : "Dual session leaderboard.";
        const nextLayout = "dual";
        const nextMode = addingVm ? `dual-add-${addingVm.adding.type}` : "dual-combined";
        const animate = lastBothLayout !== nextLayout;
        const html = dualLayoutMarkup(vmA, vmB, heading, animate);
        const signature = `${heading}|${html}`;
        const push = lastRenderMode.startsWith("single-") && nextMode.startsWith("dual");
        mountBoardHtml(html, signature, nextMode, { push });
        lastBothLayout = "dual";
      }
      return;
    }

    if (mode === "SINGLE") {
      const res = await fetch("/api/leaderboard/display");
      const data = await res.json();
      const activeSession = String(data.latestSession || "A").toUpperCase() === "B" ? "B" : "A";
      const vm = boardViewModel(data.session || {}, activeSession, data.serverTime || Date.now());
      const heading = vm.mode === "reveal"
        ? vm.reveal.type === "trust"
          ? "Trust Who Results"
          : vm.reveal.type === "soft"
            ? "Soft Skills Significance Results"
            : "Prompt Like a Pro Results"
        : "Leaderboard";

      titleEl.textContent = `${heading} - Group ${activeSession}`;
      copyEl.textContent =
        vm.mode === "reveal"
          ? `Revealing game points. Combined leaderboard in ${vm.secondsLeft}s.`
          : vm.adding
            ? `Adding ${vm.adding.type === "trust" ? "Trust Who" : vm.adding.type === "soft" ? "Soft Skills Significance" : "Prompt Like a Pro"} points to leaderboard...`
            : panelCopy(vm);
      const nextMode =
        vm.mode === "reveal"
          ? `single-${vm.reveal.type}`
          : vm.adding
            ? `single-add-${vm.adding.type}`
            : "single-combined";
      const html = singleLayoutMarkup(vm, heading, false);
      const signature = `${titleEl.textContent}|${html}`;
      const push = /^single-(trust|soft|prompt)$/.test(lastRenderMode) && (nextMode.startsWith("single-add-") || nextMode.startsWith("single-combined"));
      mountBoardHtml(html, signature, nextMode, { push });
      return;
    }

    const res = await fetch(`/api/state?session=${encodeURIComponent(mode)}`);
    const data = await res.json();
    const vm = boardViewModel(data, mode, data.serverTime || Date.now());
    const heading = vm.mode === "reveal"
      ? vm.reveal.type === "trust"
        ? "Trust Who Results"
        : vm.reveal.type === "soft"
          ? "Soft Skills Significance Results"
        : "Prompt Like a Pro Results"
      : "Leaderboard";

    titleEl.textContent = `${heading} - Group ${mode}`;
    copyEl.textContent =
      vm.mode === "reveal"
        ? `Revealing game points. Combined leaderboard in ${vm.secondsLeft}s.`
        : vm.adding
          ? `Adding ${vm.adding.type === "trust" ? "Trust Who" : vm.adding.type === "soft" ? "Soft Skills Significance" : "Prompt Like a Pro"} points to leaderboard...`
          : panelCopy(vm);
    const nextMode =
      vm.mode === "reveal"
        ? `single-${vm.reveal.type}`
        : vm.adding
          ? `single-add-${vm.adding.type}`
          : "single-combined";
    const html = singleLayoutMarkup(vm, heading, false);
    const signature = `${titleEl.textContent}|${html}`;
    const push = /^single-(trust|soft|prompt)$/.test(lastRenderMode) && (nextMode.startsWith("single-add-") || nextMode.startsWith("single-combined"));
    mountBoardHtml(html, signature, nextMode, { push });
  } catch (_err) {
    tableWrap.innerHTML = "<p class='output'>Could not load leaderboard data.</p>";
  }
}

setInterval(fetchState, 1000);
fetchState();
