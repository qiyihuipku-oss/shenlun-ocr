"use client";

import { useMemo, useRef, useState } from "react";
import { Button as BaseButton } from "@base-ui/react/button";
import Link from "next/link";
import type { GradingReport, ImageQuality, OcrBlock, SubmissionSnapshot, SubmissionStatus } from "../lib/types";
import { demoQuestions, historyRows } from "../lib/demo";

type PageImage = {
  id: string;
  name: string;
  url: string;
  rotation: number;
  file: File;
  normalized: Blob;
  quality: ImageQuality;
};

const statusLabels: Record<SubmissionStatus, string> = {
  uploaded: "已上传",
  quality_check: "图像质检",
  ocr_pending: "等待识别",
  ocr_processing: "正在识别",
  needs_review: "等待校对",
  confirmed: "电子稿已确认",
  grading: "正在批改",
  completed: "报告已完成",
  failed: "处理失败",
};

function Icon({ name }: { name: "upload" | "scan" | "evidence" | "history" | "shield" }) {
  const icons = {
    upload: "↑",
    scan: "⌁",
    evidence: "※",
    history: "↺",
    shield: "◇",
  };
  return <span aria-hidden="true">{icons[name]}</span>;
}

export function WorkspaceApp({ userName }: { userName?: string }) {
  const [activeView, setActiveView] = useState<"workspace" | "history">("workspace");
  const [questionId, setQuestionId] = useState(demoQuestions[0].id);
  const [pages, setPages] = useState<PageImage[]>([]);
  const [status, setStatus] = useState<SubmissionStatus>("uploaded");
  const [blocks, setBlocks] = useState<OcrBlock[]>([]);
  const [transcript, setTranscript] = useState("");
  const [report, setReport] = useState<GradingReport | null>(null);
  const [activeBlock, setActiveBlock] = useState("b1");
  const [notice, setNotice] = useState("上传答卷后先做图像质检，再创建真实 OCR 任务");
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [consentScope, setConsentScope] = useState<"none" | "improvement">("none");
  const fileInput = useRef<HTMLInputElement>(null);

  const question = demoQuestions.find((item) => item.id === questionId)!;
  const currentStep = report ? 3 : blocks.length ? 2 : 1;
  const wordCount = transcript.replace(/\s/g, "").length;

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files)
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, Math.max(0, 8 - pages.length));
    setNotice("正在检查照片清晰度、曝光与分辨率…");
    const next = await Promise.all(selected.map(async (file) => {
      const prepared = await prepareImage(file);
      return {
        id: crypto.randomUUID(),
        name: file.name,
        url: URL.createObjectURL(file),
        rotation: 0,
        file,
        normalized: prepared.normalized,
        quality: prepared.quality,
      };
    }));
    setPages((existing) => [...existing, ...next]);
    const issues = next.reduce((sum, page) => sum + page.quality.issues.length, 0);
    setNotice(next.length ? `已加入 ${next.length} 页；${issues ? `发现 ${issues} 项拍摄提醒，请确认后继续` : "图像质量良好，请检查页序"}` : "请选择 JPG、PNG 或 WebP 图片");
  };

  const rotatePage = (id: string) => {
    setPages((items) =>
      items.map((item) =>
        item.id === id ? { ...item, rotation: (item.rotation + 90) % 360 } : item,
      ),
    );
  };

  const movePage = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= pages.length) return;
    setPages((items) => {
      const copy = [...items];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  };

  const startOcr = async () => {
    if (!pages.length) {
      setNotice("请先上传至少一页手写答卷");
      fileInput.current?.click();
      return;
    }
    try {
      setStatus("quality_check");
      setNotice("正在移除照片定位信息并上传到私有存储…");
      const uploaded = [];
      for (const [index, page] of pages.entries()) {
        const originalKey = await uploadPrivateBlob(page.file, page.file.name);
        const normalizedKey = await uploadPrivateBlob(page.normalized, `normalized-${page.file.name}`);
        uploaded.push({
          key: normalizedKey,
          originalKey,
          normalizedKey,
          order: index + 1,
          rotation: page.rotation,
        });
      }
      const createResponse = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          pages: uploaded,
          quality: pages.map((page) => page.quality),
        }),
      });
      const created = await readJson<{ submission: SubmissionSnapshot }>(createResponse);
      setSubmissionId(created.submission.id);
      setStatus("ocr_pending");
      setNotice("答卷已安全保存，正在创建真实 OCR 任务…");
      await readJson(await fetch(`/api/submissions/${created.submission.id}/ocr`, { method: "POST" }));
      await pollSubmission(created.submission.id, applySubmission);
    } catch (error) {
      setStatus("failed");
      setNotice(error instanceof Error ? error.message : "识别失败，请稍后重试");
    }
  };

  const confirmTranscript = async () => {
    if (!transcript.trim() || !submissionId) return;
    try {
      await readJson(await fetch(`/api/submissions/${submissionId}/transcript`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, blockId: activeBlock }),
      }));
      await readJson(await fetch(`/api/submissions/${submissionId}/confirm`, { method: "POST" }));
      setStatus("confirmed");
      setNotice("电子稿已锁定。批改只会使用这份确认后的文本");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存电子稿失败");
    }
  };

  const startGrading = async () => {
    if (status !== "confirmed") return;
    if (!submissionId) return;
    try {
      setStatus("grading");
      setNotice("正在逐项寻找原文证据，不会补写考生没有表达的内容…");
      const result = await readJson<{ report: GradingReport }>(
        await fetch(`/api/submissions/${submissionId}/grade`, { method: "POST" }),
      );
      setReport({ ...result.report, wordCount });
      setStatus("completed");
      setNotice("批改完成：每个命中点均可回看原文证据");
    } catch (error) {
      setStatus("confirmed");
      setNotice(error instanceof Error ? error.message : "批改失败，请稍后重试");
    }
  };

  const applySubmission = (submission: SubmissionSnapshot) => {
    setStatus(submission.status);
    setBlocks(submission.blocks);
    setTranscript(submission.transcript);
    if (submission.blocks[0]) setActiveBlock(submission.blocks[0].id);
    if (submission.status === "needs_review") {
      const uncertain = (submission.decisions || []).filter((decision) => decision.requiresReview).length;
      setNotice(`识别完成：${uncertain} 处需要人工确认`);
    } else if (submission.status === "failed") {
      setNotice(submission.failureReason || "OCR 任务失败，可检查图片后重新执行");
    } else {
      setNotice(`正在识别与交叉校验，当前进度 ${submission.progress || 0}%`);
    }
  };

  const reset = () => {
    pages.forEach((page) => URL.revokeObjectURL(page.url));
    setPages([]);
    setBlocks([]);
    setTranscript("");
    setReport(null);
    setStatus("uploaded");
    setSubmissionId(null);
    setNotice("已新建一份空白练习");
  };

  const activePage = pages[0];
  const selectedBlock = useMemo(
    () => blocks.find((block) => block.id === activeBlock) ?? blocks[0],
    [activeBlock, blocks],
  );

  return (
    <main>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="申论镜首页">
          <span className="brand-seal">申</span>
          <span>
            <b>申论镜</b>
            <small>SHENLUN MIRROR</small>
          </span>
        </Link>
        <nav aria-label="主导航">
          <button
            className={activeView === "workspace" ? "nav-active" : ""}
            onClick={() => setActiveView("workspace")}
          >
            批改台
          </button>
          <button
            className={activeView === "history" ? "nav-active" : ""}
            onClick={() => setActiveView("history")}
          >
            练习档案
          </button>
          <a href="#method">批改方法</a>
        </nav>
        <div className="header-actions">
          <Link className="beta-tag" href="/">产品主页</Link>
          <a className="avatar" href="/signout-with-chatgpt?return_to=/" aria-label={`退出当前用户：${userName || "考生"}`}>
            {(userName || "考").slice(0, 1)}
          </a>
        </div>
      </header>

      {activeView === "history" ? (
        <HistoryView onBack={() => setActiveView("workspace")} />
      ) : (
        <>
          <section className="hero" id="top">
            <div>
              <span className="eyebrow">HANDWRITING · EVIDENCE · REVIEW</span>
              <h1>把纸上的思考，<br />变成看得见的进步。</h1>
            </div>
            <div className="hero-aside">
              <p>
                不替你重写答案，也不制造“官方精确分”。申论镜把每条判断放回原文，
                让你先看清写了什么，再决定下一次怎么写。
              </p>
              <div className="trust-row">
                <span><Icon name="shield" /> 原图私密保存</span>
                <span><Icon name="evidence" /> 结论必须有证据</span>
              </div>
            </div>
          </section>

          <section className="progress-shell" aria-label="批改进度">
            {["上传答卷", "校对原文", "循证批改"].map((label, index) => (
              <div className={`progress-item ${currentStep >= index + 1 ? "is-active" : ""}`} key={label}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <b>{label}</b>
                  <small>{index === 0 ? "整理页面与题目" : index === 1 ? "确认识别结果" : "查看证据与建议"}</small>
                </div>
              </div>
            ))}
            <div className="status-pill">
              <i />
              {statusLabels[status]}
            </div>
          </section>

          <section className="notice" role="status">
            <span>现场记录</span>
            <p>{notice}</p>
            <button onClick={reset}>重新开始</button>
          </section>

          <section className="data-consent">
            <label>
              <input
                type="checkbox"
                checked={consentScope === "improvement"}
                onChange={async (event) => {
                  const next = event.target.checked ? "improvement" : "none";
                  try {
                    await readJson(await fetch("/api/account/data-consent", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ scope: next }),
                    }));
                    setConsentScope(next);
                  } catch (error) {
                    setNotice(error instanceof Error ? error.message : "授权设置保存失败");
                  }
                }}
              />
              <span>
                <b>匿名改进授权</b>
                允许将人工校正后的局部字行用于提升识别；不保存整份答卷，可随时撤回。
              </span>
            </label>
          </section>

          <section className="workspace">
            <aside className="question-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-index">01 / 题目</span>
                  <h2>选择本次作答</h2>
                </div>
                <span className="question-type">{question.type}</span>
              </div>
              <label className="field-label" htmlFor="question">真题与评分标准</label>
              <select
                id="question"
                value={questionId}
                onChange={(event) => {
                  setQuestionId(event.target.value);
                  reset();
                }}
              >
                {demoQuestions.map((item) => (
                  <option value={item.id} key={item.id}>{item.title}</option>
                ))}
              </select>
              <div className="question-card">
                <p>{question.prompt}</p>
                <dl>
                  <div><dt>满分</dt><dd>{question.maxScore} 分</dd></div>
                  <div><dt>建议字数</dt><dd>{question.wordLimit}</dd></div>
                  <div><dt>评分点</dt><dd>{question.rubricCount} 项</dd></div>
                </dl>
              </div>
              <details>
                <summary>查看材料摘要与评分说明</summary>
                <p>{question.materialSummary}</p>
              </details>
            </aside>

            <section className="work-panel">
              {!blocks.length ? (
                <UploadStage
                  pages={pages}
                  inputRef={fileInput}
                  onFiles={handleFiles}
                  onRemove={(id) => setPages((items) => items.filter((item) => item.id !== id))}
                  onRotate={rotatePage}
                  onMove={movePage}
                  onStart={startOcr}
                />
              ) : (
                <ReviewStage
                  page={activePage}
                  blocks={blocks}
                  selectedBlock={selectedBlock}
                  activeBlock={activeBlock}
                  setActiveBlock={setActiveBlock}
                  transcript={transcript}
                  setTranscript={setTranscript}
                  status={status}
                  wordCount={wordCount}
                  onConfirm={confirmTranscript}
                  onGrade={startGrading}
                />
              )}
            </section>
          </section>

          {report && <Report report={report} />}

          <section className="method" id="method">
            <div>
              <span className="section-index">方法说明</span>
              <h2>先识别事实，再解释得分。</h2>
            </div>
            <ol>
              <li><b>专用 OCR</b><span>保留页序、段落和文字坐标，不直接润色原文。</span></li>
              <li><b>人工确认</b><span>疑似错字必须由你确认，确认稿成为唯一批改输入。</span></li>
              <li><b>逐点找证据</b><span>命中采分点必须引用原文；没有证据就标为遗漏或不确定。</span></li>
            </ol>
          </section>
        </>
      )}

      <footer>
        <span>申论镜 · 内测版</span>
        <span>AI 辅助结果仅供练习复盘，不代表考试官方评分</span>
        <span>隐私说明 · 用户协议 · 删除数据</span>
      </footer>
    </main>
  );
}

function UploadStage({
  pages,
  inputRef,
  onFiles,
  onRemove,
  onRotate,
  onMove,
  onStart,
}: {
  pages: PageImage[];
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFiles: (files: FileList | null) => void;
  onRemove: (id: string) => void;
  onRotate: (id: string) => void;
  onMove: (index: number, delta: number) => void;
  onStart: () => void;
}) {
  return (
    <>
      <div className="panel-heading">
        <div>
          <span className="section-index">02 / 答卷</span>
          <h2>上传手写照片</h2>
        </div>
        <span className="page-limit">{pages.length} / 8 页</span>
      </div>
      <button
        className="drop-zone"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onFiles(event.dataTransfer.files);
        }}
      >
        <span className="upload-mark"><Icon name="upload" /></span>
        <b>{pages.length ? "继续添加答卷照片" : "拖入照片，或点击选择"}</b>
        <small>支持 JPG、PNG、WebP；建议正对纸面、光线均匀、单页不超过 10MB</small>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(event) => onFiles(event.target.files)}
      />
      {pages.length > 0 && (
        <div className="page-strip">
          {pages.map((page, index) => (
            <article className="page-thumb" key={page.id}>
              <span className="page-number">{index + 1}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={page.url} alt={`答卷第 ${index + 1} 页：${page.name}`} style={{ transform: `rotate(${page.rotation}deg)` }} />
              <span className={`quality-badge ${page.quality.issues.length ? "has-issues" : ""}`}>
                {page.quality.issues.length ? `${page.quality.issues.length} 项提醒` : "质量良好"}
              </span>
              <div>
                <button onClick={() => onMove(index, -1)} disabled={index === 0} aria-label="前移">←</button>
                <button onClick={() => onRotate(page.id)} aria-label="旋转">↻</button>
                <button onClick={() => onMove(index, 1)} disabled={index === pages.length - 1} aria-label="后移">→</button>
                <button onClick={() => onRemove(page.id)} aria-label="删除">×</button>
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="panel-footer">
        <p><Icon name="scan" /> 上传前会移除照片定位信息；识别完成后仍需人工校对。</p>
        <BaseButton className="primary-button" onClick={onStart}>
          开始识别 <span>→</span>
        </BaseButton>
      </div>
    </>
  );
}

async function prepareImage(file: File): Promise<{ normalized: Blob; quality: ImageQuality }> {
  const bitmap = await createImageBitmap(file);
  const sampleScale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
  const sample = document.createElement("canvas");
  sample.width = Math.max(1, Math.round(bitmap.width * sampleScale));
  sample.height = Math.max(1, Math.round(bitmap.height * sampleScale));
  const context = sample.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("浏览器无法检查这张图片");
  context.drawImage(bitmap, 0, 0, sample.width, sample.height);
  const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
  let luminanceSum = 0;
  let dark = 0;
  let light = 0;
  let edge = 0;
  let previous = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const luminance = pixels[index] * .299 + pixels[index + 1] * .587 + pixels[index + 2] * .114;
    luminanceSum += luminance;
    if (luminance < 42) dark += 1;
    if (luminance > 242) light += 1;
    if (index > 0) edge += Math.abs(luminance - previous);
    previous = luminance;
  }
  const count = pixels.length / 4;
  const brightness = luminanceSum / count;
  const blurScore = edge / count;
  const darkRatio = dark / count;
  const lightRatio = light / count;
  const issues: ImageQuality["issues"] = [];
  if (Math.min(bitmap.width, bitmap.height) < 1100) issues.push("low_resolution");
  if (blurScore < 11) issues.push("blur");
  if (brightness < 82 || darkRatio > .42) issues.push("underexposed");
  if (brightness > 218 || lightRatio > .58) issues.push("overexposed");
  const ratio = bitmap.width / bitmap.height;
  if (ratio < .5 || ratio > .9) issues.push("page_edge");

  const outputScale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const normalizedCanvas = document.createElement("canvas");
  normalizedCanvas.width = Math.max(1, Math.round(bitmap.width * outputScale));
  normalizedCanvas.height = Math.max(1, Math.round(bitmap.height * outputScale));
  const normalizedContext = normalizedCanvas.getContext("2d");
  if (!normalizedContext) throw new Error("浏览器无法处理这张图片");
  normalizedContext.fillStyle = "#fff";
  normalizedContext.fillRect(0, 0, normalizedCanvas.width, normalizedCanvas.height);
  normalizedContext.drawImage(bitmap, 0, 0, normalizedCanvas.width, normalizedCanvas.height);
  bitmap.close();
  const normalized = await new Promise<Blob>((resolve, reject) =>
    normalizedCanvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("图片规范化失败")),
      "image/jpeg",
      .94,
    ),
  );
  return {
    normalized,
    quality: {
      width: normalizedCanvas.width,
      height: normalizedCanvas.height,
      blurScore: Number(blurScore.toFixed(2)),
      brightness: Number(brightness.toFixed(2)),
      darkRatio: Number(darkRatio.toFixed(4)),
      lightRatio: Number(lightRatio.toFixed(4)),
      issues,
      canContinue: !issues.includes("low_resolution") && !issues.includes("blur"),
    },
  };
}

async function uploadPrivateBlob(blob: Blob, filename: string) {
  const reservation = await readJson<{ uploadUrl: string } & { objectKey: string }>(
    await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, contentType: blob.type || "image/jpeg", size: blob.size }),
    }),
  );
  const uploaded = await readJson<{ objectKey: string }>(
    await fetch(reservation.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": blob.type || "image/jpeg" },
      body: blob,
    }),
  );
  return uploaded.objectKey;
}

async function readJson<T = Record<string, unknown>>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    if (response.status === 401) throw new Error("登录状态已失效，请刷新页面后重新登录");
    throw new Error(body.error || `请求失败（${response.status}）`);
  }
  return body;
}

async function pollSubmission(
  id: string,
  apply: (submission: SubmissionSnapshot) => void,
) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const result = await readJson<{ submission: SubmissionSnapshot }>(
      await fetch(`/api/submissions/${id}`, { cache: "no-store" }),
    );
    apply(result.submission);
    if (["needs_review", "failed"].includes(result.submission.status)) return result.submission;
    await new Promise((resolve) => setTimeout(resolve, Math.min(5000, 1200 + attempt * 120)));
  }
  throw new Error("识别时间超过预期，任务仍保留在后台，可稍后回到历史记录查看");
}

function ReviewStage({
  page,
  blocks,
  selectedBlock,
  activeBlock,
  setActiveBlock,
  transcript,
  setTranscript,
  status,
  wordCount,
  onConfirm,
  onGrade,
}: {
  page?: PageImage;
  blocks: OcrBlock[];
  selectedBlock?: OcrBlock;
  activeBlock: string;
  setActiveBlock: (id: string) => void;
  transcript: string;
  setTranscript: (value: string) => void;
  status: SubmissionStatus;
  wordCount: number;
  onConfirm: () => void;
  onGrade: () => void;
}) {
  const editable = status === "needs_review";
  return (
    <>
      <div className="panel-heading">
        <div>
          <span className="section-index">02 / 校对</span>
          <h2>原图与电子稿</h2>
        </div>
        <span className="confidence">整体可信度 94%</span>
      </div>
      <div className="review-grid">
        <div className="paper-view">
          <div className="paper-toolbar">
            <span>第 1 页 / 共 {Math.max(1, 1)} 页</span>
            <span>点击右侧段落可定位</span>
          </div>
          <div className="paper-canvas">
            {page ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={page.url} alt="当前答卷原图" />
            ) : (
              <div className="demo-paper">
                <i />
                <h3>推进基层治理现代化</h3>
                <p>基层是国家治理的最末端，也是服务群众的最前沿。当前仍存在部门协同不足、服务方式单一等问题……</p>
                <p>因此，应坚持党建引领，完善协同机制，推动资源下沉，让群众诉求得到及时回应。</p>
              </div>
            )}
            {selectedBlock && (
              <span
                className="locator-box"
                style={{
                  left: `${selectedBlock.box.x}%`,
                  top: `${selectedBlock.box.y}%`,
                  width: `${selectedBlock.box.width}%`,
                  height: `${selectedBlock.box.height}%`,
                }}
              />
            )}
            <span className="scan-line" />
          </div>
        </div>
        <div className="transcript-view">
          <div className="transcript-tabs">
            <button className="is-active">电子稿</button>
            <button>疑似项 <b>2</b></button>
            <span>{wordCount} 字</span>
          </div>
          <div className="block-list" aria-label="识别段落定位">
            {blocks.map((block, index) => (
              <button
                key={block.id}
                className={activeBlock === block.id ? "is-active" : ""}
                onClick={() => setActiveBlock(block.id)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{block.text}</p>
                {block.uncertain && <i>待确认</i>}
              </button>
            ))}
          </div>
          <label className="field-label" htmlFor="transcript">确认后的完整电子稿</label>
          <textarea
            id="transcript"
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            readOnly={!editable}
            rows={9}
          />
          <div className="uncertain-note">
            <span>疑似识别</span>
            <p><del>统筹偕同</del> → <b>统筹协同</b></p>
            <small>结合上下文给出候选，不会自动替换</small>
          </div>
        </div>
      </div>
      <div className="panel-footer">
        <p>当前状态：{statusLabels[status]}</p>
        {status === "needs_review" && (
          <BaseButton className="primary-button" onClick={onConfirm}>确认电子稿 <span>→</span></BaseButton>
        )}
        {status === "confirmed" && (
          <BaseButton className="primary-button" onClick={onGrade}>开始循证批改 <span>→</span></BaseButton>
        )}
        {status === "grading" && <BaseButton className="primary-button" disabled>正在批改…</BaseButton>}
        {status === "completed" && <span className="complete-mark">报告已生成 ✓</span>}
      </div>
    </>
  );
}

function Report({ report }: { report: GradingReport }) {
  return (
    <section className="report-section">
      <div className="report-heading">
        <div>
          <span className="section-index">03 / 批改报告</span>
          <h2>不是一个分数，是一组可以复查的判断。</h2>
        </div>
        <div className="score-range">
          <small>建议估分区间</small>
          <strong>{report.scoreRange.min}<i>—</i>{report.scoreRange.max}</strong>
          <span>/ {report.scoreRange.maxScore}</span>
        </div>
      </div>
      <div className="report-grid">
        <article className="dimension-card">
          <h3>四维表现</h3>
          {report.dimensions.map((item) => (
            <div className="dimension-row" key={item.name}>
              <span>{item.name}</span>
              <div><i style={{ width: `${item.percent}%` }} /></div>
              <b>{item.score}/{item.max}</b>
            </div>
          ))}
          <p>本次共 {report.wordCount} 字，处于题目建议范围内。</p>
        </article>
        <article className="evidence-card">
          <h3>采分点证据</h3>
          {report.rubricEvidence.map((item) => (
            <div className={`evidence-row ${item.status}`} key={item.pointId}>
              <span>{item.status === "hit" ? "命中" : item.status === "missed" ? "遗漏" : "待定"}</span>
              <div>
                <b>{item.title}</b>
                <p>{item.evidence ? `“${item.evidence}”` : item.explanation}</p>
              </div>
              <em>+{item.awarded}</em>
            </div>
          ))}
        </article>
        <article className="priority-card">
          <h3>下一次优先改这三件事</h3>
          <ol>
            {report.priorities.map((item, index) => (
              <li key={item}><span>0{index + 1}</span><p>{item}</p></li>
            ))}
          </ol>
          <div className="report-disclaimer">估分存在模型与评分尺度误差；请以证据和修改方向为主。</div>
        </article>
      </div>
    </section>
  );
}

function HistoryView({ onBack }: { onBack: () => void }) {
  return (
    <section className="history-page">
      <div className="history-head">
        <div>
          <span className="eyebrow">PRACTICE ARCHIVE</span>
          <h1>练习不是堆积，<br />而是留下变化。</h1>
        </div>
        <BaseButton className="primary-button" onClick={onBack}>＋ 新建批改</BaseButton>
      </div>
      <div className="history-summary">
        <article><small>累计练习</small><strong>12</strong><span>篇</span></article>
        <article><small>平均估分</small><strong>65.4</strong><span>近 5 次 +4.2</span></article>
        <article><small>采分点覆盖</small><strong>72%</strong><span>较首次 +18%</span></article>
      </div>
      <div className="history-table">
        <div className="history-table-head">
          <span>练习与题型</span><span>状态</span><span>估分</span><span>采分点</span><span>日期</span>
        </div>
        {historyRows.map((row) => (
          <article key={row.id}>
            <div><b>{row.title}</b><small>{row.type}</small></div>
            <span className="complete-mark">已完成</span>
            <strong>{row.score}</strong>
            <span>{row.coverage}</span>
            <time>{row.date}</time>
          </article>
        ))}
      </div>
      <p className="privacy-copy">原始答卷默认保存 30 天；电子稿与报告由你主动删除。演示数据不会上传。</p>
    </section>
  );
}
