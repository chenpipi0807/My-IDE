// My IDE — 前端主逻辑
// 使用 window.__TAURI__（tauri.conf.json 中配置了 withGlobalTauri: true）

const invoke = (...args) => window.__TAURI__.core.invoke(...args);
const listen = (...args) => window.__TAURI__.event.listen(...args);

// ── 语言映射 ──────────────────────────────────────────────────────────────────
const LANG_MAP = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript', mts: 'typescript',
    py: 'python', pyw: 'python',
    go: 'go', rs: 'rust', java: 'java', kt: 'kotlin', swift: 'swift',
    cpp: 'cpp', cc: 'cpp', cxx: 'cpp', c: 'c', h: 'cpp', hpp: 'cpp',
    html: 'html', htm: 'html', xml: 'xml', svg: 'xml',
    css: 'css', scss: 'scss', sass: 'scss', less: 'less',
    json: 'json', jsonc: 'json', json5: 'json',
    yaml: 'yaml', yml: 'yaml', toml: 'toml',
    md: 'markdown', markdown: 'markdown',
    sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
    ps1: 'powershell', bat: 'bat', cmd: 'bat',
    sql: 'sql', lua: 'lua', r: 'r', rb: 'ruby',
    dockerfile: 'dockerfile', makefile: 'makefile',
    ini: 'ini', env: 'ini',
};
function langFromPath(path) {
    const name = path.replace(/\\/g, '/').split('/').pop().toLowerCase();
    if (name === 'dockerfile') return 'dockerfile';
    if (name === 'makefile') return 'makefile';
    return LANG_MAP[name.split('.').pop()] || 'plaintext';
}

// ── 媒体文件类型检测 ───────────────────────────────────────────────────────────
const MEDIA_MIME = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', bmp: 'image/bmp', ico: 'image/x-icon', avif: 'image/avif',
    tiff: 'image/tiff', tif: 'image/tiff', svg: 'image/svg+xml',
    mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    avi: 'video/x-msvideo', ogv: 'video/ogg', mkv: 'video/x-matroska',
    mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
    flac: 'audio/flac', aac: 'audio/aac', m4a: 'audio/mp4', opus: 'audio/ogg',
};
function mediaMime(name) {
    const ext = name.replace(/\\/g, '/').split('/').pop().toLowerCase().split('.').pop();
    return MEDIA_MIME[ext] || null;
}
function isImage(mime) { return mime?.startsWith('image/'); }
function isVideo(mime) { return mime?.startsWith('video/'); }
function isAudio(mime) { return mime?.startsWith('audio/'); }

// ── 文件图标 ─────────────────────────────────────────────────────────────────
function fileIcon(name, isDir) {
    if (isDir) return '📁';
    const ext = name.split('.').pop().toLowerCase();
    const icons = {
        js: '🟨', jsx: '⚛', ts: '🔷', tsx: '⚛', py: '🐍', go: '🐹',
        rs: '🦀', java: '☕', kt: '🟣', swift: '🧡',
        html: '🌐', css: '🎨', scss: '🎨', json: '📋', yaml: '📋', yml: '📋',
        toml: '📋', md: '📝', sql: '🗃', sh: '🐚', bat: '⚙', ps1: '🔵',
        dockerfile: '🐳', png: '🖼', jpg: '🖼', jpeg: '🖼', gif: '🖼', svg: '🖼',
        pdf: '📄', zip: '📦', tar: '📦', gz: '📦', lock: '🔒',
    };
    return icons[ext] || '📄';
}

// ── Markdown 渲染 ─────────────────────────────────────────────────────────────
function renderMarkdown(text) {
    if (!text) return '';
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const inline = s => s
        .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
        .replace(/~~([^~]+)~~/g, '<del>$1</del>')
        .replace(/`([^`\n]+)`/g, '<code>$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    const lines = text.split('\n');
    const out = [];
    let i = 0;
    let inList = false;

    const flushList = () => { if (inList) { out.push('</ul>'); inList = false; } };

    while (i < lines.length) {
        const raw = lines[i];

        // 代码块
        if (raw.startsWith('```')) {
            flushList();
            const lang = esc(raw.slice(3).trim());
            const codeLines = [];
            i++;
            while (i < lines.length && !lines[i].startsWith('```')) {
                codeLines.push(esc(lines[i]));
                i++;
            }
            out.push(`<pre data-lang="${lang}" style="position:relative"><button class="copy-code-btn" onclick="IDE.copyCode(this)">复制</button><code class="lang-${lang}">${codeLines.join('\n')}</code></pre>`);
            i++;
            continue;
        }

        // 标题
        const hMatch = raw.match(/^(#{1,3}) (.+)/);
        if (hMatch) {
            flushList();
            const level = hMatch[1].length;
            out.push(`<h${level}>${inline(esc(hMatch[2]))}</h${level}>`);
            i++; continue;
        }

        // 水平线
        if (/^[-*_]{3,}$/.test(raw.trim())) {
            flushList();
            out.push('<hr>');
            i++; continue;
        }

        // 无序列表
        if (/^[-*] /.test(raw)) {
            if (!inList) { out.push('<ul>'); inList = true; }
            out.push(`<li>${inline(esc(raw.slice(2)))}</li>`);
            i++; continue;
        }

        // 有序列表
        if (/^\d+\. /.test(raw)) {
            if (!inList) { out.push('<ul>'); inList = true; }
            out.push(`<li>${inline(esc(raw.replace(/^\d+\. /, '')))}</li>`);
            i++; continue;
        }

        // 引用
        if (raw.startsWith('> ')) {
            flushList();
            out.push(`<blockquote>${inline(esc(raw.slice(2)))}</blockquote>`);
            i++; continue;
        }

        // 空行
        if (raw.trim() === '') {
            flushList();
            out.push('<br>');
            i++; continue;
        }

        // 普通段落
        flushList();
        out.push(`<p>${inline(esc(raw))}</p>`);
        i++;
    }
    flushList();
    return out.join('');
}

// ── IDE 主类 ─────────────────────────────────────────────────────────────────
class IDEApp {
    constructor() {
        this.monaco = null;
        this.editors = new Map();       // path → monaco editor
        this.tabs = [];                 // [{path, name, dirty}]
        this.activeTab = null;
        this.openedFolder = null;
        this.expandedDirs = new Set();
        this.fileTree = null;

        this.terminals = new Map();     // id → {term, fitAddon, container, tabEl}
        this.activeTerminal = null;

        this.config = {};
        this.agentMode = 'approval';
        this.sessions = [{ id: 0, name: '对话 1', messages: [], tokens: 0 }];
        this.activeSession = 0;
        this.aiListeners = [];
        this.aiStreaming = false;
        this.aiAbortController = null;
        this.attachedImage = null;
        this.contextFiles = [];

        this.diffEditor = null;
        this.pendingDiff = null;

        this.cmdItems = [];
        this.cmdSelectedIdx = 0;

        this.wordWrap = false;
        this.panelMinimized = false;

        this.init();
    }

    async init() {
        try {
            this.config = await invoke('config_load');
        } catch {
            this.config = {
                theme: 'vs-dark', font_size: 14, font_family: 'Cascadia Code,Fira Code,Consolas,monospace',
                tab_size: 4, auto_save: false, word_wrap: false,
                agent_mode: 'approval', deepseek_model: 'deepseek-v4-flash',
                deepseek_api_key: '', kimi_api_key: '', proxy: '',
                system_prompt: '',
            };
        }
        this.agentMode = this.config.agent_mode || 'approval';
        this.wordWrap = this.config.word_wrap || false;
        this.applyTheme();
        this.initUI();
        await this.initMonaco();
        await this.initFirstTerminal();
        // 恢复上次工作区
        await this.restoreWorkspace();
        this.updateAIPanelState();
        document.getElementById('loadingScreen').style.display = 'none';
        this.log('My IDE 已就绪。');
    }

    // ── 主题 ──────────────────────────────────────────────────────────────────
    applyTheme() {
        document.body.classList.toggle('theme-light', this.config.theme === 'vs');
    }

    // ── Monaco ────────────────────────────────────────────────────────────────
    initMonaco() {
        return new Promise((resolve) => {
            const tryLoad = () => {
                if (window.__monacoFailed) { resolve(); return; }
                if (!window.require) { setTimeout(tryLoad, 100); return; }
                require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });
                require(['vs/editor/editor.main'], (monaco) => {
                    this.monaco = monaco;
                    monaco.editor.defineTheme('my-dark', {
                        base: 'vs-dark', inherit: true,
                        rules: [], colors: { 'editor.background': '#1e1e1e' }
                    });
                    resolve();
                });
            };
            tryLoad();
        });
    }

    createEditor(path, content) {
        if (this.editors.has(path)) return this.editors.get(path);
        const container = document.getElementById('editorContainer');
        const div = document.createElement('div');
        div.className = 'editor-instance';
        div.dataset.path = path;
        container.appendChild(div);

        if (!this.monaco) {
            div.style.cssText = 'padding:16px;font-family:monospace;font-size:13px;white-space:pre-wrap;overflow:auto';
            div.textContent = content;
            this.editors.set(path, { type: 'fallback', el: div, getValue: () => div.textContent, setValue: v => { div.textContent = v; } });
            return this.editors.get(path);
        }

        const model = this.monaco.editor.createModel(content, langFromPath(path), this.monaco.Uri.file(path));
        const editor = this.monaco.editor.create(div, {
            model,
            theme: this.config.theme === 'vs' ? 'vs' : 'my-dark',
            fontSize: this.config.font_size || 14,
            fontFamily: this.config.font_family || '"Cascadia Code","Fira Code",Consolas,monospace',
            fontLigatures: true,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            renderLineHighlight: 'line',
            wordWrap: this.wordWrap ? 'on' : 'off',
            tabSize: this.config.tab_size || 4,
            insertSpaces: true,
            suggestOnTriggerCharacters: true,
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true },
        });

        editor.onDidChangeCursorPosition(() => {
            const pos = editor.getPosition();
            document.getElementById('statusCursor').textContent =
                `第 ${pos.lineNumber} 行，第 ${pos.column} 列`;
        });
        editor.onDidChangeModelContent(() => {
            const tab = this.tabs.find(t => t.path === path);
            if (tab && !tab.dirty) { tab.dirty = true; this.renderTabs(); }
            if (this.config.auto_save) {
                clearTimeout(this._autoSaveTimer);
                this._autoSaveTimer = setTimeout(() => this.saveFile(path), 1000);
            }
        });
        editor.addCommand(this.monaco.KeyMod.CtrlCmd | this.monaco.KeyCode.KeyS, () => this.saveFile(path));
        editor.addCommand(this.monaco.KeyMod.CtrlCmd | this.monaco.KeyCode.KeyW, () => this.closeTab(path));

        this.editors.set(path, editor);
        return editor;
    }

    // ── 文件操作 ──────────────────────────────────────────────────────────────
    async openFolderDialog() {
        try {
            const { open } = window.__TAURI__.dialog;
            const selected = await open({ directory: true, multiple: false });
            if (!selected) return;
            await this.loadFolder(typeof selected === 'string' ? selected : selected[0]);
        } catch (e) {
            this.toast(`打开文件夹失败: ${e}`, 'error');
        }
    }

    async loadFolder(folderPath) {
        this.openedFolder = folderPath.replace(/\\/g, '/');
        document.getElementById('statusFolder').textContent = this.openedFolder.split('/').pop();
        await this.loadFileTree();
        await this.refreshGit();
        this.saveWorkspace();
        this.toast(`已打开: ${this.openedFolder}`, 'success');
    }

    async loadFileTree() {
        if (!this.openedFolder) return;
        try {
            this.fileTree = await invoke('fs_list_dir', { path: this.openedFolder });
            this.renderFileTree();
        } catch (e) {
            this.toast(`加载文件树失败: ${e}`, 'error');
        }
    }

    renderFileTree() {
        const container = document.getElementById('fileTree');
        container.innerHTML = '';
        if (!this.fileTree) return;
        if (this.fileTree.children) {
            this.fileTree.children.forEach(child => this.renderTreeNode(child, container, 0));
        }
    }

    renderTreeNode(node, container, depth) {
        const item = document.createElement('div');
        item.className = 'tree-item';
        item.style.paddingLeft = `${12 + depth * 16}px`;

        const toggle = document.createElement('span');
        toggle.className = 'tree-toggle';
        const icon = document.createElement('span');
        icon.className = 'tree-icon';
        const label = document.createElement('span');
        label.className = 'tree-label';
        label.textContent = node.name;

        if (node.is_dir) {
            const isExpanded = this.expandedDirs.has(node.path);
            toggle.textContent = isExpanded ? '▼' : '▶';
            icon.textContent = isExpanded ? '📂' : '📁';
            item.append(toggle, icon, label);
            container.appendChild(item);

            const childContainer = document.createElement('div');
            childContainer.className = 'tree-children';
            childContainer.style.display = isExpanded ? 'block' : 'none';
            if (isExpanded && node.children) {
                node.children.forEach(c => this.renderTreeNode(c, childContainer, depth + 1));
            }
            container.appendChild(childContainer);

            item.addEventListener('click', async (e) => {
                e.stopPropagation();
                const expanded = this.expandedDirs.has(node.path);
                if (expanded) {
                    this.expandedDirs.delete(node.path);
                    toggle.textContent = '▶'; icon.textContent = '📁';
                    childContainer.style.display = 'none';
                } else {
                    this.expandedDirs.add(node.path);
                    toggle.textContent = '▼'; icon.textContent = '📂';
                    if (!node.children || node.children.length === 0) {
                        try { node.children = await invoke('fs_expand_dir', { path: node.path }); } catch {}
                    }
                    childContainer.innerHTML = '';
                    if (node.children) node.children.forEach(c => this.renderTreeNode(c, childContainer, depth + 1));
                    childContainer.style.display = 'block';
                }
            });
            item.addEventListener('contextmenu', e => { e.preventDefault(); this.showContextMenu(e, node); });
        } else {
            toggle.textContent = '';
            icon.textContent = fileIcon(node.name, false);
            item.append(toggle, icon, label);
            container.appendChild(item);
            item.addEventListener('click', () => this.openFile(node.path, node.name));
            item.addEventListener('contextmenu', e => { e.preventDefault(); this.showContextMenu(e, node); });
        }
    }

    async openFile(path, name) {
        const normalPath = path.replace(/\\/g, '/');
        if (this.tabs.find(t => t.path === normalPath)) {
            this.activateTab(normalPath);
            return;
        }
        const mime = mediaMime(name);
        try {
            if (mime) {
                // 媒体文件：读取 base64 并创建预览
                const b64 = await invoke('fs_read_file_base64', { path: normalPath });
                this.tabs.push({ path: normalPath, name, dirty: false, isMedia: true });
                this.createMediaPreview(normalPath, name, b64, mime);
            } else {
                const content = await invoke('fs_read_file', { path: normalPath });
                this.tabs.push({ path: normalPath, name, dirty: false });
                this.createEditor(normalPath, content);
            }
            this.renderTabs();
            this.activateTab(normalPath);
            document.getElementById('statusLang').textContent = mime ? mime.split('/')[0].toUpperCase() : langFromPath(normalPath);
            this.saveWorkspace();
        } catch (e) {
            this.toast(`无法打开 ${name}: ${e}`, 'error');
        }
    }

    createMediaPreview(path, name, b64, mime) {
        const editorArea = document.getElementById('editorArea');
        const wrapper = document.createElement('div');
        wrapper.className = 'editor-instance';
        wrapper.dataset.path = path;
        const dataUrl = `data:${mime};base64,${b64}`;
        const ext = name.split('.').pop().toUpperCase();

        let mediaEl = '';
        if (isImage(mime)) {
            mediaEl = `<div class="media-preview-img-wrap"><img class="media-preview-img" src="${dataUrl}" alt="${name}" draggable="false"></div>`;
        } else if (isVideo(mime)) {
            mediaEl = `<video controls preload="metadata" style="max-width:100%"><source src="${dataUrl}" type="${mime}"></video>`;
        } else if (isAudio(mime)) {
            mediaEl = `<audio controls style="width:100%"><source src="${dataUrl}" type="${mime}"></audio>`;
        }

        wrapper.innerHTML = `<div class="media-preview">
            ${mediaEl}
            <div class="media-info">
                <span>${name}</span>
                <span>${ext} · ${(b64.length * 3 / 4 / 1024).toFixed(1)} KB</span>
            </div>
        </div>`;

        editorArea.appendChild(wrapper);
        this.editors.set(path, { isMedia: true, el: wrapper });
    }

    activateTab(path) {
        this.activeTab = path;
        this.renderTabs();
        document.querySelectorAll('.editor-instance').forEach(el => {
            el.classList.toggle('active', el.dataset.path === path);
        });
        document.getElementById('emptyEditor').style.display = 'none';
        const editor = this.editors.get(path);
        if (editor?.layout) setTimeout(() => editor.layout(), 0);
        const mime = mediaMime(path.split('/').pop());
        document.getElementById('statusLang').textContent = mime
            ? mime.split('/')[0].toUpperCase()
            : langFromPath(path);
    }

    renderTabs() {
        const bar = document.getElementById('tabBar');
        bar.innerHTML = '';
        this.tabs.forEach(tab => {
            const el = document.createElement('div');
            el.className = 'tab' + (tab.path === this.activeTab ? ' active' : '') + (tab.dirty ? ' dirty' : '');
            el.innerHTML = `<span class="tab-dirty"></span><span class="tab-name" title="${tab.path}">${tab.name}</span><span class="tab-close">✕</span>`;
            el.addEventListener('click', e => {
                if (e.target.classList.contains('tab-close')) return;
                this.activateTab(tab.path);
            });
            el.querySelector('.tab-close').addEventListener('click', e => { e.stopPropagation(); this.closeTab(tab.path); });
            bar.appendChild(el);
        });
    }

    async saveFile(path) {
        const editor = this.editors.get(path);
        if (!editor || editor.isMedia) return;
        const content = editor.getValue ? editor.getValue() : (editor.el ? editor.el.textContent : '');
        try {
            await invoke('fs_write_file', { path, content });
            const tab = this.tabs.find(t => t.path === path);
            if (tab) { tab.dirty = false; this.renderTabs(); }
        } catch (e) {
            this.toast(`保存失败: ${e}`, 'error');
        }
    }

    closeTab(path) {
        const idx = this.tabs.findIndex(t => t.path === path);
        if (idx === -1) return;
        const tab = this.tabs[idx];
        if (tab.dirty) {
            if (!confirm(`${tab.name} 有未保存的更改，是否保存？`)) { return; }
            this.saveFile(path);
        }
        this.tabs.splice(idx, 1);
        const editor = this.editors.get(path);
        if (editor?.dispose) editor.dispose();
        document.querySelector(`.editor-instance[data-path="${CSS.escape(path)}"]`)?.remove();
        this.editors.delete(path);

        if (this.activeTab === path) {
            const next = this.tabs[Math.min(idx, this.tabs.length - 1)];
            if (next) { this.activateTab(next.path); }
            else {
                this.activeTab = null;
                document.getElementById('emptyEditor').style.display = 'flex';
                document.getElementById('statusLang').textContent = '—';
            }
        }
        this.renderTabs();
        this.saveWorkspace();
    }

    // ── 工作区持久化 ──────────────────────────────────────────────────────────
    async saveWorkspace() {
        try {
            const state = {
                folder: this.openedFolder,
                openTabs: this.tabs.map(t => ({ path: t.path, name: t.name })),
                activeTab: this.activeTab,
            };
            await invoke('config_save', { config: { ...this.config, _workspace: JSON.stringify(state) } });
        } catch {}
    }

    async restoreWorkspace() {
        try {
            if (!this.config._workspace) return;
            const state = JSON.parse(this.config._workspace);
            if (state.folder) {
                try {
                    this.openedFolder = state.folder;
                    document.getElementById('statusFolder').textContent = this.openedFolder.split('/').pop();
                    await this.loadFileTree();
                    await this.refreshGit();
                } catch {}
            }
            if (state.openTabs?.length) {
                for (const t of state.openTabs) {
                    try { await this.openFile(t.path, t.name); } catch {}
                }
                if (state.activeTab) {
                    const tab = this.tabs.find(t => t.path === state.activeTab);
                    if (tab) this.activateTab(tab.path);
                }
            }
        } catch {}
    }

    // ── Git ───────────────────────────────────────────────────────────────────
    async refreshGit() {
        if (!this.openedFolder) return;
        try {
            const isRepo = await invoke('git_is_repo', { cwd: this.openedFolder });
            if (!isRepo) { document.getElementById('statusBranch').textContent = '非 Git 仓库'; return; }
            const status = await invoke('git_status', { cwd: this.openedFolder });
            document.getElementById('statusBranch').textContent = `⎇ ${status.branch}`;
            this.renderSCM(status);
        } catch {}
    }

    renderSCM(status) {
        document.getElementById('changesCount').textContent = status.changes.length;
        document.getElementById('stagedCount').textContent = status.staged.length;

        const makeItem = (change, isStaged) => {
            const el = document.createElement('div');
            el.className = 'scm-item';
            const label = { M: '修改', A: '新增', D: '删除', U: '未追踪' }[change.status] || change.status;
            el.innerHTML = `
                <span class="scm-status scm-${change.status}" title="${label}">${change.status}</span>
                <span class="tree-label">${change.path}</span>
                <button class="scm-btn" title="${isStaged ? '取消暂存' : '暂存'}">${isStaged ? '−' : '+'}</button>
            `;
            el.querySelector('button').addEventListener('click', async e => {
                e.stopPropagation();
                await invoke(isStaged ? 'git_unstage' : 'git_add', { cwd: this.openedFolder, path: change.path });
                await this.refreshGit();
            });
            el.addEventListener('click', async () => {
                const fullPath = `${this.openedFolder}/${change.path}`;
                await this.openGitDiffView(fullPath, change.path.split('/').pop());
            });
            return el;
        };

        const changesEl = document.getElementById('changesList');
        const stagedEl = document.getElementById('stagedList');
        changesEl.innerHTML = ''; status.changes.forEach(c => changesEl.appendChild(makeItem(c, false)));
        stagedEl.innerHTML = ''; status.staged.forEach(c => stagedEl.appendChild(makeItem(c, true)));
        this.renderCommitLog();
    }

    async renderCommitLog() {
        if (!this.openedFolder) return;
        try {
            const commits = await invoke('git_log', { cwd: this.openedFolder });
            const el = document.getElementById('commitLog');
            el.innerHTML = '';
            commits.forEach(c => {
                const item = document.createElement('div');
                item.className = 'commit-log-item';
                item.innerHTML = `<span class="commit-hash">${c.hash}</span><span class="commit-msg">${this.escapeHtml(c.message)}</span><div class="commit-meta">${this.escapeHtml(c.author)} · ${c.date}</div>`;
                el.appendChild(item);
            });
        } catch {}
    }

    showDiffText(path, diffText) {
        document.getElementById('outputContent').textContent = diffText || '(无差异)';
        this.switchPanel('output');
    }

    // 在编辑器区域打开只读 Git diff 视图（Monaco Diff Editor）
    async openGitDiffView(filePath, fileName) {
        if (!this.monaco || !this.openedFolder) return;
        const viewId = `__git_diff__${filePath}`;

        // 如果已有 diff tab 则激活
        if (this.tabs.find(t => t.path === viewId)) {
            this.activateTab(viewId);
            return;
        }

        try {
            // 获取 HEAD 版本（原始）
            let originalContent = '';
            try {
                originalContent = await invoke('git_diff', { cwd: this.openedFolder, file: filePath });
                // git_diff 返回 unified diff 文本，我们需要真正的文件内容
                // 用 git show HEAD:file 获取
            } catch {}

            // 用 show 命令获取 HEAD 内容
            const { terminal_run_capture } = window.__TAURI__?.core ? {} : {};
            try {
                const headContent = await invoke('terminal_run_capture', {
                    cwd: this.openedFolder,
                    command: `git show HEAD:${filePath.replace(this.openedFolder + '/', '')}`
                });
                originalContent = headContent.startsWith('[stderr]') ? '' : headContent;
            } catch { originalContent = ''; }

            // 当前磁盘内容（修改后）
            let modifiedContent = '';
            try { modifiedContent = await invoke('fs_read_file', { path: filePath }); } catch {}

            // 创建 diff 容器
            const container = document.getElementById('editorContainer');
            const div = document.createElement('div');
            div.className = 'editor-instance';
            div.dataset.path = viewId;
            container.appendChild(div);

            const lang = langFromPath(filePath);
            const originalModel = this.monaco.editor.createModel(originalContent, lang);
            const modifiedModel = this.monaco.editor.createModel(modifiedContent, lang);
            const diffEditor = this.monaco.editor.createDiffEditor(div, {
                theme: this.config.theme === 'vs' ? 'vs' : 'my-dark',
                fontSize: this.config.font_size || 14,
                automaticLayout: true,
                renderSideBySide: true,
                readOnly: true,
            });
            diffEditor.setModel({ original: originalModel, modified: modifiedModel });

            // 注册为 tab（特殊 diff tab）
            this.tabs.push({ path: viewId, name: `⊞ ${fileName}`, dirty: false, isDiff: true });
            // 存储 diff editor 实例（用 getValue 返回 modified 内容）
            this.editors.set(viewId, {
                layout: () => diffEditor.layout(),
                dispose: () => diffEditor.dispose(),
                getValue: () => modifiedContent,
            });
            this.renderTabs();
            this.activateTab(viewId);
        } catch (e) {
            this.toast(`无法打开 diff 视图: ${e}`, 'error');
        }
    }

    // ── 终端 ──────────────────────────────────────────────────────────────────
    async initFirstTerminal() {
        const cwd = this.openedFolder || await invoke('fs_get_cwd').catch(() => '.');
        await this.createTerminal(cwd);
    }

    _getSelectedShell() {
        const sel = document.getElementById('terminalShellSelect');
        const v = sel?.value || 'cmd';
        const shellPaths = {
            cmd: 'cmd.exe',
            powershell: 'powershell.exe',
            pwsh: 'pwsh.exe',
            bash: navigator.platform.startsWith('Win') ? 'C:\\Program Files\\Git\\bin\\bash.exe' : '/bin/bash',
            zsh: '/bin/zsh',
        };
        return { name: v, path: shellPaths[v] || v };
    }

    async createTerminal(cwd, shellOverride) {
        if (!window.Terminal) { this.log('xterm.js 未加载，终端不可用'); return; }
        const shell = shellOverride || this._getSelectedShell();
        const id = await invoke('terminal_create', { cwd, shell: shell.path });

        const term = new Terminal({
            fontFamily: '"Cascadia Code","Fira Code",Consolas,monospace',
            fontSize: 13,
            theme: { background: '#0d0d0d', foreground: '#cccccc', cursor: '#ffffff', selectionBackground: '#264f78' },
            cursorBlink: true,
            convertEol: true,
        });
        const fitAddon = new FitAddon.FitAddon();
        term.loadAddon(fitAddon);

        const body = document.getElementById('terminalBody');
        const container = document.createElement('div');
        container.style.cssText = 'width:100%;height:100%;display:none';
        container.dataset.termId = id;
        body.appendChild(container);
        term.open(container);
        fitAddon.fit();

        // 标签
        const tabEl = document.createElement('div');
        tabEl.className = 'terminal-tab';
        tabEl.dataset.termId = id;
        tabEl.innerHTML = `${shell.name} <span class="terminal-tab-close">✕</span>`;
        tabEl.addEventListener('click', e => {
            if (e.target.classList.contains('terminal-tab-close')) { this.closeTerminal(id); return; }
            this.activateTerminal(id);
        });
        document.getElementById('newTerminalBtn').parentElement.insertBefore(tabEl, document.getElementById('newTerminalBtn'));

        this.terminals.set(id, { term, fitAddon, container, tabEl });

        const unlisten = await listen(`terminal_output:${id}`, e => term.write(e.payload));
        await listen(`terminal_exit:${id}`, () => term.write('\r\n\x1b[31m[进程已退出]\x1b[0m\r\n'));
        this.terminals.get(id).unlisten = unlisten;

        term.onData(data => invoke('terminal_write', { id, data }).catch(() => {}));

        const resizeObs = new ResizeObserver(() => {
            try { fitAddon.fit(); } catch {}
            invoke('terminal_resize', { id, cols: term.cols, rows: term.rows }).catch(() => {});
        });
        resizeObs.observe(container);
        this.terminals.get(id).resizeObs = resizeObs;

        this.activateTerminal(id);
        this.switchPanel('terminal');
    }

    activateTerminal(id) {
        this.activeTerminal = id;
        this.terminals.forEach((t, tid) => {
            t.container.style.display = tid === id ? 'block' : 'none';
            t.tabEl.classList.toggle('active', tid === id);
        });
        const t = this.terminals.get(id);
        if (t) { try { t.fitAddon.fit(); t.term.focus(); } catch {} }
    }

    closeTerminal(id) {
        const t = this.terminals.get(id);
        if (!t) return;
        if (t.unlisten) t.unlisten();
        if (t.resizeObs) t.resizeObs.disconnect();
        t.term.dispose();
        t.container.remove();
        t.tabEl.remove();
        invoke('terminal_close', { id }).catch(() => {});
        this.terminals.delete(id);
        if (this.activeTerminal === id) {
            const first = this.terminals.keys().next().value;
            if (first) this.activateTerminal(first);
            else this.activeTerminal = null;
        }
    }

    // ── AI 会话管理 ───────────────────────────────────────────────────────────
    get currentSession() { return this.sessions.find(s => s.id === this.activeSession); }

    renderSessionTabs() {
        const bar = document.getElementById('aiSessionsBar');
        bar.innerHTML = '';
        this.sessions.forEach(s => {
            const tab = document.createElement('div');
            tab.className = 'ai-session-tab' + (s.id === this.activeSession ? ' active' : '');
            tab.dataset.id = s.id;
            tab.innerHTML = `${this.escapeHtml(s.name)}${this.sessions.length > 1 ? `<span class="ai-session-close" data-id="${s.id}">✕</span>` : ''}`;
            tab.addEventListener('click', e => {
                if (e.target.classList.contains('ai-session-close')) {
                    this.deleteSession(parseInt(e.target.dataset.id));
                    return;
                }
                this.switchSession(s.id);
            });
            bar.appendChild(tab);
        });
        const newBtn = document.createElement('button');
        newBtn.className = 'ai-session-new';
        newBtn.textContent = '+';
        newBtn.title = '新建对话';
        newBtn.addEventListener('click', () => this.newSession());
        bar.appendChild(newBtn);
    }

    newSession() {
        const id = Date.now();
        this.sessions.push({ id, name: `对话 ${this.sessions.length + 1}`, messages: [], tokens: 0 });
        this.switchSession(id);
    }

    deleteSession(id) {
        if (this.sessions.length <= 1) return;
        const idx = this.sessions.findIndex(s => s.id === id);
        this.sessions.splice(idx, 1);
        if (this.activeSession === id) {
            this.switchSession(this.sessions[Math.max(0, idx - 1)].id);
        } else {
            this.renderSessionTabs();
        }
    }

    switchSession(id) {
        this.activeSession = id;
        this.renderSessionTabs();
        this.renderAIMessages();
        this.updateTokenBar();
    }

    renderAIMessages() {
        const msgs = document.getElementById('aiMsgs');
        msgs.innerHTML = '';
        const session = this.currentSession;
        if (!session) return;
        session.messages.forEach(m => {
            if (m.role === 'user') {
                const el = document.createElement('div');
                el.className = 'ai-msg ai-msg-user';
                el.innerHTML = `<div class="ai-msg-body">${this.escapeHtml(m.displayContent || m.content)}</div>`;
                msgs.appendChild(el);
            } else if (m.role === 'assistant' && m.content) {
                const el = document.createElement('div');
                el.className = 'ai-msg ai-msg-assistant';
                el.innerHTML = `<div class="ai-msg-body">${renderMarkdown(m.content)}</div>`;
                msgs.appendChild(el);
            } else if (m.role === 'tool_card') {
                this.renderToolCard(m, msgs);
            }
        });
        msgs.scrollTop = msgs.scrollHeight;
    }

    renderToolCard(tc, container) {
        const el = document.createElement('div');
        el.className = 'ai-tool-card';
        const toolIcons = { read_file: '📖', write_file: '✏️', list_files: '📂', run_terminal: '⚡', get_git_diff: '🔀' };
        const toolLabels = { read_file: '读取文件', write_file: '写入文件', list_files: '列出文件', run_terminal: '执行命令', get_git_diff: 'Git Diff' };
        let argsStr = '';
        try {
            const parsed = JSON.parse(tc.arguments || '{}');
            argsStr = JSON.stringify(parsed, null, 2);
            if (argsStr.length > 400) argsStr = argsStr.slice(0, 400) + '\n...（已截断）';
        } catch { argsStr = tc.arguments || ''; }

        const statusText = { running: '运行中...', done: '✓ 完成', error: '✗ 出错', rejected: '✗ 已拒绝' };
        el.innerHTML = `
            <div class="ai-tool-header">
                <span class="ai-tool-icon">${toolIcons[tc.name] || '🔧'}</span>
                <span class="ai-tool-name">${toolLabels[tc.name] || tc.name}</span>
                <span class="ai-tool-status ${tc.status || 'running'}">${statusText[tc.status || 'running']}</span>
            </div>
            <div class="ai-tool-body">${this.escapeHtml(argsStr)}</div>
        `;
        container.appendChild(el);
        return el;
    }

    updateTokenBar() {
        const session = this.currentSession;
        if (!session) return;
        const tokens = session.tokens || 0;
        document.getElementById('aiTokenCount').textContent = `${tokens.toLocaleString()} tokens`;
        const model = this.config.deepseek_model || 'deepseek-v4-flash';
        // Output pricing: Pro=6元/M, Flash=2元/M (thinking mode has same price)
        const costPerMillion = (model.startsWith('deepseek-v4-pro') || model === 'deepseek-reasoner') ? 6 : 2;
        const cost = tokens * (costPerMillion / 1_000_000);
        document.getElementById('aiCostEstimate').textContent = `≈ ¥${cost.toFixed(4)}`;
    }

    // ── AI 系统提示词 ─────────────────────────────────────────────────────────
    buildSystemPrompt() {
        const custom = this.config.system_prompt?.trim();
        let base = custom || `你是 My IDE 的 AI 编程助手，一名专业软件工程师。你帮助用户编写、编辑、调试和理解代码。

可用工具：
- read_file(path): 读取文件内容
- write_file(path, content): 写入文件（审批模式下用户先审查差异）
- list_files(path): 列出目录内容
- run_terminal(command): 执行 shell 命令并返回输出
- get_git_diff(file?): 获取 git 差异

当前工作目录: ${this.openedFolder || '（未打开文件夹）'}

修改文件时请使用 write_file 工具。回复请使用中文，代码保持原语言。`;

        if (this.contextFiles.length > 0) {
            base += '\n\n已加载的上下文文件：\n';
            this.contextFiles.forEach(f => {
                base += `\n### ${f.path}\n\`\`\`\n${f.content.slice(0, 8000)}\n\`\`\`\n`;
            });
        }
        return base;
    }

    getToolDefinitions() {
        return [
            { name: 'read_file', description: '读取文件内容', parameters: { type: 'object', properties: { path: { type: 'string', description: '文件路径' } }, required: ['path'] } },
            { name: 'write_file', description: '写入文件（审批模式下会显示差异预览）', parameters: { type: 'object', properties: { path: { type: 'string', description: '文件路径' }, content: { type: 'string', description: '文件完整内容' } }, required: ['path', 'content'] } },
            { name: 'list_files', description: '列出目录内容', parameters: { type: 'object', properties: { path: { type: 'string', description: '目录路径' } }, required: ['path'] } },
            { name: 'run_terminal', description: '执行 shell 命令并返回输出结果', parameters: { type: 'object', properties: { command: { type: 'string', description: '要执行的命令' } }, required: ['command'] } },
            { name: 'get_git_diff', description: '获取 git 差异', parameters: { type: 'object', properties: { file: { type: 'string', description: '可选，指定文件路径' } } } },
        ];
    }

    async executeToolCall(toolCall) {
        const args = JSON.parse(toolCall.arguments || '{}');
        switch (toolCall.name) {
            case 'read_file': {
                const p = this.resolvePath(args.path);
                return await invoke('fs_read_file', { path: p });
            }
            case 'write_file': {
                const p = this.resolvePath(args.path);
                if (this.agentMode === 'approval') {
                    let orig = '';
                    try { orig = await invoke('fs_read_file', { path: p }); } catch {}
                    const ok = await this.showDiffApproval(p, orig, args.content);
                    if (!ok) return '用户拒绝了修改。';
                }
                await invoke('fs_write_file', { path: p, content: args.content });
                const tab = this.tabs.find(t => t.path === p);
                if (tab) {
                    const ed = this.editors.get(p);
                    if (ed?.setValue) { ed.setValue(args.content); tab.dirty = false; this.renderTabs(); }
                }
                await this.loadFileTree();
                return `文件写入成功: ${p}`;
            }
            case 'list_files': {
                const p = this.resolvePath(args.path);
                const entry = await invoke('fs_list_dir', { path: p });
                const fmt = (e, d = 0) => {
                    const pre = '  '.repeat(d);
                    if (!e.is_dir) return `${pre}${e.name}`;
                    return `${pre}${e.name}/\n${(e.children || []).map(c => fmt(c, d + 1)).join('\n')}`;
                };
                return fmt(entry);
            }
            case 'run_terminal': {
                if (this.agentMode === 'approval') {
                    const ok = confirm(`执行命令？\n\n${args.command}`);
                    if (!ok) return '用户拒绝执行命令。';
                }
                // 尝试捕获输出；如果命令 capture 不存在则发到终端
                try {
                    const cwd = this.openedFolder || '.';
                    const result = await invoke('terminal_run_capture', { cwd, command: args.command });
                    return result || '（命令执行完毕，无输出）';
                } catch {
                    if (this.activeTerminal) {
                        await invoke('terminal_write', { id: this.activeTerminal, data: args.command + '\r\n' });
                        return '命令已发送到终端（输出请查看终端面板）';
                    }
                    return '无活动终端';
                }
            }
            case 'get_git_diff': {
                if (!this.openedFolder) return '未打开文件夹';
                return await invoke('git_diff', { cwd: this.openedFolder, file: args.file || null });
            }
            default:
                return `未知工具: ${toolCall.name}`;
        }
    }

    resolvePath(path) {
        if (!path) return '';
        if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) return path;
        if (this.openedFolder) return `${this.openedFolder}/${path}`;
        return path;
    }

    // ── AI 发送消息 ───────────────────────────────────────────────────────────
    async sendAIMessage(userText, imageB64 = null) {
        const sendBtn = document.getElementById('aiSendBtn');
        sendBtn.disabled = true;
        document.getElementById('aiStopRow').style.display = 'flex';
        this.aiStreaming = true;

        const session = this.currentSession;
        const msgs = document.getElementById('aiMsgs');

        let userContent = userText;
        let displayContent = userText;

        if (imageB64) {
            displayContent = userText + ' [📎 图片]';
            const userEl = document.createElement('div');
            userEl.className = 'ai-msg ai-msg-user';
            userEl.innerHTML = `<div class="ai-msg-body">${this.escapeHtml(displayContent)}</div>`;
            msgs.appendChild(userEl);
            msgs.scrollTop = msgs.scrollHeight;
            try {
                const kimiResult = await invoke('ai_kimi_vision', { imageB64, prompt: userText || '请详细描述这张图片，重点关注代码和UI元素。' });
                userContent = `[Kimi 图片分析]: ${kimiResult}\n\n用户说: ${userText}`;
            } catch (e) {
                this.toast(`Kimi 错误: ${e}`, 'error');
                userContent = userText;
            }
        } else {
            const userEl = document.createElement('div');
            userEl.className = 'ai-msg ai-msg-user';
            userEl.innerHTML = `<div class="ai-msg-body">${this.escapeHtml(userText)}</div>`;
            msgs.appendChild(userEl);
            msgs.scrollTop = msgs.scrollHeight;
        }

        session.messages.push({ role: 'user', content: userContent, displayContent });

        const thinkingEl = document.createElement('div');
        thinkingEl.className = 'ai-msg ai-msg-assistant';
        thinkingEl.innerHTML = `<div class="ai-thinking"><div class="loading-spinner" style="width:14px;height:14px;border-width:2px"></div> 正在思考...</div>`;
        msgs.appendChild(thinkingEl);
        msgs.scrollTop = msgs.scrollHeight;

        await this._streamAI(thinkingEl, session);

        sendBtn.disabled = false;
        document.getElementById('aiStopRow').style.display = 'none';
        this.aiStreaming = false;
    }

    async _streamAI(thinkingEl, session) {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const msgs = document.getElementById('aiMsgs');

        let assistantText = '';
        let reasoningText = '';
        let lastReasoningContent = '';
        let msgEl = null;
        let reasoningEl = null;
        let pendingToolCall = null;

        const cleanup = () => {
            this.aiListeners.forEach(u => { try { u(); } catch {} });
            this.aiListeners = [];
        };

        const deltaUnlisten = await listen(`ai_delta:${requestId}`, e => {
            if (!msgEl) {
                thinkingEl.remove();
                msgEl = document.createElement('div');
                msgEl.className = 'ai-msg ai-msg-assistant';
                msgEl.innerHTML = `<div class="ai-msg-body"></div>`;
                msgs.appendChild(msgEl);
            }
            if (e.payload.reasoning) {
                reasoningText += e.payload.reasoning;
                lastReasoningContent += e.payload.reasoning;
                if (!reasoningEl) {
                    reasoningEl = document.createElement('details');
                    reasoningEl.className = 'ai-reasoning';
                    reasoningEl.innerHTML = `<summary>思维链 <span class="ai-reasoning-tokens"></span></summary><div class="ai-reasoning-body"></div>`;
                    msgEl.insertBefore(reasoningEl, msgEl.querySelector('.ai-msg-body'));
                }
                reasoningEl.querySelector('.ai-reasoning-body').textContent = reasoningText;
                const rTokens = Math.ceil(reasoningText.length / 3);
                reasoningEl.querySelector('.ai-reasoning-tokens').textContent = `(~${rTokens} tokens)`;
            }
            if (e.payload.content) {
                assistantText += e.payload.content;
                msgEl.querySelector('.ai-msg-body').innerHTML = renderMarkdown(assistantText);
            }
            msgs.scrollTop = msgs.scrollHeight;
        });
        this.aiListeners.push(deltaUnlisten);

        const toolUnlisten = await listen(`ai_tool_call:${requestId}`, e => { pendingToolCall = e.payload; });
        this.aiListeners.push(toolUnlisten);

        const doneUnlisten = await listen(`ai_done:${requestId}`, async () => {
            cleanup();
            if (assistantText) {
                session.messages.push({ role: 'assistant', content: assistantText });
                // 计算 token（近似）
                const totalText = session.messages.map(m => m.content || '').join('');
                session.tokens = Math.ceil(totalText.length / 3);
                this.updateTokenBar();
            }

            if (pendingToolCall) {
                const tc = pendingToolCall;
                pendingToolCall = null;
                if (!msgEl) thinkingEl.remove();

                const cardRecord = { role: 'tool_card', id: tc.id, name: tc.name, arguments: tc.arguments, status: 'running' };
                session.messages.push(cardRecord);
                const cardEl = this.renderToolCard(cardRecord, msgs);
                msgs.scrollTop = msgs.scrollHeight;

                try {
                    const result = await this.executeToolCall(tc);
                    cardRecord.status = 'done';
                    cardEl.querySelector('.ai-tool-status').textContent = '✓ 完成';
                    cardEl.querySelector('.ai-tool-status').className = 'ai-tool-status done';

                    const assistantMsg = { role: 'assistant', content: null, tool_calls: [{ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.arguments } }] };
                    if (lastReasoningContent) assistantMsg.reasoning_content = lastReasoningContent;
                    session.messages.push(assistantMsg);
                    session.messages.push({ role: 'tool', content: String(result), tool_call_id: tc.id });

                    // 继续对话
                    const continueThinking = document.createElement('div');
                    continueThinking.className = 'ai-msg ai-msg-assistant';
                    continueThinking.innerHTML = `<div class="ai-thinking"><div class="loading-spinner" style="width:14px;height:14px;border-width:2px"></div> 继续处理...</div>`;
                    msgs.appendChild(continueThinking);
                    msgs.scrollTop = msgs.scrollHeight;
                    await this._streamAI(continueThinking, session);
                } catch (e) {
                    cardRecord.status = 'error';
                    cardEl.querySelector('.ai-tool-status').textContent = '✗ 出错';
                    cardEl.querySelector('.ai-tool-status').className = 'ai-tool-status error';
                    const errEl = document.createElement('div');
                    errEl.className = 'ai-msg ai-msg-assistant';
                    errEl.innerHTML = `<div class="ai-msg-body">工具执行出错: ${this.escapeHtml(String(e))}</div>`;
                    msgs.appendChild(errEl);
                }
            }

            document.getElementById('aiSendBtn').disabled = false;
            document.getElementById('aiStopRow').style.display = 'none';
            this.aiStreaming = false;
        });
        this.aiListeners.push(doneUnlisten);

        const apiMessages = [
            { role: 'system', content: this.buildSystemPrompt() },
            ...session.messages
                .filter(m => m.role !== 'tool_card')
                .map(m => {
                    if (m.tool_calls) return { role: 'assistant', content: m.content, tool_calls: m.tool_calls };
                    if (m.tool_call_id) return { role: 'tool', content: m.content, tool_call_id: m.tool_call_id };
                    return { role: m.role, content: m.content };
                })
        ];

        try {
            await invoke('ai_chat_deepseek', { requestId, messages: apiMessages, tools: this.getToolDefinitions() });
        } catch (e) {
            cleanup();
            thinkingEl.remove();
            const errEl = document.createElement('div');
            errEl.className = 'ai-msg ai-msg-assistant';
            errEl.innerHTML = `<div class="ai-msg-body">请求失败: ${this.escapeHtml(String(e))}</div>`;
            msgs.appendChild(errEl);
            document.getElementById('aiSendBtn').disabled = false;
            document.getElementById('aiStopRow').style.display = 'none';
            this.aiStreaming = false;
        }
    }

    stopAI() {
        this.aiListeners.forEach(u => { try { u(); } catch {} });
        this.aiListeners = [];
        this.aiStreaming = false;
        document.getElementById('aiSendBtn').disabled = false;
        document.getElementById('aiStopRow').style.display = 'none';
        this.toast('已停止生成', 'info');
    }

    // ── Diff 审批 ─────────────────────────────────────────────────────────────
    showDiffApproval(path, originalContent, newContent) {
        return new Promise(resolve => {
            this.pendingDiff = { path, originalContent, newContent, resolve };
            document.getElementById('diffFile').textContent = path;
            document.getElementById('diffPanel').classList.add('active');

            if (this.monaco) {
                const wrap = document.getElementById('diffEditorWrap');
                wrap.innerHTML = '';
                if (this.diffEditor) { this.diffEditor.dispose(); this.diffEditor = null; }
                const orig = this.monaco.editor.createModel(originalContent, langFromPath(path));
                const mod = this.monaco.editor.createModel(newContent, langFromPath(path));
                this.diffEditor = this.monaco.editor.createDiffEditor(wrap, {
                    theme: this.config.theme === 'vs' ? 'vs' : 'my-dark',
                    fontSize: this.config.font_size || 14,
                    automaticLayout: true,
                    renderSideBySide: true,
                });
                this.diffEditor.setModel({ original: orig, modified: mod });
            }
        });
    }

    diffApply() {
        if (!this.pendingDiff) return;
        let newContent = this.pendingDiff.newContent;
        if (this.diffEditor) {
            const mod = this.diffEditor.getModifiedEditor().getModel();
            if (mod) newContent = mod.getValue();
        }
        const resolve = this.pendingDiff.resolve;
        document.getElementById('diffPanel').classList.remove('active');
        if (this.diffEditor) { this.diffEditor.dispose(); this.diffEditor = null; }
        this.pendingDiff = null;
        resolve(true);
    }

    diffReject() {
        if (!this.pendingDiff) return;
        const resolve = this.pendingDiff.resolve;
        document.getElementById('diffPanel').classList.remove('active');
        if (this.diffEditor) { this.diffEditor.dispose(); this.diffEditor = null; }
        this.pendingDiff = null;
        resolve(false);
    }

    // ── 上下文文件 ────────────────────────────────────────────────────────────
    async addFileToContext(path, name) {
        try {
            const content = await invoke('fs_read_file', { path });
            if (!this.contextFiles.find(f => f.path === path)) {
                this.contextFiles.push({ path, name, content });
                this.renderContextBar();
                this.toast(`已添加到 AI 上下文: ${name}`, 'success');
            }
        } catch (e) {
            this.toast(`无法读取文件: ${e}`, 'error');
        }
    }

    renderContextBar() {
        const bar = document.getElementById('aiContextBar');
        bar.innerHTML = '';
        this.contextFiles.forEach(f => {
            const chip = document.createElement('div');
            chip.className = 'ai-context-chip';
            chip.innerHTML = `📎 ${f.name} <span class="ai-context-chip-remove" data-path="${f.path}">✕</span>`;
            chip.querySelector('.ai-context-chip-remove').addEventListener('click', () => {
                this.contextFiles = this.contextFiles.filter(c => c.path !== f.path);
                this.renderContextBar();
            });
            bar.appendChild(chip);
        });
        const addBtn = document.createElement('button');
        addBtn.className = 'ai-context-add';
        addBtn.id = 'aiAddContext';
        addBtn.textContent = '+ 添加文件';
        addBtn.addEventListener('click', () => {
            if (this.activeTab) {
                const tab = this.tabs.find(t => t.path === this.activeTab);
                if (tab) this.addFileToContext(tab.path, tab.name);
            } else { this.toast('请先打开一个文件', 'warning'); }
        });
        bar.appendChild(addBtn);
    }

    // ── 设置 ──────────────────────────────────────────────────────────────────
    loadSettingsUI() {
        document.getElementById('settingsDeepseekKey').value = this.config.deepseek_api_key || '';
        document.getElementById('settingsKimiKey').value = this.config.kimi_api_key || '';
        document.getElementById('settingsProxy').value = this.config.proxy || '';
        document.getElementById('settingsModel').value = this.config.deepseek_model || 'deepseek-v4-flash';
        document.getElementById('settingsTheme').value = this.config.theme || 'vs-dark';
        document.getElementById('settingsFontSize').value = String(this.config.font_size || 14);
        document.getElementById('settingsFont').value = this.config.font_family || 'Cascadia Code,Fira Code,Consolas,monospace';
        document.getElementById('settingsTabSize').value = String(this.config.tab_size || 4);
        document.getElementById('settingsAutoSave').checked = this.config.auto_save || false;
        document.getElementById('settingsWordWrap').checked = this.config.word_wrap || false;
        document.getElementById('settingsSystemPrompt').value = this.config.system_prompt || '';
        this.updateAIPanelState();
    }

    updateAIPanelState() {
        const model = this.config.deepseek_model || 'deepseek-v4-flash';
        const hasKey = !!(this.config.deepseek_api_key);
        const hasKimi = !!(this.config.kimi_api_key);
        // 快速模型选择器
        const qs = document.getElementById('aiModelQuick');
        if (qs) qs.value = model;
        // API key 状态指示
        const dot = document.getElementById('aiKeyDot');
        if (dot) { dot.className = 'ai-qs-keydot ' + (hasKey ? 'ok' : 'err'); dot.title = hasKey ? 'API Key 已配置' : 'API Key 未配置'; }
        // 输入框 placeholder 和粘贴提示
        const input = document.getElementById('aiInput');
        if (input) {
            input.placeholder = hasKimi
                ? '向 AI 提问... (Shift+Enter 换行，可粘贴/拖入图片)'
                : '向 AI 提问... (Shift+Enter 换行，配置 Kimi Key 可粘贴图片)';
        }
        // 状态栏模型
        const labels = { 'deepseek-v4-flash': 'Flash(思考)', 'deepseek-v4-flash-nothink': 'Flash(极速)', 'deepseek-v4-pro': 'Pro(思考)', 'deepseek-v4-pro-nothink': 'Pro(快速)' };
        document.getElementById('statusModel').textContent = labels[model] || model;
    }

    async saveSettings() {
        const newConfig = {
            ...this.config,
            deepseek_api_key: document.getElementById('settingsDeepseekKey').value.trim(),
            kimi_api_key: document.getElementById('settingsKimiKey').value.trim(),
            proxy: document.getElementById('settingsProxy').value.trim(),
            deepseek_model: document.getElementById('settingsModel').value,
            theme: document.getElementById('settingsTheme').value,
            font_size: parseInt(document.getElementById('settingsFontSize').value),
            font_family: document.getElementById('settingsFont').value,
            tab_size: parseInt(document.getElementById('settingsTabSize').value),
            auto_save: document.getElementById('settingsAutoSave').checked,
            word_wrap: document.getElementById('settingsWordWrap').checked,
            system_prompt: document.getElementById('settingsSystemPrompt').value,
        };
        try {
            await invoke('config_save', { config: newConfig });
            this.config = newConfig;
            this.wordWrap = newConfig.word_wrap;
            this.applyTheme();
            document.getElementById('statusModel').textContent = newConfig.deepseek_model;
            document.getElementById('statusWordWrap').textContent = `换行: ${newConfig.word_wrap ? '开' : '关'}`;
            // 更新所有已打开编辑器
            this.editors.forEach((ed, path) => {
                if (ed.updateOptions) {
                    ed.updateOptions({
                        fontSize: newConfig.font_size,
                        fontFamily: newConfig.font_family,
                        tabSize: newConfig.tab_size,
                        wordWrap: newConfig.word_wrap ? 'on' : 'off',
                        theme: newConfig.theme === 'vs' ? 'vs' : 'my-dark',
                    });
                }
            });
            this.updateAIPanelState();
            this.toast('设置已保存', 'success');
        } catch (e) {
            this.toast(`保存设置失败: ${e}`, 'error');
        }
    }

    // ── 全局搜索（调用后端 fs_search，搜索所有文件）─────────────────────────
    async searchFiles(query) {
        const results = document.getElementById('searchResults');
        if (!query.trim()) { results.innerHTML = ''; return; }
        results.innerHTML = '<div style="padding:8px 12px;color:var(--fg-dim);font-size:12px">搜索中...</div>';

        const caseSensitive = document.getElementById('searchCaseSensitive').checked;

        try {
            let rawResults;
            if (this.openedFolder) {
                // 后端搜索所有文件
                rawResults = await invoke('fs_search', { cwd: this.openedFolder, query, caseSensitive });
            } else {
                // 无文件夹时仅搜索已打开文件
                rawResults = [];
                for (const [path, editor] of this.editors) {
                    const content = editor.getValue ? editor.getValue() : '';
                    content.split('\n').forEach((line, i) => {
                        const lc = caseSensitive ? line : line.toLowerCase();
                        const qc = caseSensitive ? query : query.toLowerCase();
                        if (lc.includes(qc)) rawResults.push({ file: path, line: i + 1, content: line.trim() });
                    });
                }
            }

            results.innerHTML = '';
            if (!rawResults.length) {
                results.innerHTML = '<div style="padding:8px 12px;color:var(--fg-dim);font-size:12px">无匹配结果。</div>';
                return;
            }

            // 按文件分组
            const byFile = new Map();
            rawResults.forEach(r => {
                if (!byFile.has(r.file)) byFile.set(r.file, []);
                byFile.get(r.file).push(r);
            });

            const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            byFile.forEach((lines, filePath) => {
                const fname = filePath.replace(/\\/g, '/').split('/').pop();
                const fileEl = document.createElement('div');
                fileEl.className = 'search-result-file';
                fileEl.innerHTML = `${this.escapeHtml(fname)} <span class="search-result-count">${lines.length} 处</span>`;
                fileEl.title = filePath;
                results.appendChild(fileEl);

                lines.slice(0, 20).forEach(r => {
                    const lineEl = document.createElement('div');
                    lineEl.className = 'search-result-line';
                    const escaped = this.escapeHtml(r.content);
                    const highlighted = escaped.replace(new RegExp(escapedQuery, caseSensitive ? 'g' : 'gi'), '<mark>$&</mark>');
                    lineEl.innerHTML = `<span class="search-line-num">${r.line}</span><span class="search-line-content">${highlighted}</span>`;
                    lineEl.addEventListener('click', () => {
                        this.openFile(filePath, fname);
                        setTimeout(() => {
                            const ed = this.editors.get(filePath);
                            if (ed?.revealLineInCenter) ed.revealLineInCenter(r.line);
                            if (ed?.setPosition) ed.setPosition({ lineNumber: r.line, column: 1 });
                        }, 300);
                    });
                    results.appendChild(lineEl);
                });
            });

            if (rawResults.length >= 500) {
                const note = document.createElement('div');
                note.style.cssText = 'padding:6px 12px;color:var(--fg-dim);font-size:11px';
                note.textContent = '结果过多，已截断至 500 条';
                results.appendChild(note);
            }
        } catch (e) {
            results.innerHTML = `<div style="padding:8px 12px;color:var(--error);font-size:12px">搜索出错: ${this.escapeHtml(String(e))}</div>`;
        }
    }

    // ── 命令面板 ──────────────────────────────────────────────────────────────
    openCommandPalette() {
        const overlay = document.getElementById('cmdOverlay');
        overlay.classList.add('active');
        const input = document.getElementById('cmdInput');
        input.value = '';
        input.focus();
        this.renderCmdList('');
    }

    renderCmdList(query) {
        const commands = [
            { section: '文件' },
            { label: '打开文件夹...', shortcut: 'Ctrl+Shift+O', action: () => this.openFolderDialog() },
            { label: '新建文件', action: () => { if (this.openedFolder) this.newFileInDir(this.openedFolder); else this.toast('请先打开文件夹', 'warning'); } },
            { label: '保存', shortcut: 'Ctrl+S', action: () => { if (this.activeTab) this.saveFile(this.activeTab); } },
            { label: '关闭标签页', shortcut: 'Ctrl+W', action: () => { if (this.activeTab) this.closeTab(this.activeTab); } },
            { section: '视图' },
            { label: '资源管理器', shortcut: 'Ctrl+Shift+E', action: () => this.switchView('explorer') },
            { label: '全局搜索', shortcut: 'Ctrl+Shift+F', action: () => this.switchView('search') },
            { label: '源代码管理', shortcut: 'Ctrl+Shift+G', action: () => this.switchView('scm') },
            { label: '设置', shortcut: 'Ctrl+,', action: () => this.switchView('settings') },
            { label: '切换自动换行', action: () => this.toggleWordWrap() },
            { section: '终端' },
            { label: '新建终端', shortcut: 'Ctrl+`', action: () => { this.createTerminal(this.openedFolder || '.'); } },
            { section: 'Git' },
            { label: '刷新 Git 状态', action: () => this.refreshGit() },
            { label: '暂存所有更改', action: async () => { if (this.openedFolder) { await invoke('git_add', { cwd: this.openedFolder, path: '.' }); await this.refreshGit(); } } },
        ];

        const filtered = query
            ? commands.filter(c => !c.section && c.label.toLowerCase().includes(query.toLowerCase()))
            : commands;

        const list = document.getElementById('cmdList');
        list.innerHTML = '';
        this.cmdItems = filtered.filter(c => !c.section);
        this.cmdSelectedIdx = 0;

        let itemIdx = 0;
        filtered.forEach(cmd => {
            if (cmd.section) {
                if (!query) {
                    const sec = document.createElement('div');
                    sec.className = 'cmd-section';
                    sec.textContent = cmd.section;
                    list.appendChild(sec);
                }
                return;
            }
            const el = document.createElement('div');
            el.className = 'cmd-item' + (itemIdx === 0 ? ' selected' : '');
            el.innerHTML = `<span>${this.escapeHtml(cmd.label)}</span><span class="shortcut">${cmd.shortcut || ''}</span>`;
            el.addEventListener('click', () => {
                document.getElementById('cmdOverlay').classList.remove('active');
                cmd.action();
            });
            list.appendChild(el);
            itemIdx++;
        });
    }

    // ── 文件快速打开（Ctrl+P）─────────────────────────────────────────────────
    openFilePicker() {
        const overlay = document.getElementById('filePickerOverlay');
        overlay.classList.add('active');
        const input = document.getElementById('filePickerInput');
        input.value = '';
        input.focus();
        this._filePickerIdx = 0;
        this.renderFilePicker('');
    }

    async renderFilePicker(query) {
        const list = document.getElementById('filePickerList');
        list.innerHTML = '';

        if (!this.openedFolder) {
            list.innerHTML = '<div style="padding:12px 16px;color:var(--fg-dim);font-size:13px">请先打开文件夹</div>';
            return;
        }

        // 已打开标签优先显示
        const openPaths = new Set(this.tabs.map(t => t.path));

        let allFiles;
        try {
            allFiles = await invoke('fs_find_files', { cwd: this.openedFolder });
        } catch {
            // 降级到内存文件树
            allFiles = this.collectAllFiles(this.fileTree, []).map(f => f.path);
        }

        const matched = query
            ? allFiles.filter(p => p.replace(/\\/g, '/').split('/').pop().toLowerCase().includes(query.toLowerCase()))
            : allFiles;

        // 最近打开的排在最前
        matched.sort((a, b) => {
            const aOpen = openPaths.has(a.replace(/\\/g, '/')) ? 0 : 1;
            const bOpen = openPaths.has(b.replace(/\\/g, '/')) ? 0 : 1;
            return aOpen - bOpen;
        });

        this._filePickerFiles = matched;
        this._filePickerIdx = 0;

        matched.slice(0, 30).forEach((filePath, idx) => {
            const fp = filePath.replace(/\\/g, '/');
            const name = fp.split('/').pop();
            const relPath = fp.replace(this.openedFolder + '/', '');
            const el = document.createElement('div');
            el.className = 'cmd-item' + (idx === 0 ? ' selected' : '');
            const isOpen = openPaths.has(fp);
            el.innerHTML = `<span>${this.escapeHtml(name)}${isOpen ? ' <span style="color:var(--accent);font-size:10px">已打开</span>' : ''}</span><span class="shortcut" style="font-size:11px;max-width:250px;overflow:hidden;text-overflow:ellipsis">${this.escapeHtml(relPath)}</span>`;
            el.addEventListener('click', () => {
                document.getElementById('filePickerOverlay').classList.remove('active');
                this.openFile(fp, name);
            });
            list.appendChild(el);
        });

        if (matched.length === 0) {
            list.innerHTML = '<div style="padding:12px 16px;color:var(--fg-dim);font-size:13px">无匹配文件</div>';
        }
    }

    collectAllFiles(node, result) {
        if (!node) return result;
        if (!node.is_dir) result.push({ path: node.path, name: node.name });
        else if (node.children) node.children.forEach(c => this.collectAllFiles(c, result));
        return result;
    }

    // ── 右键菜单 ──────────────────────────────────────────────────────────────
    showContextMenu(event, node) {
        const menu = document.getElementById('ctxMenu');
        menu.innerHTML = '';
        menu.classList.remove('hidden');
        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY}px`;

        const addItem = (icon, label, action) => {
            const item = document.createElement('div');
            item.className = 'ctx-item';
            item.innerHTML = `<span class="ctx-icon">${icon}</span>${label}`;
            item.addEventListener('click', () => { menu.classList.add('hidden'); action(); });
            menu.appendChild(item);
        };
        const addSep = () => menu.appendChild(Object.assign(document.createElement('div'), { className: 'ctx-separator' }));

        if (!node.is_dir) {
            addItem('📖', '打开文件', () => this.openFile(node.path, node.name));
            addItem('📎', '添加到 AI 上下文', () => this.addFileToContext(node.path, node.name));
            addSep();
            addItem('📋', '复制相对路径', () => {
                const rel = node.path.replace(this.openedFolder + '/', '');
                navigator.clipboard?.writeText(rel);
                this.toast(`已复制: ${rel}`, 'success');
            });
            addItem('📋', '复制绝对路径', () => {
                navigator.clipboard?.writeText(node.path);
                this.toast('已复制绝对路径', 'success');
            });
            addSep();
        } else {
            addItem('📝', '新建文件', () => this.newFileInDir(node.path));
            addItem('📁', '新建文件夹', () => this.newFolderInDir(node.path));
            addSep();
            addItem('⚡', '在终端中打开', async () => { await this.createTerminal(node.path); });
            addSep();
        }
        addItem('🗑', '删除', async () => {
            if (!confirm(`确认删除 "${node.name}"？`)) return;
            await invoke('fs_delete_path', { path: node.path });
            await this.loadFileTree();
            this.toast(`已删除: ${node.name}`, 'success');
        });
    }

    async newFileInDir(dirPath) {
        const name = prompt('新建文件名:');
        if (!name) return;
        const path = `${dirPath}/${name}`;
        await invoke('fs_write_file', { path, content: '' });
        await this.loadFileTree();
        this.openFile(path, name);
    }

    async newFolderInDir(dirPath) {
        const name = prompt('新建文件夹名:');
        if (!name) return;
        await invoke('fs_create_dir', { path: `${dirPath}/${name}` });
        await this.loadFileTree();
    }

    // ── 视图/面板切换 ─────────────────────────────────────────────────────────
    switchView(view) {
        document.querySelectorAll('.activity-icon').forEach(el => {
            el.classList.toggle('active', el.dataset.view === view);
        });
        document.querySelectorAll('.sidebar-view').forEach(el => {
            el.classList.toggle('hidden', el.id !== `view-${view}`);
        });
        const titles = { explorer: '资源管理器', search: '搜索', scm: '源代码管理', settings: '设置' };
        document.getElementById('sidebarHeader').textContent = titles[view] || view;
        if (view === 'settings') this.loadSettingsUI();
        if (view === 'scm') this.refreshGit();
    }

    switchPanel(panel) {
        document.querySelectorAll('.panel-tab').forEach(el => el.classList.toggle('active', el.dataset.panel === panel));
        document.querySelectorAll('.panel-view').forEach(el => el.classList.toggle('active', el.id === `panel-${panel}`));
        if (panel === 'terminal' && this.activeTerminal) {
            const t = this.terminals.get(this.activeTerminal);
            if (t) { try { t.fitAddon.fit(); t.term.focus(); } catch {} }
        }
    }

    toggleWordWrap() {
        this.wordWrap = !this.wordWrap;
        document.getElementById('statusWordWrap').textContent = `换行: ${this.wordWrap ? '开' : '关'}`;
        this.editors.forEach(ed => { if (ed.updateOptions) ed.updateOptions({ wordWrap: this.wordWrap ? 'on' : 'off' }); });
    }

    togglePanel() {
        this.panelMinimized = !this.panelMinimized;
        const panel = document.getElementById('panel');
        panel.classList.toggle('minimized', this.panelMinimized);
        document.getElementById('panelToggleBtn').textContent = this.panelMinimized ? '▲' : '▼';
    }

    toggleAIPanel() {
        const panel = document.getElementById('aiPanel');
        const isCollapsed = panel.classList.toggle('collapsed');
        document.getElementById('aiCollapseBtn').textContent = isCollapsed ? '«' : '»';
        this.editors.forEach(ed => { if (ed.layout) setTimeout(() => ed.layout(), 0); });
    }

    // ── 代码块复制 ────────────────────────────────────────────────────────────
    copyCode(btn) {
        const code = btn.nextElementSibling?.textContent || '';
        navigator.clipboard?.writeText(code).then(() => {
            btn.textContent = '✓ 已复制';
            setTimeout(() => { btn.textContent = '复制'; }, 2000);
        });
    }

    // ── Toast ─────────────────────────────────────────────────────────────────
    toast(msg, type = 'info') {
        const wrap = document.getElementById('toastWrap');
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.textContent = msg;
        wrap.appendChild(el);
        setTimeout(() => { el.style.animation = 'toastIn 0.25s ease reverse'; setTimeout(() => el.remove(), 250); }, 3000);
    }

    log(msg) {
        const out = document.getElementById('outputContent');
        out.textContent += '\n' + msg;
        out.scrollTop = out.scrollHeight;
    }

    escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ── UI 初始化 ─────────────────────────────────────────────────────────────
    initUI() {
        // 活动栏
        document.querySelectorAll('.activity-icon[data-view]').forEach(el => {
            el.addEventListener('click', () => this.switchView(el.dataset.view));
        });
        // 面板标签
        document.querySelectorAll('.panel-tab[data-panel]').forEach(el => {
            el.addEventListener('click', () => this.switchPanel(el.dataset.panel));
        });
        // 新建终端
        document.getElementById('newTerminalBtn').addEventListener('click', async () => {
            await this.createTerminal(this.openedFolder || await invoke('fs_get_cwd').catch(() => '.'));
        });
        // 面板最小化
        document.getElementById('panelToggleBtn').addEventListener('click', () => this.togglePanel());
        // 面板标签栏拖拽
        this.initPanelResizer();
        // 左侧边栏拖拽
        this.initSidebarResizer();
        // 右侧 AI 面板拖拽
        this.initAIPanelResizer();

        // AI 发送
        document.getElementById('aiSendBtn').addEventListener('click', () => this.handleAISend());
        document.getElementById('aiInput').addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.handleAISend(); }
        });
        // AI 停止
        document.getElementById('aiStopBtn').addEventListener('click', () => this.stopAI());
        // AI 清空
        document.getElementById('aiClearBtn').addEventListener('click', () => {
            if (!confirm('确认清空当前对话？')) return;
            const s = this.currentSession;
            if (s) { s.messages = []; s.tokens = 0; }
            document.getElementById('aiMsgs').innerHTML = '';
            this.updateTokenBar();
        });
        // AI 收起
        document.getElementById('aiCollapseBtn').addEventListener('click', () => this.toggleAIPanel());
        // AI 模式切换
        document.getElementById('aiModeBtn').addEventListener('click', () => {
            this.agentMode = this.agentMode === 'approval' ? 'autonomous' : 'approval';
            const btn = document.getElementById('aiModeBtn');
            btn.textContent = this.agentMode === 'approval' ? '审批模式' : '自主模式';
            btn.className = `ai-mode-btn ${this.agentMode}`;
            this.toast(`已切换为${this.agentMode === 'approval' ? '审批' : '自主'}模式`);
        });
        // AI 新会话
        document.getElementById('aiNewSession').addEventListener('click', () => this.newSession());
        this.renderSessionTabs();

        // AI 快速模型选择器
        document.getElementById('aiModelQuick').addEventListener('change', e => {
            this.config.deepseek_model = e.target.value;
            invoke('config_save', { config: this.config }).catch(() => {});
            this.updateAIPanelState();
            this.toast(`模型已切换: ${e.target.value}`);
        });
        // AI 面板打开设置
        document.getElementById('aiOpenSettings').addEventListener('click', () => {
            document.querySelector('.activity-btn[data-view="settings"]')?.click();
        });

        // AI 输入粘贴图片（需要 Kimi Key）
        document.getElementById('aiInput').addEventListener('paste', e => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    if (!this.config.kimi_api_key) {
                        this.toast('请先在设置中配置 Kimi API Key 以使用图片分析', 'warning');
                        return;
                    }
                    const file = item.getAsFile();
                    const reader = new FileReader();
                    reader.onload = ev => {
                        this.attachedImage = ev.target.result.split(',')[1];
                        document.getElementById('aiImageThumb').src = ev.target.result;
                        document.getElementById('aiImageName').textContent = file?.name || '截图';
                        document.getElementById('aiImagePreview').style.display = 'flex';
                    };
                    reader.readAsDataURL(file);
                    break;
                }
            }
        });
        // AI 输入自动调整高度
        document.getElementById('aiInput').addEventListener('input', e => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
        });
        document.getElementById('aiImageRemove').addEventListener('click', () => {
            this.attachedImage = null;
            document.getElementById('aiImagePreview').style.display = 'none';
        });

        // AI 输入区拖入图片（需要 Kimi Key）
        const aiInputArea = document.getElementById('aiInput');
        aiInputArea.addEventListener('dragover', e => e.preventDefault());
        aiInputArea.addEventListener('drop', e => {
            e.preventDefault();
            const file = [...(e.dataTransfer?.files || [])].find(f => f.type.startsWith('image/'));
            if (!file) return;
            if (!this.config.kimi_api_key) {
                this.toast('请先在设置中配置 Kimi API Key 以使用图片分析', 'warning');
                return;
            }
            const reader = new FileReader();
            reader.onload = ev => {
                this.attachedImage = ev.target.result.split(',')[1];
                document.getElementById('aiImageThumb').src = ev.target.result;
                document.getElementById('aiImageName').textContent = file.name;
                document.getElementById('aiImagePreview').style.display = 'flex';
            };
            reader.readAsDataURL(file);
        });

        // 添加文件到上下文（通过 renderContextBar 动态注册）
        this.renderContextBar();

        // 设置
        document.getElementById('settingsSaveBtn').addEventListener('click', () => this.saveSettings());

        // SCM 操作
        document.getElementById('stageAllBtn').addEventListener('click', async () => {
            if (!this.openedFolder) return;
            await invoke('git_add', { cwd: this.openedFolder, path: '.' });
            await this.refreshGit();
        });
        document.getElementById('unstageAllBtn').addEventListener('click', async () => {
            if (!this.openedFolder) return;
            await invoke('git_unstage', { cwd: this.openedFolder, path: '.' });
            await this.refreshGit();
        });
        document.getElementById('commitBtn').addEventListener('click', async () => {
            const msg = document.getElementById('commitMessage').value.trim();
            if (!msg) { this.toast('请输入提交消息', 'warning'); return; }
            if (!this.openedFolder) { this.toast('未打开文件夹', 'error'); return; }
            try {
                await invoke('git_commit', { cwd: this.openedFolder, message: msg });
                document.getElementById('commitMessage').value = '';
                await this.refreshGit();
                this.toast('提交成功！', 'success');
            } catch (e) { this.toast(`提交失败: ${e}`, 'error'); }
        });
        document.getElementById('commitMessage').addEventListener('keydown', e => {
            if (e.key === 'Enter' && e.ctrlKey) document.getElementById('commitBtn').click();
        });
        document.getElementById('gitRefreshBtn').addEventListener('click', () => this.refreshGit());
        document.getElementById('gitPullBtn').addEventListener('click', async () => {
            if (!this.openedFolder) return;
            this.toast('正在拉取...', 'info');
            try {
                const result = await invoke('git_pull', { cwd: this.openedFolder });
                await this.refreshGit();
                this.toast(result || '拉取成功', 'success');
            } catch (e) { this.toast(`拉取失败: ${e}`, 'error'); }
        });
        document.getElementById('gitPushBtn').addEventListener('click', async () => {
            if (!this.openedFolder) return;
            this.toast('正在推送...', 'info');
            try {
                const result = await invoke('git_push', { cwd: this.openedFolder });
                this.toast(result || '推送成功', 'success');
            } catch (e) { this.toast(`推送失败: ${e}`, 'error'); }
        });

        // Diff 面板按钮
        document.getElementById('diffApplyBtn').addEventListener('click', () => this.diffApply());
        document.getElementById('diffRejectBtn').addEventListener('click', () => this.diffReject());

        // 状态栏
        document.getElementById('statusFolder').addEventListener('click', () => this.openFolderDialog());
        document.getElementById('statusWordWrap').addEventListener('click', () => this.toggleWordWrap());
        document.getElementById('statusModel').addEventListener('click', () => {
            const cycle = ['deepseek-v4-flash', 'deepseek-v4-flash-nothink', 'deepseek-v4-pro', 'deepseek-v4-pro-nothink'];
            const cur = this.config.deepseek_model || 'deepseek-v4-flash';
            const idx = cycle.indexOf(cur);
            this.config.deepseek_model = cycle[(idx + 1) % cycle.length];
            const labels = { 'deepseek-v4-flash': 'Flash(思考)', 'deepseek-v4-flash-nothink': 'Flash(极速)', 'deepseek-v4-pro': 'Pro(思考)', 'deepseek-v4-pro-nothink': 'Pro(快速)' };
            document.getElementById('statusModel').textContent = labels[this.config.deepseek_model] || this.config.deepseek_model;
            invoke('config_save', { config: this.config }).catch(() => {});
            this.toast(`已切换: ${this.config.deepseek_model}`);
        });

        // 搜索
        document.getElementById('searchInput').addEventListener('input', e => {
            clearTimeout(this._searchTimer);
            this._searchTimer = setTimeout(() => this.searchFiles(e.target.value), 300);
        });

        // 菜单栏
        this.initMenuBar();

        // 全局快捷键
        document.addEventListener('keydown', e => {
            const ctrlOrCmd = e.ctrlKey || e.metaKey;
            if (ctrlOrCmd && !e.shiftKey && e.key === 'p') {
                e.preventDefault(); this.openFilePicker();
            }
            if (ctrlOrCmd && e.shiftKey && e.key === 'P') {
                e.preventDefault(); this.openCommandPalette();
            }
            if (ctrlOrCmd && e.shiftKey && e.key === 'E') { e.preventDefault(); this.switchView('explorer'); }
            if (ctrlOrCmd && e.shiftKey && e.key === 'F') { e.preventDefault(); this.switchView('search'); }
            if (ctrlOrCmd && e.shiftKey && e.key === 'G') { e.preventDefault(); this.switchView('scm'); }
            if (ctrlOrCmd && e.key === ',') { e.preventDefault(); this.switchView('settings'); }
            if (ctrlOrCmd && e.key === 's' && this.activeTab) { e.preventDefault(); this.saveFile(this.activeTab); }
            if (ctrlOrCmd && e.key === 'w' && this.activeTab) { e.preventDefault(); this.closeTab(this.activeTab); }
            if (ctrlOrCmd && e.key === 'Tab') {
                e.preventDefault();
                if (this.tabs.length > 1) {
                    const idx = this.tabs.findIndex(t => t.path === this.activeTab);
                    const next = this.tabs[(idx + 1) % this.tabs.length];
                    this.activateTab(next.path);
                }
            }
            if (ctrlOrCmd && e.key === '`') {
                e.preventDefault();
                this.switchPanel('terminal');
                if (this.panelMinimized) this.togglePanel();
                if (this.activeTerminal) {
                    const t = this.terminals.get(this.activeTerminal);
                    if (t) { try { t.fitAddon.fit(); t.term.focus(); } catch {} }
                }
            }
            if (e.key === 'Escape') {
                document.getElementById('cmdOverlay').classList.remove('active');
                document.getElementById('filePickerOverlay').classList.remove('active');
                document.getElementById('ctxMenu').classList.add('hidden');
            }
        });

        // 命令面板输入
        document.getElementById('cmdInput').addEventListener('input', e => this.renderCmdList(e.target.value));
        document.getElementById('cmdInput').addEventListener('keydown', e => {
            const items = document.querySelectorAll('#cmdList .cmd-item');
            if (e.key === 'ArrowDown') { this.cmdSelectedIdx = Math.min(this.cmdSelectedIdx + 1, items.length - 1); }
            else if (e.key === 'ArrowUp') { this.cmdSelectedIdx = Math.max(this.cmdSelectedIdx - 1, 0); }
            else if (e.key === 'Enter') {
                if (this.cmdItems[this.cmdSelectedIdx]) {
                    document.getElementById('cmdOverlay').classList.remove('active');
                    this.cmdItems[this.cmdSelectedIdx].action();
                }
                return;
            } else if (e.key === 'Escape') { document.getElementById('cmdOverlay').classList.remove('active'); return; }
            items.forEach((el, i) => el.classList.toggle('selected', i === this.cmdSelectedIdx));
        });
        document.getElementById('cmdOverlay').addEventListener('click', e => {
            if (e.target === document.getElementById('cmdOverlay')) document.getElementById('cmdOverlay').classList.remove('active');
        });

        // 文件选择器
        document.getElementById('filePickerInput').addEventListener('input', e => {
            clearTimeout(this._filePickerTimer);
            this._filePickerTimer = setTimeout(() => this.renderFilePicker(e.target.value), 80);
        });
        document.getElementById('filePickerInput').addEventListener('keydown', e => {
            const items = document.querySelectorAll('#filePickerList .cmd-item');
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this._filePickerIdx = Math.min((this._filePickerIdx || 0) + 1, items.length - 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this._filePickerIdx = Math.max((this._filePickerIdx || 0) - 1, 0);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                const files = this._filePickerFiles;
                const idx = this._filePickerIdx || 0;
                if (files && files[idx]) {
                    document.getElementById('filePickerOverlay').classList.remove('active');
                    const fp = files[idx].replace(/\\/g, '/');
                    this.openFile(fp, fp.split('/').pop());
                }
                return;
            } else if (e.key === 'Escape') {
                document.getElementById('filePickerOverlay').classList.remove('active');
                return;
            }
            items.forEach((el, i) => el.classList.toggle('selected', i === (this._filePickerIdx || 0)));
        });
        document.getElementById('filePickerOverlay').addEventListener('click', e => {
            if (e.target === document.getElementById('filePickerOverlay')) document.getElementById('filePickerOverlay').classList.remove('active');
        });

        // 关闭右键菜单
        document.addEventListener('click', () => document.getElementById('ctxMenu').classList.add('hidden'));
    }

    handleAISend() {
        const input = document.getElementById('aiInput');
        const text = input.value.trim();
        if (!text && !this.attachedImage) return;
        if (this.aiStreaming) { this.toast('AI 正在生成中，请等待或点击停止', 'warning'); return; }
        input.value = '';
        input.style.height = 'auto';
        const img = this.attachedImage;
        this.attachedImage = null;
        document.getElementById('aiImagePreview').style.display = 'none';
        this.sendAIMessage(text, img);
    }

    initSidebarResizer() {
        const resizer = document.getElementById('sidebarResizer');
        const sidebar = document.getElementById('sidebar');
        let startX, startW;
        resizer.addEventListener('mousedown', e => {
            startX = e.clientX; startW = sidebar.offsetWidth;
            resizer.classList.add('dragging');
            const onMove = e => { sidebar.style.width = Math.max(120, Math.min(600, startW + e.clientX - startX)) + 'px'; };
            const onUp = () => {
                resizer.classList.remove('dragging');
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                this.editors.forEach(ed => { if (ed.layout) ed.layout(); });
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    initAIPanelResizer() {
        const resizer = document.getElementById('aiPanelResizer');
        const panel = document.getElementById('aiPanel');
        let startX, startW;
        resizer.addEventListener('mousedown', e => {
            startX = e.clientX; startW = panel.offsetWidth;
            resizer.classList.add('dragging');
            const onMove = e => { panel.style.width = Math.max(200, Math.min(700, startW - (e.clientX - startX))) + 'px'; };
            const onUp = () => {
                resizer.classList.remove('dragging');
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                this.editors.forEach(ed => { if (ed.layout) ed.layout(); });
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    initPanelResizer() {
        const panel = document.getElementById('panel');
        let startY, startH, dragging = false;
        panel.querySelector('.panel-tabs').addEventListener('mousedown', e => {
            if (e.target.closest('button') || e.target.closest('.panel-tab')) return;
            startY = e.clientY; startH = panel.offsetHeight; dragging = true;
            const onMove = e => {
                if (!dragging) return;
                panel.style.height = Math.max(35, Math.min(window.innerHeight - 150, startH - (e.clientY - startY))) + 'px';
                if (this.panelMinimized && panel.offsetHeight > 50) {
                    this.panelMinimized = false;
                    panel.classList.remove('minimized');
                    document.getElementById('panelToggleBtn').textContent = '▼';
                    panel.querySelector('.panel-content').style.display = '';
                }
            };
            const onUp = () => { dragging = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    initMenuBar() {
        const menus = {
            file: [
                { label: '打开文件夹...', shortcut: 'Ctrl+Shift+O', action: () => this.openFolderDialog() },
                { label: '新建文件', action: () => { if (this.openedFolder) this.newFileInDir(this.openedFolder); else this.toast('请先打开文件夹', 'warning'); } },
                { separator: true },
                { label: '保存', shortcut: 'Ctrl+S', action: () => { if (this.activeTab) this.saveFile(this.activeTab); } },
                { label: '关闭标签页', shortcut: 'Ctrl+W', action: () => { if (this.activeTab) this.closeTab(this.activeTab); } },
            ],
            edit: [
                { label: '查找', shortcut: 'Ctrl+F', action: () => { const ed = this.editors.get(this.activeTab); if (ed?.trigger) ed.trigger('', 'actions.find'); } },
                { label: '替换', shortcut: 'Ctrl+H', action: () => { const ed = this.editors.get(this.activeTab); if (ed?.trigger) ed.trigger('', 'editor.action.startFindReplaceAction'); } },
                { separator: true },
                { label: '切换自动换行', action: () => this.toggleWordWrap() },
            ],
            view: [
                { label: '资源管理器', shortcut: 'Ctrl+Shift+E', action: () => this.switchView('explorer') },
                { label: '全局搜索', shortcut: 'Ctrl+Shift+F', action: () => this.switchView('search') },
                { label: '源代码管理', shortcut: 'Ctrl+Shift+G', action: () => this.switchView('scm') },
                { label: '设置', shortcut: 'Ctrl+,', action: () => this.switchView('settings') },
                { separator: true },
                { label: '快速打开文件', shortcut: 'Ctrl+P', action: () => this.openFilePicker() },
                { label: '命令面板', shortcut: 'Ctrl+Shift+P', action: () => this.openCommandPalette() },
                { separator: true },
                { label: '切换 AI 面板', action: () => this.toggleAIPanel() },
            ],
            terminal: [
                { label: '新建终端', shortcut: 'Ctrl+`', action: async () => { await this.createTerminal(this.openedFolder || '.'); } },
            ],
            git: [
                { label: '刷新状态', action: () => this.refreshGit() },
                { label: '拉取', action: () => document.getElementById('gitPullBtn').click() },
                { label: '推送', action: () => document.getElementById('gitPushBtn').click() },
            ],
            help: [
                { label: '关于 My IDE', action: () => this.toast('My IDE v0.1.0 — DeepSeek API + Kimi Vision') },
            ],
        };

        document.querySelectorAll('.menu-item[data-menu]').forEach(item => {
            const menuName = item.dataset.menu;
            item.addEventListener('click', e => {
                e.stopPropagation();
                document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('open'));
                document.querySelectorAll('.menu-dropdown').forEach(d => { d.classList.remove('active'); d.remove(); });
                const menuDef = menus[menuName] || [];
                const dropdown = document.createElement('div');
                dropdown.className = 'menu-dropdown active';
                menuDef.forEach(def => {
                    if (def.separator) {
                        dropdown.appendChild(Object.assign(document.createElement('div'), { className: 'menu-separator' }));
                    } else {
                        const el = document.createElement('div');
                        el.className = 'menu-dropdown-item';
                        el.innerHTML = `${this.escapeHtml(def.label)}<span class="shortcut">${def.shortcut || ''}</span>`;
                        el.addEventListener('click', () => {
                            document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('open'));
                            document.querySelectorAll('.menu-dropdown').forEach(d => { d.classList.remove('active'); d.remove(); });
                            def.action();
                        });
                        dropdown.appendChild(el);
                    }
                });
                item.classList.add('open');
                item.appendChild(dropdown);
            });
        });

        document.addEventListener('click', () => {
            document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('open'));
            document.querySelectorAll('.menu-dropdown').forEach(d => { d.classList.remove('active'); d.remove(); });
        });
    }
}

// ── 启动 ──────────────────────────────────────────────────────────────────────
window.IDE = new IDEApp();
