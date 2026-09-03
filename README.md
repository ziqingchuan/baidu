# 度厂观测站

基于 iCode（代码评审/提交）与 iCafe（需求卡片）真实数据生成的产出看板，用于记录个人产出、按工作大类归类、沉淀每件事的收获与反思。适合实习转正汇报、年终总结的场景。

## 技术栈

- React 19 + TypeScript + Vite 8 + pnpm
- Ant Design 6 + ECharts 6 + dnd-kit（拖拽归类）

## 核心交互

- **产出看板**：把归并后的每件事（卡片/CR/提交）自动分类到五大工作大类——功能实现 / 用户体验 / 工作提效 / Bug修复 / 工程建设
- **拖拽归类**：拖动卡片到任一分类即可手动归类（dnd-kit），分类结果自动持久化到 localStorage
- **难度打分 + 反思**：点击卡片可对每件事打难度分（1-5 星）并写总结反思
- **导出数据**：一键导出为 Markdown，按分类组织，直接用于汇报

## 快速开始

```bash
pnpm install

# 1. 拉取真实数据（需已登录 icode-cli 与 icafe-cli）
pnpm export-data

# 2. 本地开发
pnpm dev

# 3. 生产构建
pnpm build
```

## 数据流向

```
icode-cli (get_my_reviews / get_person_commit)
icafe-cli (space tree / card query 负责人=currentUser)
        │
        ▼
scripts/export-data.ts   ← 拉取 + 聚合清洗 + 按空间分页拉全卡片
        │
        ▼
src/data/dashboard.json  ← 快照（进 git，可离线）
        │
        ▼
React 前端渲染看板与图表（分类/打分/反思存 localStorage，可导出）
```

- 数据为**快照**：更新时重新运行 `pnpm export-data`
- 卡片获取：遍历 `space tree` + 从 CR/commit 前缀反推空间（覆盖 dodo、bunnydo、DevOps-iScan 等），每个空间分页拉全 `负责人 = currentUser` 的卡片

## 看板结构

| 视图 | 内容 |
|---|---|
| 产出看板 | 五列工作大类，卡片可拖拽归类，点击打分/反思 |
| 数据图表 | 任务分类分布、月度任务占比、任务平均难度、月度代码量 |

