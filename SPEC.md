# My-IDE 工业级功能规格文档 v1.0

> 调研日期：2026-05-29  
> 目标：将 My-IDE 从"原型级"升级为"工业级"可用 IDE，面向个人重度使用  
> 核心原则：**我的需求最重要** — 个性化优先，不照搬 VS Code，只实现真正用得上的功能

---

## 一、当前状态总结

### 已实现（Phase 1-7 基础）

| 模块 | 实现情况 | 质量评估 |
|---|---|---|
| Rust 后端框架 | ✅ Tauri v2，全命令注册 | 良好 |
| 文件系统（读/写/列/删/改名） | ✅ 基础功能完整 | 良好 |
| Monaco 编辑器 | ✅ 含 tab、保存、语言识别 | 良好 |
| PTY 终端 | ✅ portable-pty + xterm.js | 良好 |
| Git 操作 | ✅ status/diff/add/commit/log | 基础 |
| DeepSeek 流式 API | ✅ SSE + tool calls | 良好 |
| Kimi 视觉 API | ✅ base64 图片 | 良好 |
| AI 工具执行系统 | ✅ read/write/list/run/diff | 基础 |
| 审批模式 / 自主模式 | ✅ write_file 有 diff 审批 | 基础 |
| GitHub Actions CI/CD | ✅ 三平台构建发布 | 良好 |

### 核心缺陷（立即需要修复）

1. **UI 是英文** — 全部需要改成中文
2. **AI 面板位置错误** — 挤在左侧边栏里，空间极小，用户体验差
3. **搜索只搜索已打开文件** — 不是真正的全局文件搜索
4. **run_terminal 只发命令不返回结果** — AI 拿不到命令输出
5. **文件树没有自动刷新** — 外部修改不反映
6. **Git diff 只在 Output 面板显示文本** — 没有可视化

---

## 二、布局重新设计（最高优先级）

### 目标布局：右侧 AI 面板

```
┌─────────────────────────────────────────────────────────────────┐
│  菜单栏：文件  编辑  视图  终端  Git  帮助                        │
├──┬──────────────────────────────────────────┬──────────────────┤
│  │                                          │                  │
│活│  编辑器区域（Monaco，多标签页）            │  AI 聊天面板      │
│动│                                          │  ┌────────────┐  │
│栏│  [index.js ×] [main.rs] [README.md]      │  │ 🤖 DeepSeek│  │
│  │  ──────────────────────────────────────  │  │  Agent     │  │
│  │  1  const express = require('express')   │  ├────────────┤  │
│  │  2  const app = express()                │  │ 对话历史... │  │
│左│  3  ...                                  │  │            │  │
│侧│                                          │  │ [用户消息]  │  │
│边│                                          │  │ [AI回复]   │  │
│栏│                                          │  │ [工具调用]  │  │
│  │                                          │  ├────────────┤  │
│  │                                          │  │ 上下文文件  │  │
├──┴──────────────────────────────────────────│  ├────────────┤  │
│  终端  问题  输出                            │  │ 输入框...  │  │
│  > git status                               │  │    [发送]  │  │
│                                             └──────────────────┤
└─────────────────────────────────────────────────────────────────┘
     左侧边栏：文件树/搜索/SCM/设置（可收起）
```

### 布局参数

- **活动栏**：宽 48px，左侧固定（无 AI 图标，AI 始终在右侧）
- **左侧边栏**：默认 240px，可拖拽调整，可完全收起
- **编辑器区域**：弹性填充中间空间
- **右侧 AI 面板**：默认 360px，可拖拽调整（100px ~ 600px），可完全收起
- **底部面板**：默认 200px，可拖拽调整，可最小化

---

## 三、功能完整性清单

### 3.1 编辑器（Monaco）

#### 现有
- [x] 多标签页（打开/关闭/保存）
- [x] 语言自动识别（30+ 语言）
- [x] Ctrl+S 保存
- [x] 文件脏标记
- [x] 字体/主题配置

#### 需要实现
- [ ] **Ctrl+W 关闭当前标签** — 基础快捷键，缺失很明显
- [ ] **Ctrl+Tab 在标签间切换** — 标准 IDE 功能
- [ ] **Ctrl+` 打开/显示终端** — VS Code 标准
- [ ] **面包屑导航（Breadcrumbs）** — 编辑器顶部显示 `src > js > ide.js`
- [ ] **自动保存开关** — 设置里可配置，保存到 config
- [ ] **Undo 历史跨保存持久化** — Monaco 支持，需配置
- [ ] **Word Wrap 切换按钮** — 状态栏右侧点击切换
- [ ] **代码折叠** — Monaco 内置，需要确认已启用
- [ ] **多游标编辑** — Monaco 内置 Alt+Click
- [ ] **右键菜单（编辑器内）** — 格式化/重命名/复制路径等

#### 非必要（暂不实现）
- LSP 语言服务器（太重，不符合轻量定位）
- Go to Definition（需 LSP）
- 扩展系统

---

### 3.2 文件系统

#### 现有
- [x] 文件树（懒加载展开）
- [x] 右键菜单（新建/删除）
- [x] 读/写文件
- [x] 忽略 node_modules/.git 等

#### 需要实现
- [ ] **工作区状态持久化** — 重启后恢复上次打开的文件夹和标签页
- [ ] **文件监听（fs_watch）** — 外部修改自动刷新文件树和编辑器
- [ ] **文件重命名（Inline 编辑）** — 双击文件名直接改名，不用 prompt()
- [ ] **复制/粘贴文件** — 右键菜单：复制、粘贴
- [ ] **文件路径复制** — 右键"复制相对路径"/"复制绝对路径"
- [ ] **在终端中打开当前文件夹** — 已有，但需要 CI
- [ ] **全局文件搜索（真正的）** — 后端用 ripgrep/walkdir+regex 搜索所有文件，不只搜打开的

#### 全局文件搜索（重要功能）
后端新增 Tauri 命令：
```rust
// fs.rs 新增
search_in_files(cwd: &str, query: &str, case_sensitive: bool) -> Vec<SearchResult>
// SearchResult = { file: String, line: u32, content: String }
```
前端搜索面板：输入框 → 调用后端 → 渲染结果（文件分组，行号，高亮）

---

### 3.3 终端

#### 现有
- [x] PTY 终端（真实 shell）
- [x] 多标签页
- [x] 自动 resize

#### 需要实现
- [ ] **终端标签显示 shell 名** — 当前写死 "bash"，Windows 上应显示 "cmd" 或 "PowerShell"
- [ ] **终端颜色主题** — 跟随 IDE 主题（暗色/亮色）
- [ ] **清空终端按钮** — 终端标签栏右侧加 🗑 按钮
- [ ] **run_terminal 工具返回真实输出** — AI 需要看到命令执行结果
  - 方案：后端新增 `terminal_run_capture(command, cwd)` 命令，执行命令并返回 stdout/stderr

#### 关于 AI 工具的 run_terminal
**当前问题**：`run_terminal` 只是往终端发字符，AI 看不到输出结果。
**修复方案**：新增专用的 `run_capture` 命令：
```rust
// terminal.rs 新增
terminal_run_capture(cwd: &str, command: &str) -> String
// 用 std::process::Command 执行，capture stdout+stderr，返回给 AI
```
AI 工具执行时用 `terminal_run_capture`，不再发到可视终端。

---

### 3.4 Git / 源代码管理

#### 现有
- [x] 文件状态（modified/added/deleted）
- [x] Stage/Unstage
- [x] Commit
- [x] 提交日志

#### 需要实现
- [ ] **Git Diff 可视化** — 点击文件显示 Monaco Diff Editor（左原始/右修改）
- [ ] **分支显示和切换** — 状态栏点击分支名 → 弹出分支选择器
- [ ] **Push/Pull/Fetch** — SCM 面板顶部操作按钮
- [ ] **Stash 操作** — SCM 面板：存储/弹出 stash

#### 非必要（暂不实现）
- Git Blame（逐行显示）
- Merge Conflict 解决器（复杂，暂缓）
- PR 集成

---

### 3.5 AI 聊天面板（右侧，核心功能）

#### 现有
- [x] DeepSeek 流式对话
- [x] Tool calls（读/写/列/diff）
- [x] Kimi 图片分析
- [x] 审批模式 diff 对话框
- [x] 上下文文件

#### 需要实现（按优先级）

**P0 — 立即修复：**
- [ ] **移到右侧面板** — HTML 布局重构，AI 从边栏独立出来
- [ ] **全部中文化** — 所有 UI 文字改中文
- [ ] **run_terminal 返回真实输出** — 见终端章节
- [ ] **会话历史持久化** — 存储到本地文件，重启可恢复/继续

**P1 — 近期实现：**
- [ ] **多会话管理** — 顶部 tab 切换不同对话，每个对话独立历史
- [ ] **Token 计数显示** — 面板底部显示当前会话消耗的 tokens 和估算费用
  - deepseek-chat: 输入 ¥0.27/M tokens，输出 ¥1.10/M tokens
  - deepseek-reasoner(R1): 输入 ¥4/M tokens，输出 ¥16/M tokens
- [ ] **System Prompt 自定义** — 设置里可以自定义 AI 的角色/行为
- [ ] **清空会话按钮** — 顶栏右侧加 🗑 按钮
- [ ] **代码块复制按钮** — AI 回复里代码块右上角加 "复制" 按钮
- [ ] **停止生成按钮** — AI 流式输出时显示 ⏹ 按钮

**P2 — 后续实现：**
- [ ] **AI 内联代码建议（Ghost Text）** — 编辑器内按 Tab 接受 AI 补全
  - 触发：用户停止输入 1s 后，调用 DeepSeek API（FIM 模式或 chat 模式）
  - 显示：Monaco 的 inline suggestions API
- [ ] **选中代码发给 AI** — 编辑器中选中代码，右键"用 AI 解释/优化/改写"
- [ ] **AI 对话导出** — 导出为 Markdown 文件

---

### 3.6 设置面板

#### 现有
- [x] DeepSeek/Kimi API Key
- [x] HTTP 代理
- [x] 模型选择
- [x] 主题/字号

#### 需要实现
- [ ] **字体选择** — 下拉选择 Cascadia Code / Fira Code / JetBrains Mono / Consolas 等
- [ ] **Tab 大小配置** — 2/4 空格
- [ ] **自动保存** — 开关 + 延迟时间（500ms/1s/2s）
- [ ] **Word Wrap** — 开关
- [ ] **AI System Prompt 自定义** — 大文本框
- [ ] **右侧 AI 面板宽度** — 滑块

---

### 3.7 命令面板（Ctrl+P）

#### 当前问题
当前 Ctrl+P 只有命令列表，没有文件模糊搜索。VS Code 的 Ctrl+P 主要用于快速打开文件。

#### 重新设计
- **Ctrl+P** → 文件模糊搜索（全工作区文件名，模糊匹配，最近打开文件优先）
- **Ctrl+Shift+P** → 命令面板（执行命令）
- 文件搜索后端：`fs_find_files(cwd, query)` → 返回匹配的文件路径列表

---

### 3.8 状态栏

#### 当前
分支名 | 打开文件夹 | 模型名 | 语言 | 行列

#### 增强
- 分支名点击 → 弹出分支切换器
- 编码格式（UTF-8）点击 → 换编码
- 行尾符（LF/CRLF）点击 → 切换
- Word Wrap 切换按钮
- AI 模型点击 → 快速切换模型

---

## 四、实现优先级计划

### Sprint 1（立即，~1-2天）— 界面重构 + 中文化

**目标：让用户感受到质的飞跃**

1. **布局重构** — 把 AI 面板从左侧边栏移到右侧独立面板
   - 修改 [src/index.html](src/index.html)：添加 `#ai-panel` 右侧区域
   - 修改 [src/css/app.css](src/css/app.css)：workbench 变为三列（sidebar + editor + ai-panel）
   - 添加右侧面板拖拽 resizer
   - 修改 [src/js/ide.js](src/js/ide.js)：AI 相关 DOM 操作指向新位置

2. **全中文界面** — 所有 UI 文字改中文
   - 菜单栏：文件/编辑/视图/终端/帮助
   - 活动栏 tooltip
   - 面板标签：终端/问题/输出
   - 按钮：保存/提交/发送/应用/拒绝
   - 占位符文字
   - Toast 消息

3. **快捷键补全**
   - Ctrl+W：关闭当前标签
   - Ctrl+Tab：下一个标签
   - Ctrl+`：打开/聚焦终端

### Sprint 2（~2-3天）— 核心功能补完

1. **全局文件搜索** — 后端 `search_in_files`，前端搜索面板完整实现
2. **run_terminal 输出捕获** — `terminal_run_capture` 命令，AI 能看到命令结果
3. **工作区状态持久化** — 记住上次打开的文件夹、已打开标签页
4. **文件监听** — `fs_watch` 命令，文件树和编辑器自动刷新
5. **Git Diff 可视化** — 点击 SCM 文件 → Monaco Diff Editor

### Sprint 3（~2-3天）— AI 能力增强

1. **AI 会话持久化** — 对话历史存本地 JSON
2. **多会话管理** — 顶部切换 tab
3. **Token 计数 + 费用估算** — 面板底部实时显示
4. **停止生成按钮** — 中断 SSE 流
5. **代码块复制按钮** — Markdown 渲染增强

### Sprint 4（~1-2天）— 打磨

1. **Ctrl+P 文件模糊搜索** — 重新设计命令面板
2. **设置面板增强** — 字体选择、Tab 大小、自动保存、AI System Prompt
3. **状态栏增强** — 分支切换、模型切换
4. **右键菜单增强** — 复制路径、在终端打开等
5. **文件重命名 Inline** — 双击改名

---

## 五、Rust 后端新增命令清单

### Sprint 2 需要的新命令

```rust
// fs.rs 新增
fs_search(cwd: &str, query: &str, case_sensitive: bool, regex: bool) -> Vec<SearchResult>
fs_find_files(cwd: &str, pattern: &str) -> Vec<String>  // 用于 Ctrl+P 文件搜索
fs_watch_start(cwd: &str)  // 开始监听目录变化，emit fs_changed 事件
fs_watch_stop(cwd: &str)

// terminal.rs 新增
terminal_run_capture(cwd: &str, command: &str) -> String  // 捕获命令输出给 AI

// git.rs 新增
git_push(cwd: &str) -> String
git_pull(cwd: &str) -> String
git_branches(cwd: &str) -> Vec<String>
git_checkout(cwd: &str, branch: &str) -> String
```

### Sprint 3 需要的新命令
```rust
// config.rs 新增：会话历史持久化
sessions_load() -> Vec<Session>
sessions_save(sessions: Vec<Session>)
workspace_load() -> WorkspaceState  // 记住打开的文件夹+标签
workspace_save(state: WorkspaceState)
```

---

## 六、与 VS Code 的关键区别

| 特性 | VS Code | My-IDE |
|---|---|---|
| AI 对话 | 需要 Copilot 付费插件 | 内置，DeepSeek API（超便宜）|
| AI 图片理解 | 无 | 内置 Kimi Vision |
| AI 面板位置 | 侧边栏（挤） | 右侧独立大面板 |
| 安装包大小 | ~100MB | ~10MB |
| 启动速度 | ~2s | <0.5s |
| 中文界面 | 需插件 | 原生中文 |
| 价格 | 免费+Copilot $10/月 | 免费+按量付费（极低） |
| 扩展生态 | 丰富 | 无（不需要，专注 AI 工作流）|

**My-IDE 的核心定位**：为个人开发者提供 AI 原生的轻量级 IDE，AI 不是插件而是第一公民，中文优先，极致轻量。

---

## 七、技术债务记录

1. **Monaco CDN 依赖** — 无网络时无法加载编辑器。后续可打包到本地（~10MB 额外大小）
2. **xterm.js CDN 依赖** — 同上
3. **`confirm()` 用于确认对话框** — 应改为自定义模态框（已在 run_terminal 的审批中用到）
4. **搜索文件没有防抖** — searchFiles 每次 keydown 都触发，应加 300ms 防抖
5. **AI 对话无法中断** — SSE 流开始后无法取消，需要 AbortController
6. **终端输出编码** — Windows 下 cmd.exe 默认 GBK，可能出现乱码，需要设置 CHCP 65001

---

## 八、DeepSeek API 费用参考

| 模型 | 输入价格 | 输出价格 | 适用场景 |
|---|---|---|---|
| deepseek-chat (V3) | ¥0.27/M tokens | ¥1.10/M tokens | 日常编码对话 |
| deepseek-reasoner (R1) | ¥4/M tokens | ¥16/M tokens | 复杂问题推理 |

典型一天使用 100次对话，每次 2000 tokens：
- V3：约 ¥0.27 × 0.2M = **¥0.054/天**
- R1：约 ¥4 × 0.2M = **¥0.80/天**

---

*文档持续更新，每个 Sprint 完成后更新实现状态*
