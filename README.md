# 仙凡录数值平衡

Next.js monorepo：境界/装备/功法数值评估、对战沙盘、AI 平衡报告，SQLite 持久化，Unity JSON 导出。

## 环境要求

- Node.js ≥ 20
- pnpm 9（见 `packageManager`）

## 快速开始

```bash
pnpm install
pnpm db:push
pnpm db:seed
pnpm dev
```

浏览器打开 http://localhost:3000

## 页面

| 路由 | 说明 |
|------|------|
| `/` | 宏观境界倍率轴 + 标准养成进度轴；可编辑倍率、主角层级，**重置**恢复 seed |
| `/sandbox` | 手动配装对战、敌方模板、跨境界试算 |
| `/sandbox/balance-report` | 15 境养成扫描、规则预检、人物/装备调整建议、MiniMax 评审（后台生成，可离页） |
| `/manage` | 装备/功法库编辑、合理大境界段 |

## 数值从哪来

样例在 `packages/core/src/data/*.json`，经 **`pnpm db:seed`** 写入 SQLite。评估器、沙盘、报告**读数据库**；只改 JSON 不 seed/重置时界面仍是旧值。

| 类型 | 主要文件 |
|------|----------|
| 境界倍率 | `realms.initial.json` |
| 装备 | `equipment.library.json` |
| 功法 | `manuals.library.json` |
| 主角默认 | `hero.defaults.json` |
| 功法权重等 | `meta.json`（改后无需 seed，重启 dev 即可） |

更完整的调参、报告流程、目标胜率见 **[docs/BALANCE.md](./docs/BALANCE.md)**。

## MiniMax 平衡报告（可选）

```bash
cp apps/web/.env.example apps/web/.env
# 填写 MINIMAX_API_KEY、MINIMAX_REGION（国内账号用 china）
```

未配置 API 时仍可看本地扫描与**规则推导**的人物/装备建议。报告默认超时 **5 分钟**（完整 payload + 思考链），详见 `.env.example`。

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动 Web（默认 http://localhost:3000） |
| `pnpm db:push` | 同步 Prisma schema 到 SQLite |
| `pnpm db:seed` | 从 core JSON 灌库（境界/装备/功法/主角） |
| `pnpm db:studio` | Prisma Studio |
| `pnpm export:game` | 导出 `packages/export-game/out/balance_v2.json` |
| `pnpm lint` | Typecheck `apps/web` |

## 仓库结构

```
apps/web          Next.js UI + Server Actions
packages/core     Zod、公式、养成扫描、平衡报告逻辑
packages/database Prisma + seed
packages/export-game  Unity 导出 CLI
legacy/           旧静态页（勿改，仅对照）
```

## AI 协作

编程约定见 [AGENTS.md](./AGENTS.md)。数值与平衡报告说明见 [docs/BALANCE.md](./docs/BALANCE.md)。
