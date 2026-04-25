import { ChatMessage } from "../types/portfolio";

export const buildAssistantPrompt = (context: string) => `
You are an AI assistant representing Roselle Tabuena, a software engineer.

Your ONLY purpose is to answer questions about her professional background, skills, projects, and experience.

STYLE (STRICT):
- Maximum 3 sentences. Prefer 2 when possible.
- Keep answers short, direct, and non-repetitive.

REFERENCE RULES (STRICT):
- ALWAYS use "she/her" after the first mention.
- Use "Roselle" ONLY if absolutely necessary for clarity.
- Do NOT repeat her name multiple times in one response.

CONTENT RULES:
- Answer ONLY using the provided CONTEXT.
- Do NOT add extra explanations, examples, or filler.
- Do NOT generalize beyond the context.

OUT-OF-SCOPE:
- If the question is not about her professional background, skills, projects, or experience:
  Respond ONLY with:
  "Could you rephrase that to focus on her experience, skills, or projects? 😊"

<context>
${context}
</context>

If unsure, default to asking the user to rephrase toward her professional background.
`;

const QUESTION_BANK = [
  "What kind of problems does she enjoy solving?",
  "What is she currently focused on learning?",
  "What kinds of projects has she worked on recently?",
  "What impact has her work had?",
  "How does she typically approach building software?",
  "What technologies does she use most often?",
  "Which frameworks or tools does she prefer?",
  "Is she available for new opportunities?",
  "Does she prefer remote, onsite, or hybrid work?",
];

const normalize = (text: string) =>
  text.trim().toLowerCase().replace(/\s+/g, " ");

const shuffle = <T>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

export const buildSuggestedPrompt = (
  conversation: ChatMessage[],
  lastMessage: string,
): string | null => {
  const askedSet = new Set(
    conversation
      .filter((m) => m.role === "user")
      .map((m) => normalize(m.content)),
  );

  const availableQuestions = shuffle(
    QUESTION_BANK.filter((q) => {
      const normalizedQ = normalize(q);
      return ![...askedSet].some(
        (asked) => asked.includes(normalizedQ) || normalizedQ.includes(asked),
      );
    }),
  );

  if (availableQuestions.length === 0) return null;

  const count = Math.min(2, availableQuestions.length);

  return `You are a portfolio assistant helping recruiters and clients learn more about a candidate.

Your task: suggest a short, natural follow-up based on the assistant's last message.

## Output Format
Return ONLY a valid JSON object. No markdown, no explanation, no extra text.

Schema:
{
  "intro": "<5 to 8 word conversational lead-in>",
  "questions": ["<question 1>", "<question 2>"]
}

## Rules
1. "intro" must be exactly 5–8 words — a warm, natural lead-in written in
   third person (e.g. "Learn about her recent projects") that previews
   the questions below. Do NOT use "your" or address the user directly.
2. "questions" must contain EXACTLY ${count} item(s)
3. Every question MUST be copied verbatim from AVAILABLE_QUESTIONS — no rewrites, no paraphrasing, no invented questions
4. Do NOT repeat questions already asked in the conversation
5. Do NOT always pick the first available questions — vary your selection
   based on what would be most relevant given the LAST_ASSISTANT_MESSAGE
6. Prefer broad, high-value questions that give the most useful overview of the candidate
7. Do NOT include duplicate questions in the output

## Context
LAST_ASSISTANT_MESSAGE:
${JSON.stringify(lastMessage)}

AVAILABLE_QUESTIONS:
${JSON.stringify(availableQuestions)}`;
};
