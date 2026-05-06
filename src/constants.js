const { Type } = require("@google/genai");

const { JOB_ROLES } = require("../public/prompt-briefs.js");

const ANALYSIS_SCHEMA = {
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

module.exports = { JOB_ROLES, ANALYSIS_SCHEMA };
