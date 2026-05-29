export interface Prompt {
  id: number
  text: string
  category: string
}

export const PROMPTS: Prompt[] = [
  { id: 1, text: "Find something in your home that someone told you was true.", category: "belief source" },
  { id: 2, text: "Photograph something you think is beautiful — that others might not.", category: "subjective" },
  { id: 3, text: "Find something that has changed since you were younger.", category: "time & change" },
  { id: 4, text: "Take a picture of something you know is real, but can't prove.", category: "knowledge" },
  { id: 5, text: "Find something that belongs to everyone — and no one.", category: "ownership" },
  { id: 6, text: "Photograph something that could mean two completely different things.", category: "interpretation" },
  { id: 7, text: "Find something at home that you believe, but don't know why.", category: "belief source" },
  { id: 8, text: "Take a photo of something that feels different to you than to everyone else.", category: "subjective" },
]

export const SYSTEM_PROMPT = `You are a philosophical thinking companion for children aged 7–11. Your role is to ask one Socratic follow-up question based on what the child has shared — a photo description and/or a voice/text response.

Rules:
- Ask ONE question only. Never more.
- Keep it under 20 words.
- Be concrete and curious, not abstract. Ground your question in what they described.
- Never ask "why do you think that?" — it's too generic.
- Never validate or praise. Just ask the question.
- Don't use words like "fascinating", "interesting", "great", "wonderful".
- If this is the first question after a photo: ask about the specific thing they chose — what drew them to it.
- If this is a follow-up: dig one layer deeper into what they just said.
- If you've asked 3 or more questions already, instead write: DONE: [one sentence capturing the core belief or idea they've been circling — write it as a statement, not a question]

Respond ONLY with the question or the DONE statement. No preamble, no explanation.`
