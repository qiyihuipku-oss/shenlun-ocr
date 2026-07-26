import {
  BaiduCompositionOcrProvider,
  getPrivateObject,
  hasPrivateStorage,
  PaddleOcrProvider,
  reconcileOcrBlocks,
} from "./providers";
import {
  ensureSchema,
  getSubmission,
  newId,
  runtimeEnv,
} from "./server";
import type { OcrBlock, OcrCandidate, OcrDecision, SubmissionSnapshot } from "./types";

type PageRef = { key: string; order: number; rotation?: number };
type ProviderTask = {
  page: number;
  providerTaskId: string;
  status: "processing" | "completed" | "failed";
  blocks?: OcrBlock[];
  error?: string;
};

export async function startOcrRun(
  submissionId: string,
  ownerId: string,
  scope: { page?: number; blockId?: string } = {},
) {
  if (!runtimeEnv.DB || !hasPrivateStorage()) throw new Error("OCR 所需的数据库或私有存储尚未绑定");
  await ensureSchema();
  const submission = await getSubmission(submissionId, ownerId);
  if (!submission) throw new Error("未找到提交记录");

  const active = await runtimeEnv.DB.prepare(
    "SELECT id, status FROM ocr_runs WHERE submission_id = ? AND owner_id = ? AND status IN ('pending','processing') ORDER BY created_at DESC LIMIT 1",
  ).bind(submissionId, ownerId).first<{ id: string; status: string }>();
  if (active) return { runId: active.id, status: active.status, idempotent: true };

  let targetPage = scope.page;
  if (!targetPage && scope.blockId) {
    targetPage = submission.blocks.find((block) => block.id === scope.blockId)?.page;
  }
  const pages = (submission.pages as PageRef[]).filter((page) => !targetPage || page.order === targetPage);
  if (!pages.length) throw new Error("没有可识别的答卷页面");

  const usePaddle = !!targetPage && !!runtimeEnv.PADDLE_OCR_ENDPOINT;
  const provider = usePaddle ? new PaddleOcrProvider() : new BaiduCompositionOcrProvider();
  const runId = newId("ocr");
  const now = new Date().toISOString();

  await runtimeEnv.DB.batch([
    runtimeEnv.DB.prepare(`
      INSERT INTO ocr_runs
      (id, submission_id, owner_id, provider, mode, status, scope_json, provider_tasks_json, attempts, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?, '[]', 0, ?, ?)
    `).bind(runId, submissionId, ownerId, provider.name, targetPage ? "retry" : "primary", JSON.stringify(scope), now, now),
    runtimeEnv.DB.prepare(
      "UPDATE submissions SET status = 'ocr_pending', ocr_progress = 4, failure_reason = NULL, updated_at = ? WHERE id = ? AND owner_id = ?",
    ).bind(now, submissionId, ownerId),
  ]);

  try {
    const tasks: ProviderTask[] = [];
    for (const [pageIndex, page] of pages.entries()) {
      const object = await getPrivateObject(page.key);
      if (!object) throw new Error(`第 ${page.order} 页原图不存在`);
      const result = await provider.submit({
        page: page.order,
        bytes: object.bytes,
        contentType: object.contentType,
      });
      tasks.push({
        page: page.order,
        providerTaskId: result.providerTaskId,
        status: result.status,
        blocks: "blocks" in result ? result.blocks : undefined,
      });
      if (provider.name === "baidu" && pageIndex < pages.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 550));
      }
    }
    const completed = tasks.every((task) => task.status === "completed");
    await runtimeEnv.DB.batch([
      runtimeEnv.DB.prepare(
        "UPDATE ocr_runs SET status = ?, provider_tasks_json = ?, attempts = 1, updated_at = ? WHERE id = ?",
      ).bind(completed ? "processing" : "processing", JSON.stringify(tasks), new Date().toISOString(), runId),
      runtimeEnv.DB.prepare(
        "UPDATE submissions SET status = 'ocr_processing', ocr_progress = 12, updated_at = ? WHERE id = ? AND owner_id = ?",
      ).bind(new Date().toISOString(), submissionId, ownerId),
    ]);
    return { runId, status: "processing", idempotent: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "OCR 提交失败";
    await failRun(runId, submissionId, ownerId, message);
    throw error;
  }
}

export async function advanceOcrRun(
  submissionId: string,
  ownerId: string,
): Promise<SubmissionSnapshot | null> {
  if (!runtimeEnv.DB) return getSubmission(submissionId, ownerId);
  await ensureSchema();
  const submission = await getSubmission(submissionId, ownerId);
  if (!submission || !["ocr_pending", "ocr_processing"].includes(submission.status)) return submission;

  const run = await runtimeEnv.DB.prepare(
    "SELECT * FROM ocr_runs WHERE submission_id = ? AND owner_id = ? AND status IN ('pending','processing') ORDER BY created_at DESC LIMIT 1",
  ).bind(submissionId, ownerId).first<Record<string, string | number | null>>();
  if (!run) return submission;

  const tasks = JSON.parse(String(run.provider_tasks_json || "[]")) as ProviderTask[];
  if (!tasks.length) return submission;
  const provider =
    run.provider === "paddle" ? new PaddleOcrProvider() : new BaiduCompositionOcrProvider();

  let failures = 0;
  for (const task of tasks) {
    if (task.status !== "processing") continue;
    const result = await provider.poll(task.providerTaskId, task.page);
    task.status = result.status;
    task.blocks = "blocks" in result ? result.blocks : undefined;
    task.error = result.error;
    if (result.status === "failed") failures += 1;
  }

  const completedCount = tasks.filter((task) => task.status === "completed").length;
  const progress = 12 + Math.round((completedCount / tasks.length) * 70);
  const now = new Date().toISOString();

  if (failures) {
    const attempts = Number(run.attempts || 0) + 1;
    if (attempts < 3) {
      const retryAt = new Date(Date.now() + 2 ** attempts * 1000).toISOString();
      tasks.forEach((task) => {
        if (task.status === "failed") task.status = "processing";
      });
      await runtimeEnv.DB.prepare(
        "UPDATE ocr_runs SET provider_tasks_json = ?, attempts = ?, next_retry_at = ?, updated_at = ? WHERE id = ?",
      ).bind(JSON.stringify(tasks), attempts, retryAt, now, run.id).run();
      return { ...submission, progress, status: "ocr_processing" };
    }
    await failRun(String(run.id), submissionId, ownerId, "OCR 连续失败，请检查图片后手动重试");
    return getSubmission(submissionId, ownerId);
  }

  if (completedCount !== tasks.length) {
    await runtimeEnv.DB.batch([
      runtimeEnv.DB.prepare(
        "UPDATE ocr_runs SET provider_tasks_json = ?, updated_at = ? WHERE id = ?",
      ).bind(JSON.stringify(tasks), now, run.id),
      runtimeEnv.DB.prepare(
        "UPDATE submissions SET status = 'ocr_processing', ocr_progress = ?, updated_at = ? WHERE id = ? AND owner_id = ?",
      ).bind(progress, now, submissionId, ownerId),
    ]);
    return { ...submission, progress, status: "ocr_processing" };
  }

  const scope = JSON.parse(String(run.scope_json || "{}")) as { page?: number; blockId?: string };
  const primaryBlocks = normalizeBlockCoordinates(tasks.flatMap((task) =>
    (task.blocks || []).map((block) => ({ ...block, runId: String(run.id) })),
  ), submission);
  const secondary = normalizeBlockCoordinates(
    await runSecondaryShadow(submission.pages as PageRef[], primaryBlocks),
    submission,
  );
  const terms = await loadMaterialTerms(submission.questionId);
  const newDecisions = reconcileOcrBlocks(primaryBlocks, secondary, terms);

  const blocks = scope.page
    ? [...submission.blocks.filter((block) => block.page !== scope.page), ...primaryBlocks].sort(
        (a, b) => a.page - b.page || a.box.y - b.box.y,
      )
    : primaryBlocks;
  const decisions: OcrDecision[] = scope.page
    ? [
        ...(submission.decisions || []).filter(
          (decision) => submission.blocks.find((block) => block.id === decision.blockId)?.page !== scope.page,
        ),
        ...newDecisions,
      ]
    : newDecisions;
  const transcript = decisions.map((decision) => decision.text).join("\n\n");

  await persistCandidates(String(run.id), submissionId, [...primaryBlocks, ...secondary]);
  await runtimeEnv.DB.batch([
    runtimeEnv.DB.prepare(
      "UPDATE ocr_runs SET status = 'completed', provider_tasks_json = ?, updated_at = ? WHERE id = ?",
    ).bind(JSON.stringify(tasks), now, run.id),
    runtimeEnv.DB.prepare(`
      UPDATE submissions
      SET status = 'needs_review', blocks_json = ?, decisions_json = ?, transcript = ?, ocr_progress = 100, updated_at = ?
      WHERE id = ? AND owner_id = ?
    `).bind(JSON.stringify(blocks), JSON.stringify(decisions), transcript, now, submissionId, ownerId),
  ]);
  return getSubmission(submissionId, ownerId);
}

async function runSecondaryShadow(pages: PageRef[], primary: OcrBlock[]) {
  if (
    !runtimeEnv.PADDLE_OCR_ENDPOINT ||
    runtimeEnv.OCR_SECONDARY_MODE === "off" ||
    !hasPrivateStorage()
  ) return [] as OcrBlock[];
  const lowPages = new Set(primary.filter((block) => block.confidence < 0.92).map((block) => block.page));
  const provider = new PaddleOcrProvider();
  const secondary: OcrBlock[] = [];
  for (const page of pages.filter((item) => lowPages.has(item.order))) {
    const object = await getPrivateObject(page.key);
    if (!object) continue;
    const result = await provider.submit({
      page: page.order,
      bytes: object.bytes,
      contentType: object.contentType,
    });
    secondary.push(...(result.blocks || []));
  }
  return secondary;
}

async function loadMaterialTerms(questionId: string) {
  if (!runtimeEnv.DB) return [] as string[];
  const row = await runtimeEnv.DB.prepare(
    "SELECT material, reference_answer FROM questions WHERE id = ? LIMIT 1",
  ).bind(questionId).first<{ material: string; reference_answer: string }>();
  const text = `${row?.material || ""}${row?.reference_answer || ""}`;
  return [...new Set(text.match(/[\u4e00-\u9fff]{4,8}/g) || [])].slice(0, 120);
}

async function persistCandidates(runId: string, submissionId: string, blocks: OcrBlock[]) {
  if (!runtimeEnv.DB || !blocks.length) return;
  const now = new Date().toISOString();
  const candidates: OcrCandidate[] = blocks.map((block) => ({
    id: newId("cand"),
    blockId: block.id,
    provider: block.provider === "paddle" ? "paddle" : "baidu",
    imageVariant: block.imageVariant || "normalized",
    text: block.text,
    confidence: block.confidence,
    box: block.box,
    runId,
  }));
  for (let index = 0; index < candidates.length; index += 75) {
    await runtimeEnv.DB.batch(
      candidates.slice(index, index + 75).map((candidate) =>
        runtimeEnv.DB!.prepare(`
          INSERT INTO ocr_candidates
          (id, run_id, submission_id, block_id, provider, image_variant, text, confidence_milli, box_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          candidate.id,
          runId,
          submissionId,
          candidate.blockId,
          candidate.provider,
          candidate.imageVariant,
          candidate.text,
          Math.round(candidate.confidence * 1000),
          JSON.stringify(candidate.box),
          now,
        ),
      ),
    );
  }
}

async function failRun(runId: string, submissionId: string, ownerId: string, message: string) {
  if (!runtimeEnv.DB) return;
  const now = new Date().toISOString();
  await runtimeEnv.DB.batch([
    runtimeEnv.DB.prepare(
      "UPDATE ocr_runs SET status = 'failed', error = ?, updated_at = ? WHERE id = ?",
    ).bind(message, now, runId),
    runtimeEnv.DB.prepare(
      "UPDATE submissions SET status = 'failed', failure_reason = ?, updated_at = ? WHERE id = ? AND owner_id = ?",
    ).bind(message, now, submissionId, ownerId),
  ]);
}

function normalizeBlockCoordinates(blocks: OcrBlock[], submission: SubmissionSnapshot) {
  return blocks.map((block) => {
    if (block.coordinateSpace !== "pixels") return block;
    const quality = submission.quality?.[block.page - 1];
    if (!quality?.width || !quality.height) return block;
    return {
      ...block,
      coordinateSpace: "percent" as const,
      box: {
        x: clampPercent((block.box.x / quality.width) * 100),
        y: clampPercent((block.box.y / quality.height) * 100),
        width: clampPercent((block.box.width / quality.width) * 100),
        height: clampPercent((block.box.height / quality.height) * 100),
      },
    };
  });
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Number(value.toFixed(3))));
}
