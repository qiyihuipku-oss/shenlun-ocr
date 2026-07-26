"use client";

import { useEffect, useRef, useState } from "react";

const scenes = [
  {
    index: "01",
    kicker: "拍下答卷",
    title: "保留纸上的每一笔。",
    body: "上传前先检查清晰度、曝光与页序。原图私密保存，识别从一份可靠的图像开始。",
  },
  {
    index: "02",
    kicker: "还原原文",
    title: "疑难处，交给两次判断。",
    body: "专用手写 OCR 先识别；低置信度行再由第二引擎复核。分歧不会被藏起来，而是留给你确认。",
  },
  {
    index: "03",
    kicker: "看见问题",
    title: "每条评价，都回到原文。",
    body: "确认电子稿后再批改。采分点、遗漏和建议都引用考生原句，不制造所谓官方精确分。",
  },
];

export function LandingPage() {
  const storyRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  const [mobileScene, setMobileScene] = useState(0);

  useEffect(() => {
    let frame = 0;
    let listening = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const compactLayout = window.matchMedia("(max-width: 900px)");

    const update = () => {
      frame = 0;
      const element = storyRef.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const range = Math.max(1, element.offsetHeight - window.innerHeight);
      const nextProgress = Math.max(0, Math.min(1, -rect.top / range));
      setProgress((current) => Math.abs(current - nextProgress) < 0.002 ? current : nextProgress);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    const stopListening = () => {
      if (!listening) return;
      listening = false;
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    };

    const startListening = () => {
      if (listening || reducedMotion.matches || compactLayout.matches) return;
      listening = true;
      addEventListener("scroll", onScroll, { passive: true });
      addEventListener("resize", onScroll, { passive: true });
      onScroll();
    };

    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting ? startListening() : stopListening(),
      { rootMargin: "25% 0px" },
    );
    if (storyRef.current) observer.observe(storyRef.current);

    const onPreferenceChange = () => {
      stopListening();
      if (!reducedMotion.matches && !compactLayout.matches) startListening();
    };
    reducedMotion.addEventListener("change", onPreferenceChange);
    compactLayout.addEventListener("change", onPreferenceChange);

    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener("change", onPreferenceChange);
      compactLayout.removeEventListener("change", onPreferenceChange);
      stopListening();
    };
  }, []);

  const scene = progress < 0.34 ? 0 : progress < 0.68 ? 1 : 2;

  return (
    <main className="landing">
      <header className="landing-header">
        <a className="brand" href="#top">
          <span className="brand-seal">申</span>
          <span><b>申论镜</b><small>SHENLUN MIRROR</small></span>
        </a>
        <nav aria-label="主页导航">
          <a href="#story">识别方法</a>
          <a href="#moat">准确率</a>
          <a href="#evidence">批改原则</a>
        </nav>
        <a className="landing-login" href="/app">进入批改台 <span>↗</span></a>
      </header>

      <section className="landing-intro" id="top">
        <div className="landing-intro-copy">
          <span className="eyebrow">HANDWRITING · EVIDENCE · REVIEW</span>
          <h1>看清你写下的，<br /><em>才知道下一次怎么写。</em></h1>
          <p>面向申论答卷的高准确率 OCR 与循证批改。先把原文认准，再谈得分与改进。</p>
          <div className="landing-actions">
            <a className="landing-primary" href="/app">上传一份答卷 <span>→</span></a>
            <a className="landing-secondary" href="#story">观看完整演示</a>
          </div>
          <div className="landing-trust">
            <span>多页手写识别</span><i />
            <span>疑难行二次复核</span><i />
            <span>原文证据可定位</span>
          </div>
        </div>
        <div className="intro-proof" aria-label="产品能力摘要">
          <span>不是一键改写</span>
          <strong>原图 → 电子稿 → 证据</strong>
          <small>每一步，都可以回看和确认</small>
        </div>
      </section>

      <section
        className={`paper-story scene-${scene}`}
        id="story"
        ref={storyRef}
        style={{ "--story-progress": progress } as React.CSSProperties}
      >
        <div className="story-sticky">
          <div className="story-copy">
            <span className="section-index">一张卷子 · 三次看见</span>
            <div className="story-desktop-copy">
              {scenes.map((item, index) => (
                <article className={scene === index ? "is-active" : ""} key={item.index}>
                  <span>{item.index} / {item.kicker}</span>
                  <h2>{item.title}</h2>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
            <div className="story-mobile-tabs" role="tablist" aria-label="答卷处理阶段">
              {scenes.map((item, index) => (
                <button
                  role="tab"
                  aria-selected={mobileScene === index}
                  className={mobileScene === index ? "is-active" : ""}
                  onClick={() => setMobileScene(index)}
                  key={item.index}
                >
                  {item.index} {item.kicker}
                </button>
              ))}
            </div>
            <article className="story-mobile-panel">
              <h2>{scenes[mobileScene].title}</h2>
              <p>{scenes[mobileScene].body}</p>
            </article>
          </div>

          <div className={`paper-stage mobile-scene-${mobileScene}`} aria-label="答卷识别过程演示">
            <div className="desk-glow" />
            <div className="answer-paper">
              <i className="paper-fold" />
              <div className="paper-title">关于提升基层治理效能的建议</div>
              <div className="handwriting">
                <p><span>一是</span>完善网格化服务机制，推动问题发现在一线、解决在一线。</p>
                <p><span>二是</span>畅通群众参与渠道，形成多元主体协商共治的治理格局。</p>
                <p><span>三是</span>强化数字赋能，但要防止重平台建设、轻实际应用。</p>
                <p><span>四是</span>健全考核反馈，以群众满意度检验治理实际成效。</p>
              </div>
              <div className="ocr-lines" aria-hidden="true">
                <b style={{ top: "28%" }} /><b style={{ top: "42%" }} />
                <b style={{ top: "57%" }} /><b style={{ top: "72%" }} />
              </div>
              <div className="scan-beam" aria-hidden="true" />
              <div className="grading-marks" aria-hidden="true">
                <span className="mark-one">采分点 01</span>
                <span className="mark-two">证据已定位</span>
                <span className="mark-three">疑似遗漏</span>
              </div>
              <div className="score-card">
                <small>建议估分区间</small>
                <strong>14–17</strong><span>/ 20</span>
              </div>
            </div>
            <div className="stage-caption">
              <span>{scene === 0 ? "原始照片" : scene === 1 ? "逐行识别" : "循证批改"}</span>
              <b>{scene === 0 ? "检查清晰度与页序" : scene === 1 ? "低置信度自动显影" : "结论可以回到原句"}</b>
            </div>
          </div>
        </div>
      </section>

      <section className="method-grid" id="moat">
        <div className="method-lead">
          <span className="section-index">准确率不是一句广告</span>
          <h2>把“认得准”，<br />拆成一条可验证的流水线。</h2>
          <p>不展示未经真实答卷验证的准确率。每一次模型或提示词变化，都必须重新通过固定黄金集。</p>
        </div>
        {[
          ["01", "先把照片拍对", "上传即检查模糊、曝光、倾斜与页面缺失，避免把坏图交给模型猜。"],
          ["02", "只复核疑难处", "主引擎识别全卷，第二引擎只看低置信度和分歧行，控制成本与等待时间。"],
          ["03", "让纠错成为资产", "经明确授权的匿名修改进入难例池，沉淀申论场景特有的字迹与政策词混淆。"],
          ["04", "用修改量验真", "除了字符准确率，更关注每百字需要改几处、确认一份答卷要多久。"],
        ].map(([index, title, body]) => (
          <article className="method-card" key={index}>
            <span>{index}</span><h3>{title}</h3><p>{body}</p>
          </article>
        ))}
      </section>

      <section className="evidence-section" id="evidence">
        <div className="evidence-quote">
          <span>“命中采分点”</span>
          <blockquote>“畅通群众参与渠道，形成多元主体协商共治的治理格局。”</blockquote>
          <small>引用考生原文 · 第 2 段</small>
        </div>
        <div>
          <span className="section-index">批改的边界</span>
          <h2>不替你写得更好，<br />先诚实地告诉你写了什么。</h2>
          <p>没有原文证据，就只能标记为遗漏或不确定。分数只给区间，同时保留题目版本、提示词版本与模型运行记录。</p>
          <a className="text-link" href="/app">开始第一次练习 <span>→</span></a>
        </div>
      </section>

      <section className="landing-cta">
        <span className="eyebrow">YOUR NEXT ANSWER STARTS HERE</span>
        <h2>下一次落笔之前，<br />先照见这一次。</h2>
        <a className="landing-primary" href="/app">进入申论镜 <span>→</span></a>
      </section>

      <footer className="landing-footer">
        <a className="brand" href="#top"><span className="brand-seal">申</span><span><b>申论镜</b><small>SHENLUN MIRROR</small></span></a>
        <p>AI 辅助识别与批改，不代表官方评分。原图默认保存 30 天，可随时删除。</p>
        <span>邀请码内测 · 2026</span>
      </footer>
    </main>
  );
}
