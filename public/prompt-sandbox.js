const keyEl = document.getElementById("sandbox-master-key");
const briefEl = document.getElementById("sandbox-brief");
const promptEl = document.getElementById("sandbox-prompt");
const scoreBtn = document.getElementById("sandbox-score-btn");
const errorEl = document.getElementById("sandbox-error");
const summaryEl = document.getElementById("sandbox-summary");
const rawEl = document.getElementById("sandbox-raw");
const briefPreviewEl = document.getElementById("sandbox-brief-preview");

const KEY_STORAGE = "promptArenaMasterKey";
const PROMPT_STORAGE = "promptSandboxPrompt";
const BRIEF_STORAGE = "promptSandboxBrief";
const BRIEF_DETAILS = {
  "business-analyst": {
    name: "Business Analyst",
    subcopy:
      "We’re seeking an experienced Business Analyst (Sydney, hybrid) to work with stakeholders to identify needs, define requirements and support the delivery of effective solutions by translating business problems into clear, actionable insights. The role is full-time and involves gathering and documenting requirements, mapping current and future-state processes, collaborating with technical and delivery teams, facilitating workshops, and producing insights and recommendations to inform decision-making. Ideal candidates have a relevant degree, 4–7 years’ experience in business analysis or consulting, strong analytical and communication skills, the ability to simplify complexity, and experience with requirements documentation, data analysis, and Agile or similar delivery frameworks.",
    goal: "Assess requirement gathering, data interpretation, and stakeholder alignment skills.",
    include: "Include deliverables, acceptance criteria, assumptions, and measurable decision factors.",
    success: "Aim for a structured, testable output your hiring panel can score consistently.",
  },
  "policy-officer": {
    name: "Policy Officer",
    subcopy:
      "We’re seeking a full-time Policy Officer (Sydney or Canberra, hybrid) to support the development, analysis and delivery of public policy initiatives in a regulated government environment. The role involves researching policy and legislation, drafting briefs and recommendations for senior leaders, coordinating input across internal and external stakeholders, supporting consultations, and assisting with implementation and review. Ideal candidates have a relevant degree, 3–6 years’ experience in government or policy, strong research and writing skills, sound judgement, clear communication, and the ability to collaborate, manage risk and work with attention to detail.",
    goal: "Assess candidate fit, stakeholder communication, and policy execution strength.",
    include: "Include output format, evaluation criteria, and clear constraints with measurable outcomes.",
    success: "Aim for a policy-ready framework with clear trade-offs and decision rationale.",
  },
  "customer-service-representative": {
    name: "Customer Service Representative",
    subcopy:
      "We’re seeking a Customer Service Representative (Sydney, on-site, shift-based) to support customers in a fast-paced, high-volume environment, delivering timely, accurate and empathetic service while meeting quality and performance targets. The part-time role involves handling enquiries via phone, chat and email, resolving issues efficiently, escalating complex cases, maintaining accurate customer records, and achieving service and satisfaction goals. Ideal candidates have 1–3 years’ customer-facing experience, strong communication and problem-solving skills, resilience under pressure, attention to detail, and familiarity with CRM or ticketing systems, along with relevant certifications such as ITIL Foundation, a customer service/contact centre certification or product/platform certifications where applicable.",
    goal: "Assess empathy, issue resolution quality, communication clarity, and escalation judgment.",
    include: "Include response templates, quality standards, and edge-case handling expectations.",
    success: "Aim for practical scripts and metrics that improve customer outcomes and consistency.",
  },
};

keyEl.value = sessionStorage.getItem(KEY_STORAGE) || "";
promptEl.value = localStorage.getItem(PROMPT_STORAGE) || "";
briefEl.value = localStorage.getItem(BRIEF_STORAGE) || "policy-officer";

function showError(message = "") {
  errorEl.textContent = message;
}

function renderBriefPreview() {
  if (!briefPreviewEl) return;
  const key = briefEl.value || "policy-officer";
  const brief = BRIEF_DETAILS[key] || BRIEF_DETAILS["policy-officer"];
  briefPreviewEl.innerHTML = `<strong>${brief.name} brief</strong>
  <p class="tiny-note" style="margin:6px 0 0;">${brief.subcopy}</p>
  <p class="tiny-note" style="margin:8px 0 0;"><strong>Goal:</strong> ${brief.goal}</p>
  <p class="tiny-note" style="margin:4px 0 0;"><strong>Include:</strong> ${brief.include}</p>
  <p class="tiny-note" style="margin:4px 0 0;"><strong>Success:</strong> ${brief.success}</p>`;
}

async function scorePrompt() {
  showError("");
  summaryEl.classList.add("hidden");

  const masterKey = keyEl.value.trim();
  const brief = briefEl.value;
  const prompt = promptEl.value;

  if (!masterKey) {
    showError("Master key is required.");
    return;
  }
  if (!prompt.trim()) {
    showError("Prompt is required.");
    return;
  }

  sessionStorage.setItem(KEY_STORAGE, masterKey);
  localStorage.setItem(PROMPT_STORAGE, prompt);
  localStorage.setItem(BRIEF_STORAGE, brief);

  scoreBtn.disabled = true;
  scoreBtn.textContent = "Scoring...";

  try {
    const res = await fetch("/api/master/prompt-sandbox", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-master-key": masterKey,
      },
      body: JSON.stringify({ prompt, brief }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || `Request failed (${res.status})`);
    }

    summaryEl.classList.remove("hidden");
    summaryEl.innerHTML = `<div class="master-section" style="padding:12px 14px;">
      <strong>Role:</strong> ${data.roleTitle} &nbsp; | &nbsp;
      <strong>Engine:</strong> ${data.engine} &nbsp; | &nbsp;
      <strong>Raw:</strong> ${data.rawScore}% &nbsp; | &nbsp;
      <strong>Curved:</strong> ${data.curvedScore}% &nbsp; | &nbsp;
      <strong>Status:</strong> ${data.failed ? `Fail (<${data.passThreshold || 80} raw)` : "Pass"}
    </div>`;

    rawEl.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    showError(err.message || "Could not score prompt.");
  } finally {
    scoreBtn.disabled = false;
    scoreBtn.textContent = "Score Prompt";
  }
}

scoreBtn.addEventListener("click", scorePrompt);
briefEl.addEventListener("change", () => {
  localStorage.setItem(BRIEF_STORAGE, briefEl.value);
  renderBriefPreview();
});
renderBriefPreview();
