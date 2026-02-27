---
name: front-design
description: Creates distinctive, production-grade frontend interfaces for Vue and Element Plus with high design quality. Use when building or refining web components, pages, or applications. Avoids generic AI aesthetics; implements cohesive, memorable UIs with intentional typography, color, motion, and layout.
---

# Front Design

指导 Vue + Element Plus 项目做出**有辨识度、可上线**的前端界面，避免千篇一律的「AI 风格」。

## Design Thinking（先于写码）

动手前明确上下文并选定**明确的美学方向**：

- **Purpose**：界面解决什么问题？谁在用？（如 ConfChain：学术版权存证、验证者/作者）
- **Tone**：选一个鲜明基调并贯彻——极简克制、复古科技、有机/自然、偏编辑/杂志、粗粝/工业、几何/装饰艺术、柔和/低饱和、严肃/可信等。不要「什么都有一点」。
- **Constraints**：技术约束（本项：Vue 3、Element Plus、TypeScript、可访问性）。
- **Differentiation**：让人记住的一点是什么？一个强对比、一句标题、一种动效或一种排版即可。

**关键**：方向清晰并执行到位。极简和极繁都可以——重在**有意图**，而不是堆料。

实现时做到：可上线、功能完整、视觉统一、细节经得起推敲。

## 美学与实现要点

### 字体（Typography）

- 避免通用字体：Arial、Inter、Roboto、系统默认堆砌。
- 选用有性格的字体：标题可用一款有辨识度的 display 字体，正文用清晰易读的 body 字体，形成对比。
- 通过项目全局或主布局引入（如 Google Fonts、本地字体），用 CSS 变量统一 `--font-heading` / `--font-body`。

### 色彩与主题（Color & Theme）

- 确定一套主色 + 少量强调色，避免平均分配、灰扑扑。
- 用 CSS 变量统一管理，并覆盖 Element Plus 变量（`--el-color-primary` 等）以保持组件与自定义风格一致。
- 避免套路：例如白底 + 紫色渐变、无节制的渐变滥用。

### 动效（Motion）

- 优先 CSS：`transition`、`animation`、`animation-delay` 做错落出现（staggered reveal）。
- Vue：`<Transition>` / `<TransitionGroup>` 做进入离开；高价值时刻（如结果页、成功态）可做一次有节奏的动效，胜过到处零散动一下。
- 悬停、焦点状态要有反馈，但克制、符合整体节奏。

### 空间与版式（Spatial Composition）

- 敢于非常规：不对称、留白、打破栅格的元素、对角线或重叠，按 Tone 选择。
- 在 Element 栅格（el-row/el-col）之上用自定义布局和间距做出层次，而不是清一色居中卡片。

### 背景与层次（Backgrounds & Depth）

- 用背景营造氛围：渐变、轻微噪点、几何图案、分层透明、阴影、边框等，与整体 Tone 一致。
- 避免大面积纯白/纯灰无层次；可结合 `--el-bg-color-page` 等变量做浅层区分。

### 禁止的通用套路

- 字体：Inter、Roboto、Arial 等过滥组合；不加选择的系统字体堆砌。
- 配色：白底 + 紫色渐变、无语义的彩虹渐变。
- 版式：千篇一律的居中卡片、同质化组件排布。
- 整体：与业务/受众无关、无明确美学主张的「通用模板」感。

**重要**：实现复杂度要匹配美学目标。极繁需要更完整的动效与细节；极简需要克制的间距、字重与留白。执行到位比堆料更重要。

## 项目技术约定（Vue + Element Plus）

### 原则

- **一致性**：同类操作用同一类组件；主操作 `type="primary"` 等语义统一。
- **层次**：用间距、字号、颜色区分标题、正文、辅助信息。
- **反馈**：加载用 loading、结果用 Message/Notification、危险操作用确认。
- **可访问**：必填标识、错误提示、焦点与键盘可操作。

### 布局

- 栅格：`el-row` / `el-col`，24 栅格；多列表单用 `el-row` 包多组 `el-col`。
- 主区域：`el-main` 或统一容器 class 控制最大宽度与留白。

### 组件选用

| 场景         | 组件 |
|--------------|------|
| 列表、分页   | `el-table` + `el-pagination` |
| 筛选、搜索   | `el-form` 内联 + `el-input` / `el-select` / `el-date-picker` + 查询/重置 |
| 新增/编辑    | `el-dialog` + `el-form`，提交前 `formRef.validate()` |
| 二次确认     | `el-popconfirm` 或 `ElMessageBox.confirm` |
| 轻提示/通知  | `ElMessage`、`ElNotification` |
| 多步骤       | `el-steps` |
| 标签/徽标    | `el-tag`、`el-badge` |

### 响应式

- 表格/列表：`el-col` 的 `:xs/:sm/:md/:lg` 或媒体查询控制列数。
- 弹窗：`el-dialog` 的 `width` 用百分比或 max-width，小屏不溢出。
- 少用固定 px 撑满视口；多用 `min-width`、`max-width`、`overflow-auto`。

### 样式与主题

- 颜色/字号/圆角优先用 Element 变量（如 `var(--el-color-primary)`），再在全局或布局层覆盖为项目变量。
- 自定义样式：`<style scoped>` 或项目公共样式；类名语义化（如 `.page-header`、`.form-actions`）。
- 深色/主题切换：沿用 Element 暗色类或覆盖 CSS 变量。

## 设计自检

- [ ] 主按钮/主链接是否一眼可辨
- [ ] 表单错误是否在字段旁或统一区域有提示
- [ ] 列表空态是否有提示（如 `el-empty`）
- [ ] 加载中是否有 loading 或骨架屏
- [ ] 关键操作是否有确认或撤销
- [ ] 窄屏/移动端是否仍可读、可点
- [ ] 字体、配色、动效是否与既定 Tone 一致、无通用 AI 感

## 输出偏好

- Vue 3 组合式 API（`<script setup>`）+ TypeScript。
- 组件/文件 PascalCase；路由与 URL kebab-case。
- 样式：先复用 Element Plus，再项目公共 class，最后局部样式；覆盖变量时保持与美学方向一致。
