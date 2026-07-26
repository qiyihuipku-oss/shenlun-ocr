import { runtimeEnv } from "./server";
import type { GradingReport, OcrBlock, OcrDecision, OcrSuggestion } from "./types";

export interface StorageProvider {
  put(key: string, bytes: ArrayBuffer, contentType: string): Promise<void>;
  get(key: string): Promise<ArrayBuffer | null>;
  delete(key: string): Promise<void>;
}

export interface OcrProvider {
  readonly name: "baidu" | "paddle";
  submit(input: { page: number; bytes: ArrayBuffer; contentType: string }): Promise<{
    providerTaskId: string;
    status: "processing" | "completed";
    blocks?: OcrBlock[];
  }>;
  poll(providerTaskId: string, page: number): Promise<{
    status: "processing" | "completed" | "failed";
    blocks?: OcrBlock[];
    error?: string;
  }>;
}

export interface OcrProofreader {
  review(input: { blocks: OcrBlock[]; context: string }): Promise<OcrSuggestion[]>;
}

export interface GradingProvider {
  grade(input: {
    question: string;
    materials: string;
    referenceAnswer: string;
    rubric: unknown[];
    confirmedTranscript: string;
  }): Promise<GradingReport>;
}

type StoredObject = {
  bytes: ArrayBuffer;
  contentType: string;
};

type KvObjectMetadata = {
  contentType?: string;
  ownerId?: string;
  retentionUntil?: string;
};

const PRIVATE_OBJECT_TTL_SECONDS = 30 * 24 * 60 * 60;

export function hasPrivateStorage() {
  return Boolean(runtimeEnv.UPLOADS || runtimeEnv.UPLOADS_KV);
}

export async function putPrivateObject(
  key: string,
  bytes: ArrayBuffer,
  contentType: string,
  ownerId?: string,
) {
  const retentionUntil = new Date(
    Date.now() + PRIVATE_OBJECT_TTL_SECONDS * 1000,
  ).toISOString();
  if (runtimeEnv.UPLOADS) {
    await runtimeEnv.UPLOADS.put(key, bytes, {
      httpMetadata: { contentType },
      customMetadata: { ownerId: ownerId || "", retentionUntil },
    });
    return;
  }
  if (runtimeEnv.UPLOADS_KV) {
    await runtimeEnv.UPLOADS_KV.put(key, bytes, {
      expirationTtl: PRIVATE_OBJECT_TTL_SECONDS,
      metadata: { contentType, ownerId, retentionUntil } satisfies KvObjectMetadata,
    });
    return;
  }
  throw new Error("私有图片存储尚未绑定");
}

export async function getPrivateObject(
  key: string,
): Promise<StoredObject | null> {
  if (runtimeEnv.UPLOADS) {
    const object = await runtimeEnv.UPLOADS.get(key);
    if (!object) return null;
    return {
      bytes: await object.arrayBuffer(),
      contentType: object.httpMetadata?.contentType || "image/jpeg",
    };
  }
  if (runtimeEnv.UPLOADS_KV) {
    const object =
      await runtimeEnv.UPLOADS_KV.getWithMetadata<KvObjectMetadata>(
        key,
        "arrayBuffer",
      );
    if (!object.value) return null;
    return {
      bytes: object.value,
      contentType: object.metadata?.contentType || "image/jpeg",
    };
  }
  return null;
}

export async function deletePrivateObject(key: string) {
  if (runtimeEnv.UPLOADS) {
    await runtimeEnv.UPLOADS.delete(key);
    return;
  }
  await runtimeEnv.UPLOADS_KV?.delete(key);
}

export class R2StorageProvider implements StorageProvider {
  async put(key: string, bytes: ArrayBuffer, contentType: string) {
    await putPrivateObject(key, bytes, contentType);
  }

  async get(key: string) {
    const object = await getPrivateObject(key);
    return object?.bytes || null;
  }

  async delete(key: string) {
    await deletePrivateObject(key);
  }
}

export class BaiduCompositionOcrProvider implements OcrProvider {
  readonly name = "baidu" as const;
  private accessToken?: string;

  private async token() {
    if (this.accessToken) return this.accessToken;
    if (!runtimeEnv.BAIDU_OCR_API_KEY || !runtimeEnv.BAIDU_OCR_SECRET_KEY) {
      throw new Error("尚未配置百度手写作文 OCR 密钥");
    }
    const url = new URL("https://aip.baidubce.com/oauth/2.0/token");
    url.searchParams.set("grant_type", "client_credentials");
    url.searchParams.set("client_id", runtimeEnv.BAIDU_OCR_API_KEY);
    url.searchParams.set("client_secret", runtimeEnv.BAIDU_OCR_SECRET_KEY);
    const response = await fetch(url, { method: "POST" });
    if (!response.ok) throw new Error(`百度访问令牌获取失败（${response.status}）`);
    const data = (await response.json()) as { access_token?: string };
    if (!data.access_token) throw new Error("百度未返回访问令牌");
    this.accessToken = data.access_token;
    return data.access_token;
  }

  async submit(input: { page: number; bytes: ArrayBuffer; contentType: string }) {
    const token = await this.token();
    const response = await fetch(
      `https://aip.baidubce.com/rest/2.0/ocr/v1/handwriting_composition/create_task?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: arrayBufferToBase64(input.bytes),
          recognize_granularity: "word",
          detect_direction: true,
        }),
      },
    );
    const payload = (await response.json()) as {
      error_msg?: string;
      result?: { task_id?: string };
      task_id?: string;
    };
    if (!response.ok || payload.error_msg) {
      throw new Error(`百度 OCR 提交失败：${payload.error_msg || response.status}`);
    }
    const providerTaskId = payload.result?.task_id || payload.task_id;
    if (!providerTaskId) throw new Error("百度 OCR 未返回任务编号");
    return { providerTaskId, status: "processing" as const };
  }

  async poll(providerTaskId: string, page: number) {
    const token = await this.token();
    const response = await fetch(
      `https://aip.baidubce.com/rest/2.0/ocr/v1/handwriting_composition/get_result?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: providerTaskId }),
      },
    );
    const payload = (await response.json()) as BaiduResult;
    if (!response.ok || payload.error_msg) {
      return { status: "failed" as const, error: payload.error_msg || `HTTP ${response.status}` };
    }
    const state = payload.result?.status || payload.status;
    if (state === "failed") return { status: "failed" as const, error: "百度识别任务失败" };
    if (state !== "success" && state !== "completed") return { status: "processing" as const };
    return { status: "completed" as const, blocks: normalizeBaiduBlocks(payload, page) };
  }
}

export class PaddleOcrProvider implements OcrProvider {
  readonly name = "paddle" as const;

  async submit(input: { page: number; bytes: ArrayBuffer; contentType: string }) {
    if (!runtimeEnv.PADDLE_OCR_ENDPOINT) throw new Error("尚未配置 PaddleOCR 服务地址");
    const response = await fetch(runtimeEnv.PADDLE_OCR_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(runtimeEnv.PADDLE_OCR_API_KEY
          ? { Authorization: `Bearer ${runtimeEnv.PADDLE_OCR_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        image: arrayBufferToBase64(input.bytes),
        options: {
          model: "PP-OCRv6_medium",
          use_doc_orientation_classify: true,
          use_doc_unwarping: true,
          use_textline_orientation: true,
        },
      }),
    });
    if (!response.ok) throw new Error(`PaddleOCR 调用失败（${response.status}）`);
    const payload = (await response.json()) as PaddleResult;
    const blocks = normalizePaddleBlocks(payload, input.page);
    return {
      providerTaskId: payload.task_id || `paddle-inline-${crypto.randomUUID()}`,
      status: "completed" as const,
      blocks,
    };
  }

  async poll() {
    return { status: "failed" as const, error: "PaddleOCR 当前使用同步服务接口" };
  }
}

export function reconcileOcrBlocks(
  primary: OcrBlock[],
  secondary: OcrBlock[],
  materialTerms: string[] = [],
): OcrDecision[] {
  return primary.map((block) => {
    const samePage = secondary.filter((item) => item.page === block.page);
    const alternative = samePage.reduce<OcrBlock | undefined>((closest, item) => {
      if (!closest) return item;
      return Math.abs(item.box.y - block.box.y) < Math.abs(closest.box.y - block.box.y) ? item : closest;
    }, undefined);
    const disagreement = !!alternative && normalizeText(alternative.text) !== normalizeText(block.text);
    const materialTerm = materialTerms.find(
      (term) => !block.text.includes(term) && alternative?.text.includes(term),
    );
    const useSecondary =
      !!alternative &&
      runtimeEnv.OCR_SECONDARY_MODE === "assist" &&
      alternative.confidence > block.confidence + 0.08 &&
      !!materialTerm;
    const chosen = useSecondary ? alternative! : block;
    const confidence = Math.max(0, Math.min(1, disagreement ? chosen.confidence * 0.88 : chosen.confidence));
    return {
      blockId: block.id,
      text: chosen.text,
      alternatives: alternative
        ? [{ text: alternative.text, provider: alternative.provider || "paddle", confidence: alternative.confidence }]
        : [],
      confidence,
      requiresReview: confidence < 0.92 || disagreement,
      reasonCodes: [
        ...(confidence < 0.92 ? (["low_confidence"] as const) : []),
        ...(disagreement ? (["engine_disagreement"] as const) : []),
        ...(materialTerm ? (["material_term"] as const) : []),
      ],
      sourceProviders: [block.provider || "baidu", ...(alternative ? [alternative.provider || "paddle"] : [])],
    };
  });
}

type BaiduResult = {
  error_msg?: string;
  status?: string;
  result?: {
    status?: string;
    result?: {
      essayOverall?: {
        paragraphs?: Array<{ text?: string }>;
      };
      title?: { text?: string; bbox?: unknown; chars?: BaiduChar[] };
      content?: {
        lines?: Array<{
          lineId?: string;
          text?: string;
          bbox?: unknown;
          chars?: BaiduChar[];
        }>;
      };
    };
  };
};

type BaiduChar = {
  char?: string;
  bbox?: unknown;
  probability?: number | { average?: number };
  confidence?: number;
};

type PaddleResult = {
  task_id?: string;
  rec_texts?: string[];
  rec_scores?: number[];
  rec_boxes?: Array<[number, number, number, number]>;
  result?: { rec_texts?: string[]; rec_scores?: number[]; rec_boxes?: Array<[number, number, number, number]> };
};

function normalizeBaiduBlocks(payload: BaiduResult, page: number): OcrBlock[] {
  const result = payload.result?.result;
  const lines = result?.content?.lines ?? [];
  return lines
    .map((line, index) => {
      const scores = (line.chars || []).map(charConfidence).filter((value): value is number => value !== null);
      const confidence = scores.length
        ? scores.reduce((sum, value) => sum + value, 0) / scores.length
        : heuristicLineConfidence(line.text || "", line.chars || []);
      const box = parseBaiduBox(line.bbox);
      return {
        id: line.lineId || `baidu-p${page}-${index + 1}`,
        page,
        text: line.text?.trim() || "",
        confidence,
        uncertain: confidence < 0.92,
        provider: "baidu",
        imageVariant: "normalized" as const,
        confidenceSource: scores.length ? "character_average" as const : "heuristic" as const,
        coordinateSpace: "pixels" as const,
        box: box || { x: 0, y: index * 32, width: 1, height: 30 },
      };
    })
    .filter((block) => block.text);
}

function normalizePaddleBlocks(payload: PaddleResult, page: number): OcrBlock[] {
  const result = payload.result || payload;
  return (result.rec_texts || []).map((text, index) => {
    const box = result.rec_boxes?.[index] || [0, index * 32, 1, index * 32 + 30];
    const confidence = result.rec_scores?.[index] ?? 0.7;
    return {
      id: `paddle-p${page}-${index + 1}`,
      page,
      text,
      confidence,
      uncertain: confidence < 0.92,
      provider: "paddle",
      imageVariant: "normalized",
      confidenceSource: "provider",
      coordinateSpace: "pixels",
      box: { x: box[0], y: box[1], width: box[2] - box[0], height: box[3] - box[1] },
    };
  });
}

function charConfidence(char: BaiduChar): number | null {
  if (typeof char.confidence === "number") return char.confidence;
  if (typeof char.probability === "number") return char.probability;
  if (typeof char.probability?.average === "number") return char.probability.average;
  return null;
}

function heuristicLineConfidence(text: string, chars: BaiduChar[]) {
  if (!text) return 0;
  const coverage = chars.length ? Math.min(1, chars.length / [...text].length) : 0;
  return Math.min(0.89, 0.68 + coverage * 0.21);
}

function parseBaiduBox(value: unknown): OcrBlock["box"] | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return parseBaiduBox(JSON.parse(value));
    } catch {
      const numbers = value.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
      return numbers ? parseBaiduBox(numbers) : null;
    }
  }
  if (Array.isArray(value)) {
    const points = value.flat(Infinity).map(Number).filter(Number.isFinite);
    if (points.length >= 4) {
      const xs = points.filter((_, index) => index % 2 === 0);
      const ys = points.filter((_, index) => index % 2 === 1);
      return {
        x: Math.min(...xs),
        y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      };
    }
  }
  if (typeof value === "object") {
    const box = value as Record<string, number>;
    const x = box.left ?? box.x;
    const y = box.top ?? box.y;
    if ([x, y, box.width, box.height].every((item) => typeof item === "number")) {
      return { x, y, width: box.width, height: box.height };
    }
  }
  return null;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, "").replace(/[，。；：“”‘’]/g, "");
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.byteLength; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}
