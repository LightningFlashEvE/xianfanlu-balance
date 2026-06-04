# 仙凡录数值平衡

Next.js 全栈 monorepo：数值评估器 + SQLite（Prisma）+ Unity 导出。

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
| `/` | 两层评估：境界倍率轴 + 标准养成进度轴 |
| `/sandbox` | 对战沙盘与功法实验（手动配装 / 跨境界） |
| `/manage` | 装备、功法数值与「合理境界段」 |

## 脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动 Web |
| `pnpm db:seed` | 灌入境界/装备/功法样例 |
| `pnpm export:game` | 导出 `packages/export-game/out/balance_v2.json` |
| `pnpm db:studio` | Prisma Studio |

## AI 协作

阅读根目录 [AGENTS.md](./AGENTS.md)。
