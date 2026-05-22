import { db } from "./client.js";
import { users, sessions, messages, feedbackReports, userMemory } from "./schema.js";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";

const DEMO_EMAIL    = "demo@lingua-ai.com";
const DEMO_PASSWORD = "demo1234";
const DEMO_NAME     = "Alex (Demo)";

const SEED_DATA = [
  {
    language:        "spanish" as const,
    level:           "beginner" as const,
    title:           "Ordering coffee at a Madrid café",
    durationSeconds: 420,
    daysAgo:         5,
    grammarScore:    6.5,
    fluencyScore:    5.8,
    vocabScore:      7.0,
    weaknessTags:    ["past_tense", "gender_agreement"],
    messages: [
      { role: "assistant" as const, content: "¡Buenos días! Bienvenido a Café Central. ¿Qué le puedo ofrecer hoy?" },
      { role: "user"      as const, content: "Hola! Quiero un café, por favor." },
      { role: "assistant" as const, content: "¡Por supuesto! ¿Lo quiere solo, con leche, o cortado?" },
      { role: "user"      as const, content: "Un café con leche, gracias. Y también un croissant." },
      { role: "assistant" as const, content: "Perfecto. ¿Para aquí o para llevar?" },
      { role: "user"      as const, content: "Para aquí, por favor. ¿Cuánto es?" },
      { role: "assistant" as const, content: "Son tres euros y cincuenta céntimos. ¡Su español es muy bueno!" },
      { role: "user"      as const, content: "Muchas gracias!" },
    ],
  },
  {
    language:        "french" as const,
    level:           "beginner" as const,
    title:           "Asking for directions in Paris",
    durationSeconds: 380,
    daysAgo:         3,
    grammarScore:    7.0,
    fluencyScore:    6.5,
    vocabScore:      7.5,
    weaknessTags:    ["verb_conjugation", "article_usage"],
    messages: [
      { role: "assistant" as const, content: "Bonjour! Je suis Pierre. Comment puis-je vous aider?" },
      { role: "user"      as const, content: "Bonjour! Je cherche la Tour Eiffel." },
      { role: "assistant" as const, content: "Bien sûr! Prenez le métro ligne 6, descendez à Bir-Hakeim." },
      { role: "user"      as const, content: "Merci! C'est loin d'ici?" },
      { role: "assistant" as const, content: "Non, environ vingt minutes. Bonne visite!" },
      { role: "user"      as const, content: "Merci beaucoup!" },
    ],
  },
  {
    language:        "spanish" as const,
    level:           "intermediate" as const,
    title:           "Job interview practice",
    durationSeconds: 680,
    daysAgo:         1,
    grammarScore:    7.5,
    fluencyScore:    7.0,
    vocabScore:      8.0,
    weaknessTags:    ["subjunctive", "past_tense"],
    messages: [
      { role: "assistant" as const, content: "Buenos días. Cuénteme sobre su experiencia profesional." },
      { role: "user"      as const, content: "Tengo tres años de experiencia como desarrollador de software." },
      { role: "assistant" as const, content: "Excelente. ¿Cuál ha sido su proyecto más desafiante?" },
      { role: "user"      as const, content: "El proyecto más difícil fue migrar una base de datos antigua." },
      { role: "assistant" as const, content: "Muy impresionante. ¿Por qué quiere trabajar con nosotros?" },
      { role: "user"      as const, content: "He investigado su empresa y me impresa su enfoque en innovación." },
      { role: "assistant" as const, content: "Bien dicho. Ha sido una entrevista muy positiva. ¡Buena suerte!" },
    ],
  },
];

async function seed() {
  console.log("🌱 Starting seed...");

  // Remove existing demo user
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, DEMO_EMAIL))
    .limit(1);

  if (existing.length > 0 && existing[0]) {
    await db.delete(users).where(eq(users.id, existing[0].id));
    console.log("🗑️  Removed existing demo user");
  }

  // Create demo user
  const passwordHash = await hash(DEMO_PASSWORD, 12);
  const [demoUser]   = await db
    .insert(users)
    .values({ email: DEMO_EMAIL, passwordHash, displayName: DEMO_NAME })
    .returning();

  if (!demoUser) throw new Error("Failed to create demo user");
  console.log(`✅ Demo user created: ${demoUser.id}`);

  // Seed sessions
  for (const data of SEED_DATA) {
    const startedAt = new Date();
    startedAt.setDate(startedAt.getDate() - data.daysAgo);
    const endedAt = new Date(startedAt.getTime() + data.durationSeconds * 1000);

    const [session] = await db
      .insert(sessions)
      .values({
        userId:          demoUser.id,
        language:        data.language,
        level:           data.level,
        status:          "completed",
        title:           data.title,
        startedAt,
        endedAt,
        durationSeconds: data.durationSeconds,
      })
      .returning();

    if (!session) continue;

    // Insert messages
    let msgTime = new Date(startedAt);
    for (const msg of data.messages) {
      msgTime = new Date(msgTime.getTime() + Math.random() * 15000 + 5000);
      await db.insert(messages).values({
        sessionId: session.id,
        role:      msg.role,
        content:   msg.content,
        createdAt: msgTime,
      });
    }

    // Insert feedback
    await db.insert(feedbackReports).values({
      sessionId:    session.id,
      grammarScore: data.grammarScore,
      fluencyScore: data.fluencyScore,
      vocabScore:   data.vocabScore,
      corrections:  [],
      suggestions:  [
        "Practice using past tense more consistently",
        "Work on gender agreement with articles",
        "Try to use more varied vocabulary",
      ],
      strengths:    [
        "Good sentence structure",
        "Clear communication intent",
      ],
      weaknessTags: data.weaknessTags,
    });

    console.log(`✅ Session: "${data.title}"`);
  }

  // Memory for Spanish
  await db.insert(userMemory).values({
    userId:          demoUser.id,
    language:        "spanish",
    weaknessTags:    { past_tense: 3, gender_agreement: 2, subjunctive: 1 },
    totalSessions:   2,
    avgGrammarScore: 7.0,
    avgFluencyScore: 6.4,
    avgVocabScore:   7.5,
    lastSessionAt:   new Date(),
  });

  // Memory for French
  await db.insert(userMemory).values({
    userId:          demoUser.id,
    language:        "french",
    weaknessTags:    { verb_conjugation: 2, article_usage: 1 },
    totalSessions:   1,
    avgGrammarScore: 7.0,
    avgFluencyScore: 6.5,
    avgVocabScore:   7.5,
    lastSessionAt:   new Date(),
  });

  console.log("\n🎉 Seed complete!");
  console.log("\nDemo credentials:");
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
  process.exit(0);
}

seed().catch(err => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
