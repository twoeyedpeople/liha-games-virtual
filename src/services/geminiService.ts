import { GoogleGenAI } from "@google/genai";
import { ANALYSIS_SCHEMA, JobRole } from "../constants";

export async function analyzePrompt(role: JobRole, prompt: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  const systemInstruction = `
    You are a professional HR assistant and prompt engineering expert. 
    Your task is to analyze a candidate search prompt based on a specific Job Description (JD).
    
    JOB DESCRIPTION:
    ${role.baseJobDescription}
    
    CRITERIA TO ANALYZE:
    ${role.criteria.map(c => `- ${c.title}: ${c.requirements.join(", ")}. Guide: ${c.feedbackGuide}`).join("\n")}
    
    STRICT CHECKLIST VERIFICATION (DO NOT HALLUCINATE):
    You must verify if the *User's Prompt* EXPLICITLY contains the following details. 
    If the text is not explicitly written in the prompt, you MUST mark it as 'present: false'. 
    DO NOT infer or assume defaults (e.g., do not assume employment type if it's not written).
    RELEVANCE RULE: Only mark an item as present if it is relevant to this exact JOB DESCRIPTION.
    If content appears generic or for a different role/domain, mark it as false.
    
    1. ROLE DETAILS (5 items):
       - Employment Type: Must explicitly say role type such as "Full-time", "Part-time", "Contract", "Freelance", etc. If omitted, mark FALSE.
       - Role Title: Must explicitly state the job title.
       - Location: Must explicitly name a city, region, or country (e.g., "Sydney", "Canberra"). If omitted, mark FALSE.
       - Seniority: Must explicitly say "Senior", "Junior", "Lead", "Mid-level", or imply it via years of experience (e.g. "3-6 years").
       - Hybrid/Onsite/Remote: Must explicitly state the work mode (e.g. "Hybrid", "Onsite", "Remote"). If omitted, mark FALSE.
    
    2. CONTEXT (4 items):
       - Experience: Must explicitly state years of experience or specific level.
       - Critical Skills: Must list specific hard skills relevant to the role.
       - Certifications: Must explicitly mention required degrees or certifications.
       - Expected Knowledge: Must mention domain/task/tool knowledge. Treat explicit "experience in ..." or "experience with ..." (tasks, methods, tools, frameworks) as present.
       
    3. RESPONSIBILITIES (2 items):
       - Responsibility 1: Must detail a core responsibility.
       - Responsibility 2: Must detail a second, distinct core responsibility.
    
    CONSTRAINTS:
    1. Return a "checklist" for each metric with the items listed above and a boolean "present" status (used for internal scoring).
    2. Comments for each metric MUST be constructive and educational:
       - DO NOT list what is already present.
       - If items are missing, suggest ADDING them and explain briefly why (e.g., "Add employment type to clarify commitment level.").
       - If all items are present, compliment the specific detail or suggest a way to make it even better.
       - Max length: 120 characters.
    3. The overall comment MUST be specific and actionable, summarizing the key missing areas or strengths. Max length: 160 characters.
    4. TONE: Be professional and direct. Do not add praise when core requirements are missing.
    5. PROHIBITED WORDS: Do NOT use the words "points", "score", or "scoring".
    6. If the prompt is weak/misaligned, explicitly say it is not usable yet and what must be added.
    
    SCORING CALCULATION:
    - Total items = 5 (Role) + 4 (Context) + 2 (Responsibilities) = 11 items.
    - Calculate totalScore = (Number of present items / 11) * 100.
    - Round to the nearest integer. MUST be an integer, no decimals.
    
    VERBATIM CHECK:
    If the prompt is a copy-paste of the JD, mark items as present but strictly limit the overall comment to suggest adding more unique value.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-lite",
    contents: [{ parts: [{ text: `Analyze this candidate search prompt: "${prompt}"` }] }],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: ANALYSIS_SCHEMA as any,
    },
  });

  return JSON.parse(response.text);
}
