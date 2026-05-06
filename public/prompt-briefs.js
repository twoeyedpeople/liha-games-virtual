(function () {
const REGION_BRIEFS = {
  australia: {
    label: "Australia",
    briefs: [
      {
        id: "policy-officer",
        title: "Policy Officer",
        subcopy:
          "Location: Sydney or Canberra | Work Arrangement: Hybrid \n\nAbout the Role:\nWe’re seeking a Policy Officer to support the development, analysis, and delivery of public policy initiatives in a regulated government environment. The role is full-time and involves researching policy and legislation, drafting briefs and recommendations for senior leaders, coordinating input across internal and external stakeholders, supporting consultations, and assisting with implementation and review.\n\nKey Responsibilities:\n- Research and analyse policy, legislation, and regulatory developments\n- Draft briefs, reports, and recommendations for senior leadership\n- Coordinate input across internal and external stakeholders\n- Support consultations and engagement processes\n- Assist with implementation and review of policy initiatives\n\nSkills & Qualifications:\n- Relevant degree in Public Policy, Law, Political Science, or related field\n- 3–6 years’ experience in government, policy, or regulatory roles\n- Strong research, analytical, and writing skills\n- Sound judgment and attention to detail\n- Clear and effective communication skills\n- Ability to collaborate with stakeholders, manage risk, and work independently",
      },
      {
        id: "customer-service-representative",
        title: "Customer Service Representative",
        subcopy:
          "Location: Perth | Work Arrangement: On-site, shift-based\n\nAbout the Role:\nWe’re seeking a Customer Service Representative to support customers in a fast-paced, high-volume environment, delivering timely, accurate, and empathetic service while meeting quality and performance targets.\n\nKey Responsibilities:\n- Handle customer enquiries via phone, chat, and email\n- Resolve issues efficiently, escalating complex cases where necessary\n- Maintain accurate customer records and documentation\n- Achieve service and satisfaction targets consistently\n- Contribute to continuous improvement initiatives\n\nSkills & Qualifications:\n- 1–3 years’ experience in a customer-facing role\n- Strong communication and interpersonal skills\n- Effective problem-solving and decision-making ability\n- Resilience under pressure and ability to manage high volumes\n- Attention to detail and accuracy\n- Familiarity with CRM or ticketing systems",
      },
      {
        id: "business-analyst",
        title: "Business Analyst",
        subcopy:
          "Location: Sydney or Melbourne | Work Arrangement: Hybrid\n\nAbout the Role:\nWe’re seeking an experienced Business Analyst to work with stakeholders to identify needs, define requirements, and support the delivery of effective solutions by translating business problems into clear, actionable insights.\n\nKey Responsibilities:\n- Gather, document, and validate business requirements\n- Map current and future-state business processes\n- Collaborate with technical and delivery teams to ensure requirements are met\n- Facilitate workshops and stakeholder discussions\n- Produce insights, recommendations, and reports to inform decision-making\n\nSkills & Qualifications:\n- Relevant degree in Business, IT, Economics, or related field\n- 4–7 years’ experience in business analysis or consulting\n- Strong analytical, problem-solving, and communication skills\n- Ability to simplify complex problems and translate them into actionable requirements\n- Experience with requirements documentation, data analysis, and Agile or similar frameworks\n- Ability to engage effectively with stakeholders at all levels",
      },
    ],
  },
  singapore: {
    label: "Singapore",
    briefs: [
      {
        id: "sg-data-ai-specialist",
        title: "Data / AI Specialist",
        subcopy:
          "Location: Singapore | Work Arrangement: Hybrid\n\nAbout the Role:\nWe’re seeking a Data/AI Specialist to support the development, analysis, and deployment of data-driven and AI-enabled solutions in a digitally transforming environment. The role involves analysing complex datasets, building models and dashboards, collaborating with cross-functional stakeholders, translating business needs into technical solutions, and supporting implementation and optimisation of data systems.\n\nKey Responsibilities:\n- Analyse complex datasets to generate actionable business insights\n- Build predictive models, dashboards, and reports to support decision-making\n- Collaborate with stakeholders across business and technical teams to translate requirements into solutions\n- Support deployment, monitoring, and optimisation of AI and data systems\n- Ensure data quality, governance, and compliance with organisational standards\n\nSkills & Qualifications:\n- Degree in Data Science, Computer Science, Statistics, or related field\n- 3–6 years’ experience in analytics, data science, or AI roles\n- Strong programming skills (Python, R, or SQL)\n- Experience with data visualisation tools (Tableau, Power BI, or equivalent)\n- Strong analytical and problem-solving ability\n- Excellent communication skills, with the ability to explain technical concepts to non-technical stakeholders",
      },
      {
        id: "sg-risk-compliance-officer",
        title: "Risk / Compliance Officer",
        subcopy:
          "Location: Singapore | Work Arrangement: Hybrid\n\nAbout the Role:\nWe’re seeking a Risk/Compliance Officer to support the development, analysis, and delivery of risk and compliance frameworks in a regulated environment. The role involves monitoring regulatory requirements, conducting risk assessments, drafting policies and reports, coordinating with internal and external stakeholders, and assisting with implementation and review of controls.\n\nKey Responsibilities:\n- Monitor and interpret regulatory requirements affecting business operations\n- Conduct risk assessments and internal audits\n- Draft and review policies, procedures, and reports\n- Coordinate with internal teams and external regulators to ensure compliance\n- Support implementation and continuous improvement of risk and compliance controls\n\nSkills & Qualifications:\n- Relevant degree in Law, Finance, Business, or related field\n- 3–6 years’ experience in compliance, risk management, or internal audit\n- Strong analytical, documentation, and report-writing skills\n- Sound judgment and attention to detail\n- Ability to manage risk and stakeholder relationships effectively\n- Excellent communication and collaboration skills",
      },
      {
        id: "sg-business-development-manager",
        title: "Business Development Manager (B2B / Regional)",
        subcopy:
          "Location: Singapore | Work Arrangement: Hybrid\n\nAbout the Role:\nWe’re seeking a Business Development Manager to support revenue growth and strategic expansion across regional markets in a high-growth commercial environment. The role involves identifying and engaging prospective clients, building and managing pipelines, developing strategic account plans, collaborating with marketing and product teams, and closing complex deals.\n\nKey Responsibilities:\n- Identify, qualify, and engage prospective clients in target markets\n- Build and manage a robust sales pipeline\n- Develop and execute strategic account plans for key clients\n- Collaborate with marketing, product, and operations teams to align strategy\n- Negotiate and close complex deals to achieve revenue targets\n\nSkills & Qualifications:\n- Degree in Business, Marketing, or related field\n- 3–7 years’ experience in B2B sales, business development, or account management\n- Strong stakeholder management and negotiation skills\n- Commercial acumen and strategic thinking\n- Ability to work in a fast-paced, target-driven environment\n- Excellent communication and interpersonal skills",
      },
    ],
  },
  india: {
    label: "India",
    briefs: [
      {
        id: "in-software-engineer",
        title: "Software Engineer",
        subcopy:
          "Location: Tier 1 & 2 cities in India (Bengaluru, Hyderabad, Pune, Chennai, Gurugram, Noida) | Work Arrangement: Hybrid or Remote\n\nAbout the Role:\nWe’re seeking a Software Engineer to design, develop, and deliver scalable software solutions in a fast-paced technology environment. The role involves writing high-quality code, collaborating with cross-functional teams, contributing to system architecture, troubleshooting issues, and supporting deployment and performance optimisation.\n\nKey Responsibilities:\n- Develop, test, and maintain software applications\n- Collaborate with product, design, and QA teams to deliver high-quality solutions\n- Contribute to system design and architecture decisions\n- Troubleshoot, debug, and optimise software for performance and scalability\n- Participate in code reviews and ensure coding standards are met\n\nSkills & Qualifications:\n- Degree in Computer Science, Engineering, or related field\n- 2–5 years’ experience in software development\n- Proficiency in programming languages such as Java, Python, or JavaScript\n- Knowledge of software development lifecycle and agile methodologies\n- Strong problem-solving and analytical skills\n- Excellent collaboration and communication skills",
      },
      {
        id: "in-business-data-analyst",
        title: "Business / Data Analyst",
        subcopy:
          "Location: Tier 1 & 2 cities in India (Mumbai, Bengaluru, Hyderabad, Gurugram, Pune, Chennai) | Work Arrangement: Hybrid\n\nAbout the Role:\nWe’re seeking a Business/Data Analyst to support data-driven decision making and business performance optimisation in a dynamic commercial environment. The role involves analysing datasets, building reports and dashboards, identifying trends and insights, collaborating with stakeholders to define requirements, and supporting strategic initiatives.\n\nKey Responsibilities:\n- Analyse business and operational data to identify trends, patterns, and insights\n- Build reports, dashboards, and visualisations to support business decisions\n- Collaborate with stakeholders to understand requirements and translate them into analytical solutions\n- Support strategic initiatives with data-driven recommendations\n- Ensure data accuracy, quality, and consistency\n\nSkills & Qualifications:\n- Degree in Business, Economics, Statistics, or related field\n- 3–6 years’ experience in analytics, business analysis, or consulting\n- Strong SQL, Excel, and data visualisation skills (Power BI, Tableau, etc.)\n- Critical thinking and problem-solving ability\n- Strong communication skills to present insights to business stakeholders\n- Ability to work independently and in cross-functional teams",
      },
      {
        id: "in-sales-development-representative",
        title: "Sales Development Representative (SDR)",
        subcopy:
          "Location: Tier 1 & 2 cities in India (Bengaluru, Pune, Hyderabad, Gurugram, Mumbai, Chennai) | Work Arrangement: Hybrid\n\nAbout the Role:\nWe’re seeking a Sales Development Representative to support pipeline generation and revenue growth in a high-growth SaaS environment. The role involves outbound prospecting, qualifying leads, engaging potential customers across channels, collaborating with account executives, and maintaining accurate CRM records.\n\nKey Responsibilities:\n- Identify and engage prospective clients through outbound outreach\n- Qualify leads and manage sales pipeline in CRM systems\n- Collaborate with account executives to develop strategic sales plans\n- Conduct presentations and demos to potential clients\n- Track and report on sales metrics and pipeline performance\n\nSkills & Qualifications:\n- Degree in Business, Marketing, or related field\n- 1–4 years’ experience in sales, business development, or client-facing roles\n- Strong communication, persuasion, and interpersonal skills\n- Goal-oriented, resilient, and able to thrive in a fast-paced environment\n- Familiarity with CRM tools and sales processes\n- Ability to work independently and as part of a team",
      },
    ],
  },
};

const PROMPT_ROLE_CRITERIA = [
  {
    id: "role_details",
    title: "Role Details",
    requirements: ["Employment Type", "Role Title", "Location", "Seniority", "Hybrid/Onsite/Remote"],
    feedbackGuide: "Check for each item.",
  },
  {
    id: "context",
    title: "Context",
    requirements: ["Experience", "Critical Skills", "Certifications", "Expected Knowledge"],
    feedbackGuide: "Check for each item.",
  },
  {
    id: "responsibilities",
    title: "Responsibilities",
    requirements: ["Responsibility 1", "Responsibility 2"],
    feedbackGuide: "Check for at least 2 distinct responsibilities.",
  },
];

const PROMPT_BRIEF_LIST = Object.values(REGION_BRIEFS).flatMap((region) =>
  region.briefs.map((brief) => ({ ...brief, region: region.label }))
);

const PROMPT_BRIEF_BY_ID = Object.fromEntries(PROMPT_BRIEF_LIST.map((brief) => [brief.id, brief]));

const JOB_ROLES = PROMPT_BRIEF_LIST.map((brief) => ({
  id: brief.id,
  title: brief.title,
  baseJobDescription: brief.subcopy,
  criteria: PROMPT_ROLE_CRITERIA,
}));

const PROMPT_BRIEF_DATA = {
  REGION_BRIEFS,
  PROMPT_BRIEF_LIST,
  PROMPT_BRIEF_BY_ID,
  PROMPT_ROLE_CRITERIA,
  JOB_ROLES,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = PROMPT_BRIEF_DATA;
} else {
  window.PROMPT_BRIEF_DATA = PROMPT_BRIEF_DATA;
}

})();
