# 仙凡录 — AI 编程约定

## 仓库结构

| 路径 | 职责 |
|------|------|
| `apps/web` | Next.js App Router（**唯一前端**）。UI、Server Actions、Route Handlers |
| `packages/core` | Zod、JSON 样例、`calc/`、`rules/`、export。**禁止** React / Prisma / `document` |
| `packages/database` | Prisma schema、seed、client |
| `packages/export-game` | CLI → Unity JSON，复用 `buildBalanceExport` |
| `docs/BALANCE.md` | 数值调参、平衡报告、MiniMax、数据流（给人看） |

## 修改顺序（防字段漂移）

1. `packages/core/src/schemas/*`
2. Prisma schema / `seed-data.ts`（持久化字段变时）
3. `apps/web/src/actions/*`
4. `apps/web/src/components/features/**`

## 数据访问

- 默认 **Server Actions**（`'use server'`）
- Client **禁止** `import { prisma }` / `@xianfanlu/database`
- 仅 Unity CI 等需要时加 `apps/web/src/app/api/*/route.ts`

## 命名

- 稳定 ID：`E001`、`M001`
- 战斗键名与 core Zod 一致（`attackFlat`，非 `attack_pct`）
- 新 UI：`apps/web/src/components/features/<name>/`

## 常用命令

```bash
pnpm install
pnpm db:push && pnpm db:seed
pnpm dev
pnpm export:game
```

## 平衡报告（实现索引）

产品说明见 [docs/BALANCE.md](./docs/BALANCE.md)。代码要点：

| 模块 | 路径 |
|------|------|
| 报告 payload / 规则 | `packages/core/src/rules/balance-report.ts` |
| 章节 BOSS 守方 | `resolveChapterBossDefenderRealm` in `sandbox-enemy-preset.ts` |
| BOSS scale 配置 | `packages/core/src/data/sandbox-enemy-presets.ts` |
| 规则推导建议 | `packages/core/src/rules/balance-adjustment-hints.ts` |
| AI 评审 schema | `packages/core/src/schemas/balance-report.ts` |
| 后台任务 + MiniMax | `apps/web/src/actions/sandbox-balance-report.ts` |
| MiniMax 客户端 | `apps/web/src/lib/minimax.ts`（`chatMiniMaxForJudge`） |
| 缓存 | Prisma `BalanceReportCache` id=1 |

- 送审 **`buildBalanceReportAiInput`**（完整 payload + `ruleFlags` + hints），非精简版。
- 破境守门目标 38–72%；章节 BOSS 25–55%（`CHAPTER_BOSS_HIGH = 0.55`）。
- 超时：`BALANCE_REPORT_REQUEST_TIMEOUT_MS` 默认 300000。
- 评审：`json_object` + `reasoning_split`，默认开思考；`BALANCE_REPORT_DISABLE_THINKING=1` 仅解析失败后重试。
- 养成/对手 LLM 代理 **未实现**。
- 无「推荐倍率」；境界以 `realms.initial.json` + seed 为准。

## 调数值时只改这些（勿动公式）

- `realms.initial.json`、`equipment.library.json`、`manuals.library.json`
- `hero.defaults.json`、`meta.json`
- `sandbox-enemy-presets.ts`（含 `chapterBossTemplateScale`）
- `enemyTemplateScale` 默认 0.88：`schema.prisma` + `seed-data.ts` + `state.ts` 回退

改 JSON 后提醒用户 **`pnpm db:seed`** 或评估器 **重置**。

## 不要做的事

- 在 `components/features` 写战力公式
- 复制 `calculatePower` / `simulateDuel` 到 export 或 web
- 在 `core` 引用 `next/*`
- 改 `legacy/`（除非对照迁移）
- 提交 `.env`、`*.db`
