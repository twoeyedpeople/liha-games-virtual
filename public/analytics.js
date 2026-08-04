(function () {
  const CONSENT_KEY = "lihaCookieConsent";
  const SESSION_KEY = "lihaAnalyticsSessionId";
  const DEMOGRAPHICS_KEY = "lihaAnalyticsDemographics";
  const COMPLETED_KEY = "lihaAnalyticsCompletedModules";

  function hasConsent() {
    try {
      return window.localStorage.getItem(CONSENT_KEY) === "accepted";
    } catch (_) {
      return false;
    }
  }

  function uuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function readJson(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
      // Analytics should never block the page.
    }
  }

  function getSessionId() {
    try {
      const existing = window.localStorage.getItem(SESSION_KEY);
      if (existing) return existing;
      const next = uuid();
      window.localStorage.setItem(SESSION_KEY, next);
      return next;
    } catch (_) {
      return uuid();
    }
  }

  // No cookie consent yet (or it was rejected): stay fully inert. Nothing is
  // written to storage and nothing is sent to the server until enable() runs.
  let enabled = false;
  let sessionId = null;
  let demographics = {};
  let completedModules = new Set();

  function send(payload) {
    if (!enabled) return;
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      try {
        const blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon("/api/analytics/event", blob)) return;
      } catch (_) {
        // Fall back to fetch below.
      }
    }

    fetch("/api/analytics/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }

  function eventPayload(moduleName, eventType, eventDetail, companyOverride) {
    return {
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      module_name: String(moduleName || ""),
      event_type: String(eventType || ""),
      event_detail: String(eventDetail || ""),
      country: String(demographics.country || ""),
      region: String(demographics.region || ""),
      company: String(companyOverride || demographics.company || ""),
      modules_completed_count: completedModules.size,
    };
  }

  function enable() {
    if (enabled) return;
    enabled = true;
    sessionId = getSessionId();
    demographics = readJson(DEMOGRAPHICS_KEY, {});
    completedModules = new Set(readJson(COMPLETED_KEY, []));
    window.Analytics.sessionId = sessionId;
  }

  window.Analytics = {
    sessionId,
    enable,
    setDemographics(country, region, company) {
      if (!enabled) return;
      if (country !== null && typeof country !== "undefined") demographics.country = String(country || "");
      if (region !== null && typeof region !== "undefined") demographics.region = String(region || "");
      if (company !== null && typeof company !== "undefined") demographics.company = String(company || "");
      writeJson(DEMOGRAPHICS_KEY, demographics);
    },
    logEvent(moduleName, eventType, eventDetail, companyOverride) {
      if (!enabled || !eventType) return;
      send(eventPayload(moduleName, eventType, eventDetail, companyOverride));
    },
    markModuleComplete(moduleName) {
      if (!enabled) return;
      const safeModuleName = String(moduleName || "").trim();
      if (safeModuleName) {
        completedModules.add(safeModuleName);
        writeJson(COMPLETED_KEY, Array.from(completedModules));
      }
      send(eventPayload(safeModuleName, "module_complete", ""));
    },
    dropOff(moduleName, eventDetail) {
      if (!enabled) return;
      send(eventPayload(moduleName, "drop_off", eventDetail));
    },
  };

  if (hasConsent()) enable();
})();
