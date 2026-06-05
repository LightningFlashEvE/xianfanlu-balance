# 仙凡录系统设定

本文记录当前数值与系统设计口径，避免后续实现时把玩法维度混在一起。

## 功法

- 功法不设物品品阶，不参与掉落、锻造、升品链。
- 功法的定位是修炼路线与技法组合，核心字段为 `type`、`rank`、`maxRealm`、`proficiency`。
- `rank` 表示功法体系层级，例如凡阶、江湖、先天、炼气、筑基、金丹。
- `maxRealm` 表示标准养成最多可累计到哪个细境界。
- `proficiency` 只影响效果缩放，权重由 `meta.json` 的 `manualBalance.proficiencyEffectWeight` 控制。

### 标准养成功法上限

标准养成不会把所有已解锁功法无限累计，而是按“主修路线 + 战斗技法”选择有限组合。

默认分组：

| 分组 | 识别口径 | 默认上限 |
|------|----------|----------|
| 主修功法 | 内功、修仙功法、过渡功法等 | 1 |
| 身法 | 轻功、身法、步法 | 1 |
| 武技 | 剑法、刀法、枪法、棍法、拳法、暗器 | 2 |
| 术法 | 诀、术、法类非主修条目 | 2 |
| 通用 | 未归入上述类别 | 1 |

按大期总上限：

| 大期 | 标准养成功法上限 |
|------|------------------|
| 凡俗期 | 1 |
| 江湖期 | 3 |
| 宗师期 | 4 |
| 先天期 | 4 |
| 炼气期 | 5 |
| 筑基期 | 5 |
| 金丹期 | 6 |

配置入口：`packages/core/src/data/meta.json` 的 `manualBalance.milestoneMaxManualsByBand` 与 `manualBalance.milestoneManualGroupCaps`。

## 物品

- 物品保留 `quality`，品阶属于物品成长链，不属于功法。
- 后续掉落、锻造、升品、词条成长围绕同源物品展开。
- 同一个物品的不同品阶建议使用不同稳定 ID，但共用 `baseId`。

物品生命周期字段：

| 字段 | 作用 |
|------|------|
| `baseId` | 同源物品 ID，用于升品和成长链追踪 |
| `quality` | 当前品阶 |
| `dropTags` | 掉落池、区域、敌人或玩法来源标签 |
| `forgeTags` | 锻造配方、材料路线或工坊标签 |
| `upgradeTier` | 同源物品成长阶数 |
| `affixSlots` | 可承载词条槽数量 |
| `affixTags` | 可生成或成长的词条池标签 |

## 破境守门

破境守门是玩家当前境界挑战下一细境界门槛，不再复用沙盘当前敌方倍率。

- 守门敌人境界：下一细境界。
- 守门敌人装备：下一境界标准穿戴装 + 少量守门专用背包外物。
- 敌方模板不携带机缘物；机缘物只服务玩家探索、资源与养成收益。
- 低于炼气期的敌人不能携带符箓或傀儡；这些属于进入修行体系后的外物。
- 守门敌人功法：同样使用标准养成功法上限。
- 守门敌人倍率：按下一境界所属大期读取 `breakthroughGateTemplateScale`。
- 报告目标：胜率 38%–72%。

配置入口：`packages/core/src/data/sandbox-enemy-presets.ts` 的 `breakthroughGateTemplateScale` 与 `breakthroughGateBagItemLimit`。

## 章节 BOSS

章节 BOSS 与破境守门是不同模板：

- 章节 BOSS 守方境界按主角当前细境界动态上抬。
- 若主角已在大期末尾，则 BOSS 可进入下一大期入门境。
- 章节 BOSS 可携带更完整的同阶段外物。
- 章节 BOSS 不携带机缘物。
- 章节 BOSS 同样遵守低于炼气期不携带符箓/傀儡的敌方装配门槛。
- 章节 BOSS 使用 `chapterBossTemplateScale`。
- 报告目标：胜率 25%–55%。

## 调整数值入口

| 目标 | 首选文件 |
|------|----------|
| 境界倍率 | `packages/core/src/data/realms.initial.json` |
| 物品数量、品阶、成长链字段 | `packages/core/src/data/equipment.library.json` |
| 功法条目、等阶、可修至境界 | `packages/core/src/data/manuals.library.json` |
| 功法累计上限和熟练度权重 | `packages/core/src/data/meta.json` |
| 破境守门与章节 BOSS 模板 | `packages/core/src/data/sandbox-enemy-presets.ts` |

改 JSON 后需要执行 `pnpm db:seed`，或在评估器中重置，才能同步到 SQLite。
