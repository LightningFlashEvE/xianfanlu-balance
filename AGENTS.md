# 仙凡录 — AI 编程约定

## 仓库结构

- `apps/web` — Next.js App Router（**唯一前端**）。UI、Server Actions、Route Handlers。
- `packages/core` — **禁止** React / Prisma / `document`。只放 Zod、数据、rules、calc、export。
- `packages/database` — Prisma schema、seed、client。
- `packages/export-game` — CLI，导出 Unity 用 JSON；复用 `core` 的 `buildBalanceExport`。

## 修改顺序（防字段漂移）

1. 改 `packages/core/src/schemas/*`
2. 改 Prisma schema / seed（若持久化字段变）
3. 改 Server Actions
4. 改 `apps/web` 组件

## 数据访问

- **默认：Server Actions**（`apps/web/src/actions/*.ts`，文件顶行 `'use server'`）
- **仅当** Unity CI / 外部工具需要 HTTP 时，加 `apps/web/src/app/api/*/route.ts`
- Client 组件 **禁止** `import { prisma }`；通过 actions + TanStack Query

## 命名

- 装备/功法稳定 ID：`E001`、`M001`
- 战斗/成长键名与 `core` 中 Zod 一致（如 `attackFlat`，不是 `attack_pct`）
- 新 feature 目录：`apps/web/src/components/features/<name>/`

## 常用命令

```bash
pnpm install
pnpm db:push && pnpm db:seed
pnpm dev
pnpm export:game
```

## 平衡报告与 MiniMax

- `/sandbox/balance-report`：本地 `realmSweep` + 3 种**确定性 bot**（非 LLM）+ 规则预检 + **MiniMax 评审**（`chatMiniMaxForJudge`）。
- 养成/对手 **LLM 代理**（两对战 AI）**未实现**；战力/胜率只走 `packages/core`。
- 评审默认：`json_object` + `reasoning_split` + `max_completion_tokens` 8192（截断重试 16384）；**不默认**关思考；`BALANCE_REPORT_DISABLE_THINKING=1` 仅作解析失败后的额外重试。

## 不要做的事

- 在 `components/features` 里写战力公式
- 复制 `calculatePower` 到 export 脚本
- 在 `core` 里引用 `next/*`
