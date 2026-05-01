import { Type } from "@google/genai";

export interface MetricResult {
  id: string;
  title: string;
  checklist: { item: string; present: boolean }[];
  comment: string;
}

export interface AnalysisResult {
  metrics: MetricResult[];
  overallComment: string;
  totalScore: number;
}

export interface JobRole {
  id: string;
  title: string;
  baseJobDescription: string;
  criteria: {
    id: string;
    title: string;
    requirements: string[];
    feedbackGuide: string;
  }[];
}

export const JOB_ROLES: JobRole[] = [
  {
    id: "policy-officer",
    title: "Policy Officer",
    baseJobDescription: "We’re seeking a full-time Policy Officer (Sydney or Canberra, hybrid) to support the development, analysis and delivery of public policy initiatives in a regulated government environment. The role involves researching policy and legislation, drafting briefs and recommendations for senior leaders, coordinating input across internal and external stakeholders, supporting consultations, and assisting with implementation and review. Ideal candidates have a relevant degree, 3–6 years’ experience in government or policy, strong research and writing skills, sound judgement, clear communication, and the ability to collaborate, manage risk and work with attention to detail.",
    criteria: [
      {
        id: "role_details",
        title: "Role Details",
        requirements: ["Employment Type", "Role Title", "Location", "Seniority", "Hybrid/Onsite/Remote"],
        feedbackGuide: "Check for each item."
      },
      {
        id: "context",
        title: "Context",
        requirements: ["Experience", "Critical Skills", "Certifications", "Expected Knowledge"],
        feedbackGuide: "Check for each item."
      },
      {
        id: "responsibilities",
        title: "Responsibilities",
        requirements: ["Responsibility 1", "Responsibility 2"],
        feedbackGuide: "Check for at least 2 distinct responsibilities."
      }
    ]
  },
  {
    id: "business-analyst",
    title: "Business Analyst",
    baseJobDescription: "We’re seeking an experienced Business Analyst (Sydney, hybrid) to work with stakeholders to identify needs, define requirements and support the delivery of effective solutions by translating business problems into clear, actionable insights. The role is full-time and involves gathering and documenting requirements, mapping current and future-state processes, collaborating with technical and delivery teams, facilitating workshops, and producing insights and recommendations to inform decision-making. Ideal candidates have a relevant degree, 4–7 years’ experience in business analysis or consulting, strong analytical and communication skills, the ability to simplify complexity, and experience with requirements documentation, data analysis, and Agile or similar delivery frameworks.",
    criteria: [
      {
        id: "role_details",
        title: "Role Details",
        requirements: ["Employment Type", "Role Title", "Location", "Seniority", "Hybrid/Onsite/Remote"],
        feedbackGuide: "Check for each item."
      },
      {
        id: "context",
        title: "Context",
        requirements: ["Experience", "Critical Skills", "Certifications", "Expected Knowledge"],
        feedbackGuide: "Check for each item."
      },
      {
        id: "responsibilities",
        title: "Responsibilities",
        requirements: ["Responsibility 1", "Responsibility 2"],
        feedbackGuide: "Check for at least 2 distinct responsibilities."
      }
    ]
  },
  {
    id: "customer-service-representative",
    title: "Customer Service Representative",
    baseJobDescription: "We’re seeking a Customer Service Representative (Sydney, on-site, shift-based) to support customers in a fast-paced, high-volume environment, delivering timely, accurate and empathetic service while meeting quality and performance targets. The part-time role involves handling enquiries via phone, chat and email, resolving issues efficiently, escalating complex cases, maintaining accurate customer records, and achieving service and satisfaction goals. Ideal candidates have 1–3 years’ customer-facing experience, strong communication and problem-solving skills, resilience under pressure, attention to detail, and familiarity with CRM or ticketing systems, along with relevant certifications such as ITIL Foundation, a customer service/contact centre certification or product/platform certifications where applicable.",
    criteria: [
      {
        id: "role_details",
        title: "Role Details",
        requirements: ["Employment Type", "Role Title", "Location", "Seniority", "Hybrid/Onsite/Remote"],
        feedbackGuide: "Check for each item."
      },
      {
        id: "context",
        title: "Context",
        requirements: ["Experience", "Critical Skills", "Certifications", "Expected Knowledge"],
        feedbackGuide: "Check for each item."
      },
      {
        id: "responsibilities",
        title: "Responsibilities",
        requirements: ["Responsibility 1", "Responsibility 2"],
        feedbackGuide: "Check for at least 2 distinct responsibilities."
      }
    ]
  },
  {
    id: "sg-data-ai-specialist",
    title: "Data / AI Specialist",
    baseJobDescription: "We’re seeking a Data/AI Specialist (Singapore, hybrid) to support the development, analysis, and deployment of data-driven and AI-enabled solutions in a digitally transforming environment. The role involves analysing complex datasets, building models and dashboards, collaborating with cross-functional stakeholders, translating business needs into technical solutions, and supporting implementation and optimisation of data systems. Ideal candidates have a degree in Data Science, Computer Science, Statistics, or a related field, 3–6 years’ experience in analytics, data science, or AI roles, strong programming skills in Python, R, or SQL, experience with visualisation tools such as Tableau or Power BI, strong analytical problem-solving, and the ability to explain technical concepts to non-technical stakeholders.",
    criteria: [
      {
        id: "role_details",
        title: "Role Details",
        requirements: ["Employment Type", "Role Title", "Location", "Seniority", "Hybrid/Onsite/Remote"],
        feedbackGuide: "Check for each item."
      },
      {
        id: "context",
        title: "Context",
        requirements: ["Experience", "Critical Skills", "Certifications", "Expected Knowledge"],
        feedbackGuide: "Check for each item."
      },
      {
        id: "responsibilities",
        title: "Responsibilities",
        requirements: ["Responsibility 1", "Responsibility 2"],
        feedbackGuide: "Check for at least 2 distinct responsibilities."
      }
    ]
  },
  {
    id: "sg-risk-compliance-officer",
    title: "Risk / Compliance Officer",
    baseJobDescription: "We’re seeking a Risk/Compliance Officer (Singapore, hybrid) to support the development, analysis, and delivery of risk and compliance frameworks in a regulated environment. The role involves monitoring regulatory requirements, conducting risk assessments, drafting policies and reports, coordinating with internal and external stakeholders, and assisting with implementation and review of controls. Ideal candidates have a relevant degree in Law, Finance, Business, or a related field, 3–6 years’ experience in compliance, risk management, or internal audit, strong analytical, documentation, and report-writing skills, sound judgement, attention to detail, and the ability to manage risk and stakeholder relationships effectively.",
    criteria: [
      {
        id: "role_details",
        title: "Role Details",
        requirements: ["Employment Type", "Role Title", "Location", "Seniority", "Hybrid/Onsite/Remote"],
        feedbackGuide: "Check for each item."
      },
      {
        id: "context",
        title: "Context",
        requirements: ["Experience", "Critical Skills", "Certifications", "Expected Knowledge"],
        feedbackGuide: "Check for each item."
      },
      {
        id: "responsibilities",
        title: "Responsibilities",
        requirements: ["Responsibility 1", "Responsibility 2"],
        feedbackGuide: "Check for at least 2 distinct responsibilities."
      }
    ]
  },
  {
    id: "sg-business-development-manager",
    title: "Business Development Manager (B2B / Regional)",
    baseJobDescription: "We’re seeking a Business Development Manager (Singapore, hybrid) to support revenue growth and strategic expansion across regional markets in a high-growth commercial environment. The role involves identifying and engaging prospective clients, building and managing pipelines, developing strategic account plans, collaborating with marketing and product teams, and closing complex deals. Ideal candidates have a degree in Business, Marketing, or a related field, 3–7 years’ experience in B2B sales, business development, or account management, strong stakeholder management and negotiation skills, commercial acumen, strategic thinking, and the ability to thrive in a fast-paced, target-driven environment.",
    criteria: [
      {
        id: "role_details",
        title: "Role Details",
        requirements: ["Employment Type", "Role Title", "Location", "Seniority", "Hybrid/Onsite/Remote"],
        feedbackGuide: "Check for each item."
      },
      {
        id: "context",
        title: "Context",
        requirements: ["Experience", "Critical Skills", "Certifications", "Expected Knowledge"],
        feedbackGuide: "Check for each item."
      },
      {
        id: "responsibilities",
        title: "Responsibilities",
        requirements: ["Responsibility 1", "Responsibility 2"],
        feedbackGuide: "Check for at least 2 distinct responsibilities."
      }
    ]
  },
  {
    id: "in-software-engineer",
    title: "Software Engineer",
    baseJobDescription: "We’re seeking a Software Engineer (Tier 1 & 2 cities in India, hybrid or remote) to design, develop, and deliver scalable software solutions in a fast-paced technology environment. The role involves writing high-quality code, collaborating with cross-functional teams, contributing to system architecture, troubleshooting issues, and supporting deployment and performance optimisation. Ideal candidates have a degree in Computer Science, Engineering, or a related field, 2–5 years’ experience in software development, proficiency in Java, Python, or JavaScript, knowledge of agile delivery, and strong problem-solving and collaboration skills.",
    criteria: [
      {
        id: "role_details",
        title: "Role Details",
        requirements: ["Employment Type", "Role Title", "Location", "Seniority", "Hybrid/Onsite/Remote"],
        feedbackGuide: "Check for each item."
      },
      {
        id: "context",
        title: "Context",
        requirements: ["Experience", "Critical Skills", "Certifications", "Expected Knowledge"],
        feedbackGuide: "Check for each item."
      },
      {
        id: "responsibilities",
        title: "Responsibilities",
        requirements: ["Responsibility 1", "Responsibility 2"],
        feedbackGuide: "Check for at least 2 distinct responsibilities."
      }
    ]
  },
  {
    id: "in-business-data-analyst",
    title: "Business / Data Analyst",
    baseJobDescription: "We’re seeking a Business/Data Analyst (Tier 1 & 2 cities in India, hybrid) to support data-driven decision making and business performance optimisation in a dynamic commercial environment. The role involves analysing datasets, building reports and dashboards, identifying trends and insights, collaborating with stakeholders to define requirements, and supporting strategic initiatives. Ideal candidates have a degree in Business, Economics, Statistics, or a related field, 3–6 years’ experience in analytics, business analysis, or consulting, strong SQL, Excel, and data visualisation skills, critical thinking, and the ability to present insights clearly to stakeholders.",
    criteria: [
      {
        id: "role_details",
        title: "Role Details",
        requirements: ["Employment Type", "Role Title", "Location", "Seniority", "Hybrid/Onsite/Remote"],
        feedbackGuide: "Check for each item."
      },
      {
        id: "context",
        title: "Context",
        requirements: ["Experience", "Critical Skills", "Certifications", "Expected Knowledge"],
        feedbackGuide: "Check for each item."
      },
      {
        id: "responsibilities",
        title: "Responsibilities",
        requirements: ["Responsibility 1", "Responsibility 2"],
        feedbackGuide: "Check for at least 2 distinct responsibilities."
      }
    ]
  },
  {
    id: "in-sales-development-representative",
    title: "Sales Development Representative (SDR)",
    baseJobDescription: "We’re seeking a Sales Development Representative (Tier 1 & 2 cities in India, hybrid) to support pipeline generation and revenue growth in a high-growth SaaS environment. The role involves outbound prospecting, qualifying leads, engaging potential customers across channels, collaborating with account executives, and maintaining accurate CRM records. Ideal candidates have a degree in Business, Marketing, or a related field, 1–4 years’ experience in sales, business development, or client-facing roles, strong communication and persuasion skills, resilience, familiarity with CRM tools, and the ability to thrive in a fast-paced team environment.",
    criteria: [
      {
        id: "role_details",
        title: "Role Details",
        requirements: ["Employment Type", "Role Title", "Location", "Seniority", "Hybrid/Onsite/Remote"],
        feedbackGuide: "Check for each item."
      },
      {
        id: "context",
        title: "Context",
        requirements: ["Experience", "Critical Skills", "Certifications", "Expected Knowledge"],
        feedbackGuide: "Check for each item."
      },
      {
        id: "responsibilities",
        title: "Responsibilities",
        requirements: ["Responsibility 1", "Responsibility 2"],
        feedbackGuide: "Check for at least 2 distinct responsibilities."
      }
    ]
  }
];

export const ANALYSIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    metrics: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          checklist: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                item: { type: Type.STRING },
                present: { type: Type.BOOLEAN }
              },
              required: ["item", "present"]
            }
          },
          comment: { type: Type.STRING }
        },
        required: ["id", "title", "checklist", "comment"]
      }
    },
    overallComment: { type: Type.STRING },
    totalScore: { type: Type.NUMBER, description: "A percentage score from 0 to 100" }
  },
  required: ["metrics", "overallComment", "totalScore"]
};
