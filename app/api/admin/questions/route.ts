import { demoQuestions } from "../../../../lib/demo";
import { ensureSchema, newId, runtimeEnv } from "../../../../lib/server";

function isAdmin(request: Request) {
  const configured = (runtimeEnv.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  return configured.length > 0 && !!email && configured.includes(email);
}

export async function GET(request: Request) {
  if (!isAdmin(request)) return Response.json({ error: "无管理员权限" }, { status: 403 });
  if (!runtimeEnv.DB) return Response.json({ questions: demoQuestions, demo: true });
  await ensureSchema();
  const rows = await runtimeEnv.DB.prepare("SELECT * FROM questions ORDER BY updated_at DESC").all();
  return Response.json({ questions: rows.results.length ? rows.results : demoQuestions });
}

export async function POST(request: Request) {
  if (!isAdmin(request)) return Response.json({ error: "无管理员权限" }, { status: 403 });
  const input = (await request.json()) as Record<string, unknown>;
  const required = ["title", "type", "prompt", "material", "referenceAnswer", "rubric", "maxScore", "wordLimit"];
  const missing = required.filter((field) => input[field] === undefined || input[field] === "");
  if (missing.length) return Response.json({ error: `缺少字段：${missing.join("、")}` }, { status: 400 });
  if (!runtimeEnv.DB) return Response.json({ question: { id: newId("q"), ...input }, demo: true }, { status: 201 });
  await ensureSchema();
  const id = newId("q");
  const now = new Date().toISOString();
  await runtimeEnv.DB.prepare(`
    INSERT INTO questions
    (id, title, type, prompt, material, reference_answer, rubric_json, max_score, word_limit, version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `)
    .bind(
      id,
      input.title,
      input.type,
      input.prompt,
      input.material,
      input.referenceAnswer,
      JSON.stringify(input.rubric),
      input.maxScore,
      input.wordLimit,
      now,
      now,
    )
    .run();
  return Response.json({ question: { id, ...input, version: 1 } }, { status: 201 });
}
