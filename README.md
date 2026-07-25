# 申论镜

面向个人考生的手写申论 OCR 与循证批改网站。首版覆盖：

1. 多页答卷上传、排序与旋转。
2. 原图和 OCR 电子稿对照校正。
3. 确认电子稿后，按题目材料与评分点生成区间估分。
4. 每个命中点必须引用考生原文，遗漏和不确定项单独展示。
5. 保存练习记录与文本版本，支持删除原图和报告。

当前界面自带完整演示数据。没有配置云密钥时仍可体验所有交互；配置百度 OCR 与千帆 API 后，服务端适配器会调用真实能力。

## 小白快速开始

双击或右键运行：

```powershell
.\scripts\start-local.ps1
```

浏览器打开脚本显示的本地地址。修改页面后会自动刷新。

需要真实 OCR 时，把 `.env.example` 复制为 `.env.local`，仅在本机填写：

- `BAIDU_OCR_API_KEY`
- `BAIDU_OCR_SECRET_KEY`
- `QIANFAN_API_KEY`
- `GRADING_MODEL`

不要把 `.env.local` 发给别人，也不要提交到 Git。

## 常用命令

```powershell
npm run dev       # 本地预览
npm run build     # 生产构建
npm test          # 构建并跑回归测试
npm run lint      # 静态检查
npm run db:generate
```

## 目录地图

- `app/`：页面、样式和 HTTP API。
- `lib/types.ts`：OCR 与批改报告的数据契约。
- `lib/providers.ts`：OCR、存储和模型供应商接口。
- `lib/server.ts`：服务端数据读写与结构化批改。
- `db/schema.ts`、`drizzle/`：持久化表结构与迁移。
- `tests/`：页面、接口和批改约束回归。
- `docs/`：小白操作、系统结构和修改示例。

更详细说明见 [小白操作手册](docs/小白操作手册.md) 与 [系统地图](docs/系统地图.md)。

## 部署

- Sites 预览：使用 `.openai/hosting.json` 中的 D1 与 R2 逻辑绑定。
- 中国大陆正式环境：准备已备案域名后，按 `docker-compose.production.yml` 部署到腾讯云；正式迁移到 PostgreSQL/COS 时沿用 `StorageProvider`、`OcrProvider` 和 `GradingProvider` 接口。

公网开放前必须补齐真实匿名答卷黄金集、隐私政策、用户协议、投诉删除入口，并进行合规核查。
