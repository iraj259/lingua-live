import { generateResponse, MODELS } from "../lib/groq.js";
import { type ScenarioContext } from "../lib/ws-types.js";
import { logger } from "../lib/logger.js";

/**
 * ScenarioAgent
 *
 * Takes a user's practice request (e.g. "ordering coffee at a café")
 * and generates a complete roleplay context: persona, setting, system
 * prompt, and opening message in the target language.
 *
 * Phase 2: First agent. Plain class, no base class yet.
 * Phase 4: BaseAgent extracted when we have 3 agents with shared setup.
 */
export class ScenarioAgent {
  async generate(
    scenarioRequest: string,
    language: string,
    level: string
  ): Promise<ScenarioContext> {
    const langLabel  = capitalize(language);
    const levelLabel = level;

    const prompt = `You are a language learning scenario designer.

Create a realistic roleplay scenario for a ${levelLabel} ${langLabel} student.
The student wants to practice: "${scenarioRequest}"

Return ONLY a valid JSON object — no markdown, no code fences, no extra text.
The JSON must match this exact structure:
{
  "personaName": "a realistic local name for the character",
  "personaRole": "their job or role in 3-5 words",
  "setting": "specific location description in 1 sentence",
  "systemPrompt": "detailed instructions for how the AI should behave (3-5 sentences)",
  "openingMessage": "the first thing the character says to start the conversation (in ${langLabel}, appropriate for ${levelLabel} level)"
}

Rules for systemPrompt:
- Written in English (it's instructions for the AI)
- Tells the AI to speak primarily in ${langLabel}
- Matches difficulty to ${levelLabel} level:
  ${level === "beginner" ? "- Simple sentences, slow pacing, repeat key vocabulary, always model corrections gently" : ""}
  ${level === "intermediate" ? "- Natural sentences, introduce idioms briefly, correct errors inline without breaking flow" : ""}
  ${level === "advanced" ? "- Native speed and complexity, correct only in ${langLabel}, engage with nuance" : ""}
- Defines the character's personality (friendly, formal, busy, etc.)
- Tells the AI to ask natural follow-up questions to keep the student talking

Rules for openingMessage:
- Must be in ${langLabel}
- Must feel natural and in-character
- Must be appropriate for ${levelLabel} level (simple for beginner, natural for advanced)
- Should invite the student to respond`;

    try {
      const raw = await generateResponse(
        [{ role: "user", content: prompt }],
        {
          model:       MODELS.FAST,
          temperature: 0.8,  // slight creativity for varied personas
          maxTokens:   800,
        }
      );

      // Strip any accidental markdown fences if the model adds them
      const cleaned = raw
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      const parsed = JSON.parse(cleaned) as ScenarioContext;

      // Validate the required fields exist
      if (
        !parsed.personaName ||
        !parsed.personaRole ||
        !parsed.setting ||
        !parsed.systemPrompt ||
        !parsed.openingMessage
      ) {
        throw new Error("Missing required fields in scenario response");
      }

      logger.info("Scenario generated", {
        persona: parsed.personaName,
        role:    parsed.personaRole,
        language,
        level,
      });

      return parsed;
    } catch (err) {
      logger.warn("ScenarioAgent parse failed, using fallback", { err });

      // Fallback scenario — never leave the user with a broken experience
      return this.fallback(language, langLabel, level);
    }
  }

  private fallback(language: string, langLabel: string, level: string): ScenarioContext {
    const fallbacks: Record<string, ScenarioContext> = {
      spanish: {
        personaName:    "María",
        personaRole:    "Café Barista",
        setting:        "A warm café on a sunny street in Madrid",
        systemPrompt:   `You are María, a friendly and patient café barista in Madrid. Speak primarily in Spanish at a ${level} level. Be warm and welcoming. Gently correct grammar mistakes by using the correct form naturally in your response. Ask follow-up questions to keep the conversation going.`,
        openingMessage: "¡Buenos días! Bienvenido a nuestro café. ¿Qué le puedo ofrecer hoy?",
      },
      french: {
        personaName:    "Pierre",
        personaRole:    "Boulangerie Owner",
        setting:        "A traditional boulangerie in Paris",
        systemPrompt:   `You are Pierre, the owner of a traditional Parisian boulangerie. Speak primarily in French at a ${level} level. Be charming and slightly formal. Correct mistakes gently by using the correct form in your own sentences. Ask questions to encourage practice.`,
        openingMessage: "Bonjour ! Bienvenue dans ma boulangerie. Qu'est-ce que je peux faire pour vous ?",
      },
      german: {
        personaName:    "Klaus",
        personaRole:    "Hotel Receptionist",
        setting:        "A modern hotel in Berlin",
        systemPrompt:   `You are Klaus, a professional hotel receptionist in Berlin. Speak primarily in German at a ${level} level. Be efficient and polite. Correct mistakes naturally within your responses. Help the student practice formal German.`,
        openingMessage: "Guten Tag! Willkommen im Hotel Berlin. Wie kann ich Ihnen helfen?",
      },
    };

    return fallbacks[language] ?? {
      personaName:    "Alex",
      personaRole:    "Local Guide",
      setting:        `A typical location in a ${langLabel}-speaking area`,
      systemPrompt:   `You are Alex, a friendly local guide. Speak primarily in ${langLabel} at a ${level} level. Be helpful and encouraging. Gently correct mistakes. Ask questions to keep the student engaged.`,
      openingMessage: `Hello! I'm here to help you practice ${langLabel}. What would you like to talk about today?`,
    };
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}