# My IDE（DeepSeek IDE）

> 基于 DeepSeek API 驱动的 AI 原生 IDE，使用 Tauri v2 构建，轻量、快速、跨平台。

![GitHub Actions](https://github.com/chenpipi0807/My-IDE/actions/workflows/release.yml/badge.svg)

## 功能特性

- **Monaco 编辑器** — 与 VS Code 同款编辑器内核，支持语法高亮、智能补全
- **真实文件系统** — 直接读写本地文件，文件树实时刷新
- **集成终端** — 原生 PTY 终端，支持 Windows/macOS/Linux
- **AI 对话面板** — DeepSeek 流式输出，支持 Function Calling / Tool Use
- **多 AI 模式**
  - 🧑‍💻 **Code** — 代码生成与修改
  - 🏗️ **Architect** — 架构设计，可写入 `.plan/` 规划文档
  - ❓ **Ask** — 代码问答，只读不改
  - 🐞 **Debug** — 系统性 Debug
  - 🪃 **Orchestrator** — 指挥官模式，自动拆解任务并调度子 AI 执行
- **Diff 审批流** — AI 修改文件前展示 diff，手动确认后再写入
- **图片 / SVG 预览** — 零冻结，异步解码不阻塞主线程
- **深色 Carbon 主题** — 精心调配的分层灰阶配色

## 安装

前往 [Releases](https://github.com/chenpipi0807/My-IDE/releases) 页面下载对应平台的安装包：

| 平台 | 文件 |
|------|------|
| Windows | `.msi` 或 `.exe` |
| macOS (Intel) | `.dmg` |
| macOS (Apple Silicon) | `.dmg` |
| Linux | `.AppImage` 或 `.deb` |

## 首次配置

安装后打开设置（`Ctrl+,` 或点击左侧活动栏 ⚙ 图标）：

1. 填写 **DeepSeek API Key**（在 [platform.deepseek.com](https://platform.deepseek.com) 获取）
2. 可选：填写代理地址（如 `http://127.0.0.1:7890`）
3. 选择模型（推荐 `deepseek-chat`）

## 本地开发

**环境要求**
- Rust 1.77+（`rustup update stable`）
- Node.js 18+
- Windows：需安装 WebView2 Runtime（Win11 已内置）
- Linux：需安装 `libwebkit2gtk-4.1-dev` 等依赖（见下方）

```bash
# 克隆仓库
git clone https://github.com/chenpipi0807/My-IDE.git
cd My-IDE

# 安装 Node 依赖
npm install

# 启动开发模式（热重载）
npm run dev

# 构建发布版本
npm run build
```

**Linux 额外依赖**

```bash
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev \
  patchelf libglib2.0-dev pkg-config libgtk-3-dev \
  libsoup-3.0-dev libjavascriptcoregtk-4.1-dev
```

## 项目结构

```
My-IDE/
├── src/                  # 前端（HTML + JS + CSS）
│   ├── index.html
│   ├── js/ide.js         # 核心逻辑（编辑器、AI 对话、工具调用）
│   └── css/app.css       # Dark Carbon 主题样式
├── src-tauri/            # Rust 后端
│   ├── src/
│   │   ├── main.rs       # Tauri 入口 + 命令注册
│   │   ├── fs.rs         # 文件系统操作
│   │   ├── terminal.rs   # PTY 终端
│   │   ├── git.rs        # Git 状态 / diff / 提交
│   │   ├── config.rs     # 配置持久化
│   │   └── ai/
│   │       └── deepseek.rs  # DeepSeek 流式 API 客户端
│   └── tauri.conf.json
└── .github/workflows/
    └── release.yml       # 三平台自动构建 & Release
```

## 技术栈

- **Tauri v2** — Rust 后端 + WebView 前端，安装包 ~10MB
- **Monaco Editor** — 微软开源编辑器内核
- **DeepSeek API** — 代码生成 / Function Calling
- **portable-pty** — 跨平台 PTY 终端
- **reqwest** — 异步 HTTP 客户端（流式 SSE 解析）

## License

MIT
