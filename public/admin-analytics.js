let leadChartInstance = null;
let funnelChartInstance = null;

async function loadData() {
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;
  const country = document.getElementById("country").value;
  
  const query = new URLSearchParams({ startDate, endDate, country }).toString();
  const res = await fetch(`/api/analytics/data?${query}`);
  const { events } = await res.json();
  
  // 1. Top Level Metrics
  const sessions = new Set(events.map(e => e.session_id)).size;
  const leads = events.filter(e => e.event_type === "sales_cta_click").length;
  const shares = events.filter(e => e.event_type === "advocacy_share").length;
  const certs = events.filter(e => e.event_type === "pdf_download" && String(e.event_detail).includes("Certificate")).length;
  const totalCompletions = events.filter(e => e.event_type === "module_complete").length;
  
  const advocacyRate = certs > 0 ? Math.round((shares / certs) * 100) : 0;
  const avgCompletions = sessions > 0 ? (totalCompletions / sessions).toFixed(1) : "0.0";
  
  document.getElementById("totalSessions").textContent = sessions;
  document.getElementById("totalLeads").textContent = leads;
  document.getElementById("advocacyRate").textContent = `${advocacyRate}%`;
  document.getElementById("avgModules").textContent = avgCompletions;
  
  // 2. Lead Quality Chart (Modules Completed before CTA click)
  const leadQualities = { "0 Modules": 0, "1 Module": 0, "2 Modules": 0, "3+ Modules": 0 };
  events.filter(e => e.event_type === "sales_cta_click").forEach(e => {
    const count = Number(e.modules_completed_count) || 0;
    if (count === 0) leadQualities["0 Modules"]++;
    else if (count === 1) leadQualities["1 Module"]++;
    else if (count === 2) leadQualities["2 Modules"]++;
    else leadQualities["3+ Modules"]++;
  });
  
  if (leadChartInstance) leadChartInstance.destroy();
  const leadCtx = document.getElementById('leadQualityChart').getContext('2d');
  leadChartInstance = new Chart(leadCtx, {
    type: 'pie',
    data: {
      labels: Object.keys(leadQualities),
      datasets: [{
        data: Object.values(leadQualities),
        backgroundColor: ['#e9e9e9', '#70b5f9', '#0a66c2', '#057642']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'right' } }
    }
  });

  // 3. Content Effectiveness Funnel (Starts vs Completions)
  const moduleHealth = {};
  events.forEach(e => {
    if (!e.module_name) return;
    if (!moduleHealth[e.module_name]) moduleHealth[e.module_name] = { starts: 0, completions: 0 };
    if (e.event_type === "module_start") moduleHealth[e.module_name].starts++;
    if (e.event_type === "module_complete") moduleHealth[e.module_name].completions++;
  });

  const moduleNames = Object.keys(moduleHealth);
  const startData = moduleNames.map(m => moduleHealth[m].starts);
  const completeData = moduleNames.map(m => moduleHealth[m].completions);

  if (funnelChartInstance) funnelChartInstance.destroy();
  const funnelCtx = document.getElementById('funnelHealthChart').getContext('2d');
  funnelChartInstance = new Chart(funnelCtx, {
    type: 'bar',
    data: {
      labels: moduleNames,
      datasets: [
        { label: 'Starts', data: startData, backgroundColor: '#70b5f9' },
        { label: 'Completions', data: completeData, backgroundColor: '#057642' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } }
    }
  });

  // 4. Geography Breakdown Table
  const geoStats = {};
  events.forEach(e => {
    const c = e.country || "Unknown";
    if (!geoStats[c]) geoStats[c] = { sessions: new Set(), leads: 0 };
    geoStats[c].sessions.add(e.session_id);
    if (e.event_type === "sales_cta_click") geoStats[c].leads++;
  });

  const tbody = document.querySelector("#geoTable tbody");
  tbody.innerHTML = "";
  
  Object.keys(geoStats).sort((a,b) => geoStats[b].leads - geoStats[a].leads).forEach(c => {
    const sCount = geoStats[c].sessions.size;
    const lCount = geoStats[c].leads;
    const rate = sCount > 0 ? ((lCount / sCount) * 100).toFixed(1) + "%" : "0%";
    
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${c}</td><td>${sCount}</td><td>${lCount}</td><td>${rate}</td>`;
    tbody.appendChild(tr);
  });
  // 5. Individual User Deep Dive (Recent Leads)
  const journeyTbody = document.querySelector("#journeyTable tbody");
  journeyTbody.innerHTML = "";
  
  // Find sessions that converted
  const convertedSessions = Array.from(new Set(events.filter(e => e.event_type === "sales_cta_click").map(e => e.session_id)));
  
  // Take up to the 10 most recent
  const recentConversions = convertedSessions.slice(-10).reverse();
  
  recentConversions.forEach(sid => {
    const sEvents = events.filter(e => e.session_id === sid).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    if (sEvents.length === 0) return;
    
    const company = sEvents[0].company || "Unknown Company";
    const startEvent = sEvents[0];
    const convertEvent = sEvents.find(e => e.event_type === "sales_cta_click");
    
    let timeToConvert = "N/A";
    if (convertEvent) {
      const ms = new Date(convertEvent.timestamp) - new Date(startEvent.timestamp);
      const mins = Math.round(ms / 60000);
      timeToConvert = mins > 0 ? `${mins} mins` : "< 1 min";
    }
    
    const modsCompleted = convertEvent ? convertEvent.modules_completed_count : sEvents[sEvents.length-1].modules_completed_count;
    
    // Build path
    const path = Array.from(new Set(sEvents.map(e => e.module_name))).filter(Boolean);
    const pathHtml = path.map(p => `<span style="display:inline-block; background:#e9e9e9; padding:2px 8px; border-radius:12px; font-size:11px; margin:2px;">${p}</span>`).join(" ➔ ");
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div style="font-weight:bold; color:#0a66c2;">${company}</div>
        <div style="font-size:11px; color:#888;">${sid.substring(0,8)}...</div>
      </td>
      <td>${timeToConvert}</td>
      <td>${modsCompleted}</td>
      <td>${pathHtml}</td>
    `;
    journeyTbody.appendChild(tr);
  });

  // 6. Top Drop-Off Locations
  const dropoffStats = {};
  events.filter(e => e.event_type === "drop_off").forEach(e => {
    const key = `${e.module_name}::${e.event_detail || "Started Module"}`;
    dropoffStats[key] = (dropoffStats[key] || 0) + 1;
  });

  const dropoffTbody = document.querySelector("#dropoffTable tbody");
  if(dropoffTbody) {
    dropoffTbody.innerHTML = "";
    
    Object.keys(dropoffStats)
      .map(k => ({ key: k, count: dropoffStats[k] }))
      .sort((a,b) => b.count - a.count)
      .slice(0, 5)
      .forEach(item => {
        const [mod, detail] = item.key.split("::");
        const tr = document.createElement("tr");
        tr.innerHTML = `<td><span style="font-weight:600; color:#0a66c2;">${mod}</span></td><td>${detail}</td><td><span style="color:#e16715; font-weight:bold;">${item.count}</span></td>`;
        dropoffTbody.appendChild(tr);
      });
  }
}

document.getElementById("applyFilters").addEventListener("click", loadData);

document.getElementById("downloadCsv").addEventListener("click", () => {
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;
  const country = document.getElementById("country").value;
  const query = new URLSearchParams({ startDate, endDate, country }).toString();
  window.open(`/api/analytics/export.csv?${query}`, "_blank");
});

loadData();
