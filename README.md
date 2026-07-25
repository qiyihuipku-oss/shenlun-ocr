# 申论镜

面向个人考生的手写申论 OCR 与循证批改网站。首版覆盖：

1. 多页答卷上传、排序与旋转。
2. 原图和 OCR 电子稿对照校正。
3. 确认电子稿后，按题目材料与评分点生成区间估分。
4. 每个命中点必须引用考生原文，遗漏和不确定项单独展示。
5. 保存练习记录与文本版本，支持删除原图和报告。

公开主页自带不含真实考生信息的产品演示；批改台只处理真实上传与真实服务结果。

## 两个入口

- `/`：公开产品主页，通过一张动态答卷演示“拍照、识别、循证批改”。
- `/app`：受 ChatGPT 登录保护的批改台。上传和所有数据接口都要求真实登录身份。

工作台不再用前端定时器伪造 OCR。未配置百度密钥时，真实识别任务会明确失败并提示配置，不会返回演示文本。

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
- `PADDLE_OCR_ENDPOINT`：可选，自托管 PaddleOCR HTTP 服务地址。
- `PADDLE_OCR_API_KEY`：可选，Paddle 服务鉴权。
- `OCR_SECONDARY_MODE`：`shadow` 只记录分歧，`assist` 允许严格条件下仲裁，`off` 关闭。

不要把 `.env.local` 发给别人，也不要提交到 Git。

## 常用命令

```powershell
npm run dev       # 本地预览
npm run build     # 生产构建
npm test          # 构建并跑回归测试
npm run lint      # 静态检查
npm run db:generate
npm run golden:evaluate -- tests/golden-set.local.json
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

OCR 上线口径只读取本地匿名黄金集：中位字符准确率至少 93%、至少 80% 样本达到 90%，并且零丢页、零错序。没有真实逐字标注数据时不得宣传准确率。

公网开放真实上传前必须补齐百度/Paddle 凭据、真实匿名答卷黄金集、隐私政策、用户协议、投诉删除入口，并进行合规核查。
