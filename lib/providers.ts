import { runtimeEnv } from "./server";
import type { GradingReport, OcrBlock, OcrSuggestion } from "./types";

export interface StorageProvider {
  put(key: string, bytes: ArrayBuffer, contentType: string): Promise<void>;
  get(key: string): Promise<ArrayBuffer | null>;
  delete(key: string): Promise<void>;
}

export interface OcrProvider {
  submit(input: { pages: Array<{ bytes: ArrayBuffer; contentType: string }> }): Promise<{
    providerTaskId: string;
    status: "processing" | "completed";
    blocks?: OcrBlock[];
  }>;
  poll(providerTaskId: string): Promise<{ status: "processing" | "completed" | "failed"; blocks?: OcrBlock[] }>;
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

export class R2StorageProvider implements StorageProvider {
  async put(key: string, bytes: ArrayBuffer, contentType: string) {
    if (!runtimeEnv.UPLOADS) throw new Error("R2 binding UPLOADS is unavailable");
    await runtimeEnv.UPLOADS.put(key, bytes, {
      httpMetadata: { contentType },
      customMetadata: { retentionUntil: new Date(Date.now() + 30 * 86400_000).toISOString() },
    });
  }

  async get(key: string) {
    const object = await runtimeEnv.UPLOADS?.get(key);
    return object ? object.arrayBuffer() : null;
  }

  async delete(key: string) {
    await runtimeEnv.UPLOADS?.delete(key);
  }
}

export class BaiduCompositionOcrProvider implements OcrProvider {
  private accessToken?: string;

  private async token() {
    if (this.accessToken) return this.accessToken;
    if (!runtimeEnv.BAIDU_OCR_API_KEY || !runtimeEnv.BAIDU_OCR_SECRET_KEY) {
      throw new Error("Baidu OCR credentials are unavailable");
    }
    const url = new URL("https://aip.baidubce.com/oauth/2.0/token");
    url.searchParams.set("grant_type", "client_credentials");
    url.searchParams.set("client_id", runtimeEnv.BAIDU_OCR_API_KEY);
    url.searchParams.set("client_secret", runtimeEnv.BAIDU_OCR_SECRET_KEY);
    const response = await fetch(url, { method: "POST" });
    if (!response.ok) throw new Error(`Baidu token ${response.status}`);
    const data = (await response.json()) as { access_token: string };
    this.accessToken = data.access_token;
    return data.access_token;
  }

  async submit(input: { pages: Array<{ bytes: ArrayBuffer; contentType: string }> }) {
    const token = await this.token();
    const page = input.pages[0];
    const base64 = arrayBufferToBase64(page.bytes);
    const response = await fetch(
      `https://aip.baidubce.com/rest/2.0/ocr/v1/handwriting_composition/create_task?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, recognize_granularity: "word" }),
      },
    );
    if (!response.ok) throw new Error(`Baidu OCR submit ${response.status}`);
    const payload = (await response.json()) as { result?: { task_id?: string }; task_id?: string };
    const providerTaskId = payload.result?.task_id || payload.task_id;
    if (!providerTaskId) throw new Error("Baidu OCR did not return task_id");
    return { providerTaskId, status: "processing" as const };
  }

  async poll(providerTaskId: string) {
    const token = await this.token();
    const response = await fetch(
      `https://aip.baidubce.com/rest/2.0/ocr/v1/handwriting_composition/get_result?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: providerTaskId }),
      },
    );
    if (!response.ok) throw new Error(`Baidu OCR poll ${response.status}`);
    const payload = (await response.json()) as {
      result?: { status?: string; result?: { essayOverall?: { paragraphs?: Array<{ text?: string }> } } };
    };
    if (payload.result?.status === "failed") return { status: "failed" as const };
    if (payload.result?.status !== "success") return { status: "processing" as const };
    const paragraphs = payload.result.result?.essayOverall?.paragraphs ?? [];
    const blocks: OcrBlock[] = paragraphs.map((paragraph, index) => ({
      id: `baidu-${index + 1}`,
      page: 1,
      text: paragraph.text ?? "",
      confidence: 0.9,
      box: { x: 8, y: 8 + index * 12, width: 84, height: 10 },
    }));
    return { status: "completed" as const, blocks };
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let index = 0; index < bytes.byteLength; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}
