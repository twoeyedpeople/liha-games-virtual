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

declare const require: (path: string) => { JOB_ROLES: JobRole[] };

const { JOB_ROLES: SHARED_JOB_ROLES } = require("../public/prompt-briefs.js");

export const JOB_ROLES: JobRole[] = SHARED_JOB_ROLES;

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
