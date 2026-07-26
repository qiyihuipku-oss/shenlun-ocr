import type { Metadata } from "next";
import Link from "next/link";
import { safeRelativeReturnPath } from "../chatgpt-auth";

export const metadata: Metadata = {
  title: "邀请码登录",
  description: "使用申论镜内测邀请码进入手写 OCR 与循证批改工作台。",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; return_to?: string }>;
}) {
  const params = await searchParams;
  const returnTo = safeRelativeReturnPath(params.return_to || "/app");
  const message =
    params.error === "invalid"
      ? "邀请码不正确，请检查后重试。"
      : params.error === "config"
        ? "内测登录尚未完成服务端配置。"
        : null;

  return (
    <main className="auth-page">
      <Link className="brand" href="/">
        <span className="brand-seal">申</span>
        <span><b>申论镜</b><small>SHENLUN MIRROR</small></span>
      </Link>
      <section className="auth-card">
        <span className="eyebrow">PRIVATE BETA</span>
        <h1>进入批改台</h1>
        <p>输入内测邀请码。登录状态只保存在当前浏览器中，有效期为 7 天。</p>
        {message ? <div className="auth-error" role="alert">{message}</div> : null}
        <form action="/api/auth/login" method="post">
          <input type="hidden" name="returnTo" value={returnTo} />
          <label htmlFor="inviteCode">邀请码</label>
          <input
            id="inviteCode"
            name="inviteCode"
            type="password"
            autoComplete="one-time-code"
            required
            maxLength={128}
            placeholder="请输入邀请码"
          />
          <button className="landing-primary" type="submit">验证并进入 <span>→</span></button>
        </form>
        <small>答卷原图默认保留 30 天；拒绝授权不影响识别与批改。</small>
      </section>
    </main>
  );
}
