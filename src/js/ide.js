// DeepSeek IDE — Main frontend logic
// Uses window.__TAURI__ (withGlobalTauri: true in tauri.conf.json)

const invoke = (...args) => window.__TAURI__.core.invoke(...args);
const listen = (...args) => window.__TAURI__.event.listen(...args);

// ─── Language detection ───────────────────────────────────────────────────────
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
    const name = path.split('/').pop().toLowerCase();
    if (name === 'dockerfile') return 'dockerfile';
    if (name === 'makefile') return 'makefile';
    const ext = name.split('.').pop();
    return LANG_MAP[ext] || 'plaintext';
}

// ─── File icon ────────────────────────────────────────────────────────────────
function fileIcon(name, isDir) {
    if (isDir) return '📁';
    const ext = name.split('.').pop().toLowerCase();
    const icons = {
        js: '🟨', jsx: '⚛', ts: '🔷', tsx: '⚛', py: '🐍', go: '🐹',
        rs: '🦀', java: '☕', kt: '🟣', swift: '🧡',
        html: '🌐', css: '🎨', scss: '🎨', json: '📋', yaml: '📋', yml: '📋',
        toml: '📋', md: '📝', sql: '🗃', sh: '🐚', bat: '⚙',
        dockerfile: '🐳', gitignore: '🔒', lock: '🔒',
        png: '🖼', jpg: '🖼', jpeg: '🖼', gif: '🖼', svg: '🖼', webp: '🖼',
        pdf: '📄', zip: '📦', tar: '📦', gz: '📦',
    };
    return icons[ext] || '📄';
}

// ─── Main IDE class ───────────────────────────────────────────────────────────
class IDEApp {
    constructor() {
        this.monaco = null;
        this.editors = new Map();      // path → monaco editor instance
        this.tabs = [];                // [{path, name, dirty}]
        this.activeTab = null;
        this.openFolder = null;        // current folder path
        this.expandedDirs = new Set();
        this.fileTree = null;

        this.terminals = new Map();    // id → {xterm, fitAddon, element, tabEl}
        this.activeTerminal = null;

        this.config = {};
        this.agentMode = 'approval';   // 'approval' | 'autonomous'
        this.agentMessages = [];       // conversation history
        this.pendingToolCall = null;   // {id, name, arguments, resolve, reject}
        this.aiRequestId = null;
        this.aiListeners = [];         // active event listeners to clean up
        this.attachedImage = null;     // base64 image for Kimi

        this.contextFiles = [];        // files added to AI context

        this.diffEditor = null;        // Monaco diff editor
        this.pendingDiff = null;       // {path, originalContent, newContent, resolve}

        this.cmdItems = [];
        this.cmdSelectedIdx = 0;

        this.init();
    }

    async init() {
        try {
            this.config = await invoke('config_load');
        } catch (e) {
            this.config = {
                theme: 'vs-dark', font_size: 14,
                agent_mode: 'approval', deepseek_model: 'deepseek-chat',
                deepseek_api_key: '', kimi_api_key: '', proxy: ''
            };
        }

        this.agentMode = this.config.agent_mode || 'approval';
        this.applyTheme();
        this.initUI();
        await this.initMonaco();
        await this.initFirstTerminal();

        document.getElementById('loadingScreen').style.display = 'none';
        this.log('DeepSeek IDE ready.');
    }

    // ── Theme ─────────────────────────────────────────────────────────────────
    applyTheme() {
        const theme = this.config.theme || 'vs-dark';
        if (theme === 'vs') {
            document.body.classList.add('theme-light');
        } else {
            document.body.classList.remove('theme-light');
        }
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
                    monaco.editor.defineTheme('ds-dark', {
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
            div.style.padding = '16px';
            div.style.fontFamily = 'monospace';
            div.style.fontSize = '13px';
            div.style.whiteSpace = 'pre-wrap';
            div.style.overflow = 'auto';
            div.textContent = content;
            this.editors.set(path, { type: 'fallback', el: div, getValue: () => div.textContent, setValue: (v) => { div.textContent = v; } });
            return this.editors.get(path);
        }

        const lang = langFromPath(path);
        const model = this.monaco.editor.createModel(content, lang, this.monaco.Uri.file(path));
        const editor = this.monaco.editor.create(div, {
            model,
            theme: this.config.theme === 'vs-dark' ? 'ds-dark' : (this.config.theme || 'vs-dark'),
            fontSize: this.config.font_size || 14,
            fontFamily: '"Cascadia Code", "Fira Code", "SF Mono", Consolas, monospace',
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            renderLineHighlight: 'line',
            wordWrap: 'off',
            tabSize: 4,
            insertSpaces: true,
            formatOnPaste: false,
            suggestOnTriggerCharacters: true,
        });

        editor.onDidChangeCursorPosition((e) => {
            const pos = editor.getPosition();
            document.getElementById('statusCursor').textContent =
                `Ln ${pos.lineNumber}, Col ${pos.column}`;
        });

        editor.onDidChangeModelContent(() => {
            const tab = this.tabs.find(t => t.path === path);
            if (tab && !tab.dirty) {
                tab.dirty = true;
                this.renderTabs();
            }
        });

        editor.addCommand(this.monaco.KeyMod.CtrlCmd | this.monaco.KeyCode.KeyS, () => {
            this.saveFile(path);
        });

        this.editors.set(path, editor);
        return editor;
    }

    // ── File operations ───────────────────────────────────────────────────────
    async openFolder() {
        try {
            const { open } = window.__TAURI__.dialog;
            const selected = await open({ directory: true, multiple: false });
            if (!selected) return;
            this.openFolder = selected.replace(/\\/g, '/');
            await this.loadFileTree();
            await this.refreshGit();
            this.toast(`Opened: ${this.openFolder}`, 'success');
        } catch (e) {
            this.toast(`Failed to open folder: ${e}`, 'error');
        }
    }

    async loadFileTree() {
        if (!this.openFolder) return;
        try {
            this.fileTree = await invoke('fs_list_dir', { path: this.openFolder });
            this.renderFileTree();
            document.getElementById('statusBranch').textContent = this.fileTree.name;
        } catch (e) {
            this.toast(`Failed to load file tree: ${e}`, 'error');
        }
    }

    renderFileTree() {
        const container = document.getElementById('fileTree');
        container.innerHTML = '';
        if (!this.fileTree) return;
        this.renderTreeNode(this.fileTree, container, 0, true);
    }

    renderTreeNode(node, container, depth, isRoot = false) {
        if (isRoot) {
            if (node.children) {
                node.children.forEach(child => this.renderTreeNode(child, container, depth));
            }
            return;
        }

        const item = document.createElement('div');
        item.className = 'tree-item';
        item.style.paddingLeft = `${8 + depth * 16}px`;

        const indent = document.createElement('span');
        indent.className = 'tree-indent';

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
            item.appendChild(toggle);
            item.appendChild(icon);
            item.appendChild(label);
            container.appendChild(item);

            const childContainer = document.createElement('div');
            childContainer.className = 'tree-children';
            if (isExpanded) {
                childContainer.style.display = 'block';
                if (node.children) {
                    node.children.forEach(c => this.renderTreeNode(c, childContainer, depth + 1));
                }
            } else {
                childContainer.style.display = 'none';
            }
            container.appendChild(childContainer);

            item.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (this.expandedDirs.has(node.path)) {
                    this.expandedDirs.delete(node.path);
                    toggle.textContent = '▶';
                    icon.textContent = '📁';
                    childContainer.style.display = 'none';
                } else {
                    this.expandedDirs.add(node.path);
                    toggle.textContent = '▼';
                    icon.textContent = '📂';
                    // Load children if not yet loaded
                    if (!node.children || node.children.length === 0) {
                        try {
                            node.children = await invoke('fs_expand_dir', { path: node.path });
                        } catch (err) { /* ignore */ }
                    }
                    childContainer.innerHTML = '';
                    node.children.forEach(c => this.renderTreeNode(c, childContainer, depth + 1));
                    childContainer.style.display = 'block';
                }
            });

            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showContextMenu(e, node);
            });
        } else {
            toggle.textContent = '';
            icon.textContent = fileIcon(node.name, false);
            item.appendChild(toggle);
            item.appendChild(icon);
            item.appendChild(label);
            container.appendChild(item);

            item.addEventListener('click', () => this.openFile(node.path, node.name));
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showContextMenu(e, node);
            });
        }
    }

    async openFile(path, name) {
        // Check if already open
        const existing = this.tabs.find(t => t.path === path);
        if (existing) {
            this.activateTab(path);
            return;
        }

        try {
            const content = await invoke('fs_read_file', { path });
            this.tabs.push({ path, name, dirty: false });
            this.createEditor(path, content);
            this.renderTabs();
            this.activateTab(path);

            // Update language in status bar
            document.getElementById('statusLang').textContent = langFromPath(path);
        } catch (e) {
            this.toast(`Cannot open ${name}: ${e}`, 'error');
        }
    }

    activateTab(path) {
        this.activeTab = path;
        this.renderTabs();

        // Show/hide editor instances
        document.querySelectorAll('.editor-instance').forEach(el => {
            el.classList.toggle('active', el.dataset.path === path);
        });
        document.getElementById('emptyEditor').style.display = 'none';

        // Layout Monaco editor
        const editor = this.editors.get(path);
        if (editor && editor.layout) {
            setTimeout(() => editor.layout(), 0);
        }
    }

    renderTabs() {
        const bar = document.getElementById('tabBar');
        bar.innerHTML = '';
        this.tabs.forEach(tab => {
            const el = document.createElement('div');
            el.className = 'tab' + (tab.path === this.activeTab ? ' active' : '') + (tab.dirty ? ' dirty' : '');
            el.innerHTML = `
                <span class="tab-dirty"></span>
                <span class="tab-name" title="${tab.path}">${tab.name}</span>
                <span class="tab-close" data-path="${tab.path}">✕</span>
            `;
            el.addEventListener('click', (e) => {
                if (e.target.classList.contains('tab-close')) return;
                this.activateTab(tab.path);
            });
            el.querySelector('.tab-close').addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeTab(tab.path);
            });
            bar.appendChild(el);
        });
    }

    async saveFile(path) {
        const editor = this.editors.get(path);
        if (!editor) return;
        const content = editor.getValue ? editor.getValue() : (editor.el ? editor.el.textContent : '');
        try {
            await invoke('fs_write_file', { path, content });
            const tab = this.tabs.find(t => t.path === path);
            if (tab) { tab.dirty = false; this.renderTabs(); }
            this.log(`Saved: ${path}`);
        } catch (e) {
            this.toast(`Save failed: ${e}`, 'error');
        }
    }

    closeTab(path) {
        const idx = this.tabs.findIndex(t => t.path === path);
        if (idx === -1) return;
        const tab = this.tabs[idx];
        if (tab.dirty && !confirm(`Save changes to ${tab.name}?`)) return;
        if (tab.dirty) this.saveFile(path);

        this.tabs.splice(idx, 1);
        const editor = this.editors.get(path);
        if (editor && editor.dispose) editor.dispose();
        const el = document.querySelector(`.editor-instance[data-path="${path}"]`);
        if (el) el.remove();
        this.editors.delete(path);

        if (this.activeTab === path) {
            const next = this.tabs[Math.min(idx, this.tabs.length - 1)];
            if (next) {
                this.activateTab(next.path);
            } else {
                this.activeTab = null;
                document.getElementById('emptyEditor').style.display = 'flex';
                document.getElementById('statusLang').textContent = '—';
            }
        }
        this.renderTabs();
    }

    // ── Git ───────────────────────────────────────────────────────────────────
    async refreshGit() {
        if (!this.openFolder) return;
        try {
            const isRepo = await invoke('git_is_repo', { cwd: this.openFolder });
            if (!isRepo) {
                document.getElementById('statusBranch').textContent = this.fileTree?.name || 'No git';
                return;
            }
            const status = await invoke('git_status', { cwd: this.openFolder });
            document.getElementById('statusBranch').textContent = `⎇ ${status.branch}`;
            this.renderSCM(status);
        } catch (e) {
            // not a git repo, that's fine
        }
    }

    renderSCM(status) {
        const changesEl = document.getElementById('changesList');
        const stagedEl = document.getElementById('stagedList');
        document.getElementById('changesCount').textContent = status.changes.length;
        document.getElementById('stagedCount').textContent = status.staged.length;

        const makeItem = (change, isStaged) => {
            const el = document.createElement('div');
            el.className = 'scm-item';
            const statusClass = { M: 'scm-M', A: 'scm-A', D: 'scm-D', U: 'scm-U' };
            el.innerHTML = `
                <span class="scm-status ${statusClass[change.status] || ''}">${change.status}</span>
                <span class="tree-label">${change.path}</span>
                <button class="scm-btn" title="${isStaged ? 'Unstage' : 'Stage'}">${isStaged ? '-' : '+'}</button>
            `;
            el.querySelector('button').addEventListener('click', async (e) => {
                e.stopPropagation();
                if (isStaged) {
                    await invoke('git_unstage', { cwd: this.openFolder, path: change.path });
                } else {
                    await invoke('git_add', { cwd: this.openFolder, path: change.path });
                }
                await this.refreshGit();
            });
            el.addEventListener('click', async () => {
                const diff = await invoke('git_diff', { cwd: this.openFolder, file: change.path });
                this.showDiffText(change.path, diff);
            });
            return el;
        };

        changesEl.innerHTML = '';
        status.changes.forEach(c => changesEl.appendChild(makeItem(c, false)));
        stagedEl.innerHTML = '';
        status.staged.forEach(c => stagedEl.appendChild(makeItem(c, true)));

        this.renderCommitLog();
    }

    async renderCommitLog() {
        if (!this.openFolder) return;
        try {
            const commits = await invoke('git_log', { cwd: this.openFolder });
            const el = document.getElementById('commitLog');
            el.innerHTML = '';
            commits.forEach(c => {
                const item = document.createElement('div');
                item.className = 'commit-log-item';
                item.innerHTML = `<span class="commit-hash">${c.hash}</span><span class="commit-msg">${c.message}</span><div class="commit-meta">${c.author} · ${c.date}</div>`;
                el.appendChild(item);
            });
        } catch { /* ignore */ }
    }

    showDiffText(path, diffText) {
        // Show diff in output panel
        document.getElementById('outputContent').textContent = diffText || '(no diff)';
        this.switchPanel('output');
    }

    // ── Terminal ──────────────────────────────────────────────────────────────
    async initFirstTerminal() {
        const cwd = this.openFolder || await invoke('fs_get_cwd');
        await this.createTerminal(cwd);
    }

    async createTerminal(cwd) {
        if (!window.Terminal) {
            this.log('xterm.js not loaded — terminal unavailable');
            return;
        }

        const id = await invoke('terminal_create', { cwd });

        const term = new Terminal({
            fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
            fontSize: 13,
            theme: {
                background: '#0d0d0d',
                foreground: '#cccccc',
                cursor: '#ffffff',
                selectionBackground: '#264f78',
            },
            cursorBlink: true,
        });

        const fitAddon = new FitAddon.FitAddon();
        term.loadAddon(fitAddon);

        // Create container element
        const body = document.getElementById('terminalBody');
        const container = document.createElement('div');
        container.style.cssText = 'width:100%;height:100%;display:none';
        container.dataset.termId = id;
        body.appendChild(container);

        term.open(container);
        fitAddon.fit();

        // Create tab
        const tabEl = document.createElement('div');
        tabEl.className = 'terminal-tab';
        tabEl.dataset.termId = id;
        tabEl.innerHTML = `bash <span class="terminal-tab-close">✕</span>`;
        tabEl.addEventListener('click', (e) => {
            if (e.target.classList.contains('terminal-tab-close')) {
                this.closeTerminal(id);
                return;
            }
            this.activateTerminal(id);
        });

        const newBtn = document.getElementById('newTerminalBtn');
        newBtn.parentElement.insertBefore(tabEl, newBtn);

        this.terminals.set(id, { term, fitAddon, container, tabEl });

        // Listen for output
        const unlisten = await listen(`terminal_output:${id}`, (event) => {
            term.write(event.payload);
        });

        await listen(`terminal_exit:${id}`, () => {
            term.write('\r\n\x1b[31m[Process exited]\x1b[0m\r\n');
        });

        this.terminals.get(id).unlisten = unlisten;

        // Send input to PTY
        term.onData((data) => {
            invoke('terminal_write', { id, data }).catch(() => {});
        });

        // Resize on window resize
        const resizeObs = new ResizeObserver(() => {
            try { fitAddon.fit(); } catch {}
            invoke('terminal_resize', { id, cols: term.cols, rows: term.rows }).catch(() => {});
        });
        resizeObs.observe(container);
        this.terminals.get(id).resizeObs = resizeObs;

        this.activateTerminal(id);
    }

    activateTerminal(id) {
        this.activeTerminal = id;
        this.terminals.forEach((t, tid) => {
            t.container.style.display = tid === id ? 'block' : 'none';
            t.tabEl.classList.toggle('active', tid === id);
        });
        const t = this.terminals.get(id);
        if (t) {
            try { t.fitAddon.fit(); } catch {}
            t.term.focus();
        }
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

    // ── AI Agent ──────────────────────────────────────────────────────────────
    buildSystemPrompt() {
        let prompt = `You are DeepSeek IDE AI Agent, an expert software engineer assistant embedded in an IDE.
You help users write, edit, debug, and understand code.

Available tools:
- read_file(path): Read a file's content
- write_file(path, content): Write content to a file (shows diff for review in approval mode)
- list_files(path): List files in a directory
- run_terminal(command): Execute a shell command
- get_git_diff(file?): Get git diff

Current workspace: ${this.openFolder || 'No folder opened'}

When modifying files, use write_file. In approval mode, the user will review changes before they are applied.
Be concise and practical. Show code in markdown code blocks.`;

        if (this.contextFiles.length > 0) {
            prompt += '\n\nFiles in context:\n';
            this.contextFiles.forEach(f => {
                prompt += `\n### ${f.path}\n\`\`\`\n${f.content}\n\`\`\`\n`;
            });
        }
        return prompt;
    }

    getToolDefinitions() {
        return [
            {
                name: 'read_file',
                description: 'Read the contents of a file',
                parameters: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'Absolute or relative path to the file' }
                    },
                    required: ['path']
                }
            },
            {
                name: 'write_file',
                description: 'Write content to a file. Will show a diff review in approval mode.',
                parameters: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'Absolute path to the file' },
                        content: { type: 'string', description: 'Full content to write' }
                    },
                    required: ['path', 'content']
                }
            },
            {
                name: 'list_files',
                description: 'List files in a directory',
                parameters: {
                    type: 'object',
                    properties: {
                        path: { type: 'string', description: 'Directory path' }
                    },
                    required: ['path']
                }
            },
            {
                name: 'run_terminal',
                description: 'Execute a shell command and return output',
                parameters: {
                    type: 'object',
                    properties: {
                        command: { type: 'string', description: 'Shell command to run' }
                    },
                    required: ['command']
                }
            },
            {
                name: 'get_git_diff',
                description: 'Get git diff for the workspace or a specific file',
                parameters: {
                    type: 'object',
                    properties: {
                        file: { type: 'string', description: 'Optional: specific file path' }
                    }
                }
            }
        ];
    }

    async executeToolCall(toolCall) {
        const args = JSON.parse(toolCall.arguments || '{}');

        switch (toolCall.name) {
            case 'read_file': {
                const path = this.resolvePath(args.path);
                return await invoke('fs_read_file', { path });
            }
            case 'write_file': {
                const path = this.resolvePath(args.path);
                const content = args.content;

                if (this.agentMode === 'approval') {
                    // Show diff and wait for approval
                    let originalContent = '';
                    try { originalContent = await invoke('fs_read_file', { path }); } catch {}
                    const approved = await this.showDiffApproval(path, originalContent, content);
                    if (!approved) return 'User rejected the changes.';
                }

                await invoke('fs_write_file', { path, content });

                // Reload file in editor if open
                const openTab = this.tabs.find(t => t.path === path);
                if (openTab) {
                    const editor = this.editors.get(path);
                    if (editor && editor.setValue) {
                        editor.setValue(content);
                        const tab = this.tabs.find(t => t.path === path);
                        if (tab) { tab.dirty = false; this.renderTabs(); }
                    }
                }

                // Refresh file tree
                await this.loadFileTree();
                return `File written successfully: ${path}`;
            }
            case 'list_files': {
                const path = this.resolvePath(args.path);
                const entry = await invoke('fs_list_dir', { path });
                const formatTree = (e, depth = 0) => {
                    const prefix = '  '.repeat(depth);
                    if (!e.is_dir) return `${prefix}${e.name}`;
                    const children = (e.children || []).map(c => formatTree(c, depth + 1)).join('\n');
                    return `${prefix}${e.name}/\n${children}`;
                };
                return formatTree(entry);
            }
            case 'run_terminal': {
                if (this.agentMode === 'approval') {
                    const ok = confirm(`Run command?\n\n${args.command}`);
                    if (!ok) return 'User rejected the command.';
                }
                // Run via shell in active terminal
                if (this.activeTerminal) {
                    const id = this.activeTerminal;
                    await invoke('terminal_write', { id, data: args.command + '\n' });
                    return `Command sent to terminal: ${args.command}`;
                }
                return 'No active terminal';
            }
            case 'get_git_diff': {
                if (!this.openFolder) return 'No folder opened';
                return await invoke('git_diff', { cwd: this.openFolder, file: args.file || null });
            }
            default:
                return `Unknown tool: ${toolCall.name}`;
        }
    }

    resolvePath(path) {
        if (!path) return '';
        if (path.startsWith('/') || /^[A-Za-z]:/.test(path)) return path;
        if (this.openFolder) return `${this.openFolder}/${path}`;
        return path;
    }

    async sendAIMessage(userText, imageB64 = null) {
        const sendBtn = document.getElementById('aiSendBtn');
        sendBtn.disabled = true;

        // Build user message
        let userContent;
        if (imageB64) {
            // Use Kimi for image analysis, prepend result
            this.appendAIMsg('user', userText + (imageB64 ? ' [image attached]' : ''));
            try {
                const kimiResult = await invoke('ai_kimi_vision', {
                    imageB64,
                    prompt: userText || 'Describe this image in detail, focusing on code/UI elements.'
                });
                userContent = `[Image analysis by Kimi]: ${kimiResult}\n\nUser: ${userText}`;
            } catch (e) {
                this.toast(`Kimi error: ${e}`, 'error');
                userContent = userText;
            }
        } else {
            this.appendAIMsg('user', userText);
            userContent = userText;
        }

        this.agentMessages.push({ role: 'user', content: userContent });

        // Thinking indicator
        const thinkingEl = this.appendAIMsg('assistant', null, true);

        const requestId = `req_${Date.now()}`;
        this.aiRequestId = requestId;

        // Set up streaming response handler
        let assistantText = '';
        let currentMsgEl = null;
        let pendingToolCall = null;

        const cleanupListeners = () => {
            this.aiListeners.forEach(u => { try { u(); } catch {} });
            this.aiListeners = [];
        };

        const deltaUnlisten = await listen(`ai_delta:${requestId}`, (event) => {
            const delta = event.payload.content;
            if (!currentMsgEl) {
                thinkingEl.remove();
                currentMsgEl = this.appendAIMsg('assistant', '');
            }
            assistantText += delta;
            currentMsgEl.querySelector('.ai-msg-body').innerHTML = this.renderMarkdown(assistantText);
            currentMsgEl.querySelector('.ai-msg-body').scrollIntoView({ block: 'end' });
        });
        this.aiListeners.push(deltaUnlisten);

        const toolUnlisten = await listen(`ai_tool_call:${requestId}`, async (event) => {
            const tc = event.payload;
            pendingToolCall = tc;
        });
        this.aiListeners.push(toolUnlisten);

        const doneUnlisten = await listen(`ai_done:${requestId}`, async () => {
            cleanupListeners();

            if (currentMsgEl) {
                this.agentMessages.push({ role: 'assistant', content: assistantText });
            }

            // Handle tool calls
            if (pendingToolCall) {
                const tc = pendingToolCall;
                pendingToolCall = null;

                if (!currentMsgEl) thinkingEl.remove();

                // Show tool call card
                const toolCardEl = this.appendToolCard(tc);

                try {
                    const result = await this.executeToolCall(tc);

                    toolCardEl.querySelector('.ai-tool-status').textContent = 'done';
                    toolCardEl.querySelector('.ai-tool-status').className = 'ai-tool-status approved';

                    // Add tool result to conversation
                    this.agentMessages.push({ role: 'assistant', content: null, tool_calls: [{ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.arguments } }] });
                    this.agentMessages.push({ role: 'tool', content: String(result), tool_call_id: tc.id });

                    // Continue the conversation
                    await this.continueAIConversation();
                } catch (e) {
                    toolCardEl.querySelector('.ai-tool-status').textContent = 'error';
                    toolCardEl.querySelector('.ai-tool-status').className = 'ai-tool-status rejected';
                    this.appendAIMsg('assistant', `Tool error: ${e}`);
                }
            }

            sendBtn.disabled = false;
        });
        this.aiListeners.push(doneUnlisten);

        // Build messages with system prompt
        const messages = [
            { role: 'system', content: this.buildSystemPrompt() },
            ...this.agentMessages
        ];

        try {
            await invoke('ai_chat_deepseek', {
                requestId,
                messages,
                tools: this.getToolDefinitions()
            });
        } catch (e) {
            cleanupListeners();
            thinkingEl.remove();
            this.appendAIMsg('assistant', `Error: ${e}`);
            sendBtn.disabled = false;
        }
    }

    async continueAIConversation() {
        const requestId = `req_${Date.now()}`;
        this.aiRequestId = requestId;

        let assistantText = '';
        let currentMsgEl = null;
        let pendingToolCall = null;

        const cleanupListeners = () => {
            this.aiListeners.forEach(u => { try { u(); } catch {} });
            this.aiListeners = [];
        };

        const deltaUnlisten = await listen(`ai_delta:${requestId}`, (event) => {
            if (!currentMsgEl) currentMsgEl = this.appendAIMsg('assistant', '');
            assistantText += event.payload.content;
            currentMsgEl.querySelector('.ai-msg-body').innerHTML = this.renderMarkdown(assistantText);
        });
        this.aiListeners.push(deltaUnlisten);

        const toolUnlisten = await listen(`ai_tool_call:${requestId}`, (event) => {
            pendingToolCall = event.payload;
        });
        this.aiListeners.push(toolUnlisten);

        const doneUnlisten = await listen(`ai_done:${requestId}`, async () => {
            cleanupListeners();
            if (currentMsgEl) {
                this.agentMessages.push({ role: 'assistant', content: assistantText });
            }
            if (pendingToolCall) {
                const tc = pendingToolCall;
                pendingToolCall = null;
                const toolCardEl = this.appendToolCard(tc);
                try {
                    const result = await this.executeToolCall(tc);
                    toolCardEl.querySelector('.ai-tool-status').textContent = 'done';
                    toolCardEl.querySelector('.ai-tool-status').className = 'ai-tool-status approved';
                    this.agentMessages.push({ role: 'assistant', content: null, tool_calls: [{ id: tc.id, type: 'function', function: { name: tc.name, arguments: tc.arguments } }] });
                    this.agentMessages.push({ role: 'tool', content: String(result), tool_call_id: tc.id });
                    await this.continueAIConversation();
                } catch (e) {
                    toolCardEl.querySelector('.ai-tool-status').textContent = 'error';
                    toolCardEl.querySelector('.ai-tool-status').className = 'ai-tool-status rejected';
                    this.appendAIMsg('assistant', `Tool error: ${e}`);
                }
            }
            document.getElementById('aiSendBtn').disabled = false;
        });
        this.aiListeners.push(doneUnlisten);

        const messages = [
            { role: 'system', content: this.buildSystemPrompt() },
            ...this.agentMessages
        ];

        try {
            await invoke('ai_chat_deepseek', { requestId, messages, tools: this.getToolDefinitions() });
        } catch (e) {
            cleanupListeners();
            this.appendAIMsg('assistant', `Error: ${e}`);
            document.getElementById('aiSendBtn').disabled = false;
        }
    }

    appendAIMsg(role, content, isThinking = false) {
        const msgs = document.getElementById('aiMsgs');
        const el = document.createElement('div');
        el.className = `ai-msg ai-msg-${role}`;
        if (isThinking) {
            el.innerHTML = `<div class="ai-thinking"><span class="ai-thinking-dots"></span> Thinking...</div>`;
        } else {
            const html = content ? this.renderMarkdown(content) : '';
            el.innerHTML = `<div class="ai-msg-body">${html}</div>`;
        }
        msgs.appendChild(el);
        el.scrollIntoView({ block: 'end' });
        return el;
    }

    appendToolCard(tc) {
        const msgs = document.getElementById('aiMsgs');
        const el = document.createElement('div');
        el.className = 'ai-tool-card';
        let argsDisplay = '';
        try {
            const parsed = JSON.parse(tc.arguments || '{}');
            argsDisplay = JSON.stringify(parsed, null, 2);
            // Truncate long content for display
            if (argsDisplay.length > 500) {
                argsDisplay = argsDisplay.substring(0, 500) + '\n... (truncated)';
            }
        } catch { argsDisplay = tc.arguments; }

        el.innerHTML = `
            <div class="ai-tool-header">
                <span class="ai-tool-name">${tc.name}</span>
                <span class="ai-tool-status running">running</span>
            </div>
            <div class="ai-tool-body">${this.escapeHtml(argsDisplay)}</div>
        `;
        msgs.appendChild(el);
        el.scrollIntoView({ block: 'end' });
        return el;
    }

    // ── Diff approval UI ──────────────────────────────────────────────────────
    showDiffApproval(path, originalContent, newContent) {
        return new Promise((resolve) => {
            this.pendingDiff = { path, originalContent, newContent, resolve };
            document.getElementById('diffFile').textContent = path;
            document.getElementById('diffPanel').classList.add('active');

            if (this.monaco) {
                const wrap = document.getElementById('diffEditorWrap');
                wrap.innerHTML = '';

                if (this.diffEditor) {
                    this.diffEditor.dispose();
                    this.diffEditor = null;
                }

                const originalModel = this.monaco.editor.createModel(originalContent, langFromPath(path));
                const modifiedModel = this.monaco.editor.createModel(newContent, langFromPath(path));

                this.diffEditor = this.monaco.editor.createDiffEditor(wrap, {
                    theme: this.config.theme === 'vs-dark' ? 'ds-dark' : (this.config.theme || 'vs-dark'),
                    fontSize: this.config.font_size || 14,
                    readOnly: false,
                    automaticLayout: true,
                    renderSideBySide: true,
                });
                this.diffEditor.setModel({ original: originalModel, modified: modifiedModel });
            }
        });
    }

    diffApply() {
        if (!this.pendingDiff) return;

        // Get potentially edited content from diff editor
        let newContent = this.pendingDiff.newContent;
        if (this.diffEditor) {
            const modifiedModel = this.diffEditor.getModifiedEditor().getModel();
            if (modifiedModel) newContent = modifiedModel.getValue();
        }

        const resolve = this.pendingDiff.resolve;
        this.pendingDiff = { ...this.pendingDiff, newContent };

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

    // ── Markdown renderer (simple) ─────────────────────────────────────────
    renderMarkdown(text) {
        if (!text) return '';
        let html = this.escapeHtml(text);
        // Code blocks
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
            `<pre><code class="lang-${lang}">${code}</code></pre>`
        );
        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        // Bold
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        // Italic
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        // Newlines
        html = html.replace(/\n/g, '<br>');
        return html;
    }

    escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ── Settings ──────────────────────────────────────────────────────────────
    loadSettingsUI() {
        document.getElementById('settingsDeepseekKey').value = this.config.deepseek_api_key || '';
        document.getElementById('settingsKimiKey').value = this.config.kimi_api_key || '';
        document.getElementById('settingsProxy').value = this.config.proxy || '';
        document.getElementById('settingsModel').value = this.config.deepseek_model || 'deepseek-chat';
        document.getElementById('settingsTheme').value = this.config.theme || 'vs-dark';
        document.getElementById('settingsFontSize').value = String(this.config.font_size || 14);
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
        };
        try {
            await invoke('config_save', { config: newConfig });
            this.config = newConfig;
            this.applyTheme();
            document.getElementById('statusModel').textContent = newConfig.deepseek_model;
            this.toast('Settings saved', 'success');
        } catch (e) {
            this.toast(`Failed to save settings: ${e}`, 'error');
        }
    }

    // ── Context menu ──────────────────────────────────────────────────────────
    showContextMenu(event, node) {
        const menu = document.getElementById('ctxMenu');
        menu.innerHTML = '';
        menu.classList.remove('hidden');
        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY}px`;

        const addItem = (label, action) => {
            const item = document.createElement('div');
            item.className = 'ctx-item';
            item.textContent = label;
            item.addEventListener('click', () => { menu.classList.add('hidden'); action(); });
            menu.appendChild(item);
        };

        if (!node.is_dir) {
            addItem('Open File', () => this.openFile(node.path, node.name));
            addItem('Add to AI Context', () => this.addFileToContext(node.path, node.name));
            menu.appendChild(Object.assign(document.createElement('div'), { className: 'ctx-separator' }));
        } else {
            addItem('New File', () => this.newFileInDir(node.path));
            addItem('New Folder', () => this.newFolderInDir(node.path));
            menu.appendChild(Object.assign(document.createElement('div'), { className: 'ctx-separator' }));
            addItem('Open in Terminal', async () => {
                await this.createTerminal(node.path);
                this.switchPanel('terminal');
            });
            menu.appendChild(Object.assign(document.createElement('div'), { className: 'ctx-separator' }));
        }
        addItem('Delete', async () => {
            if (!confirm(`Delete ${node.name}?`)) return;
            await invoke('fs_delete_path', { path: node.path });
            await this.loadFileTree();
            this.toast(`Deleted: ${node.name}`, 'success');
        });
    }

    async addFileToContext(path, name) {
        try {
            const content = await invoke('fs_read_file', { path });
            if (!this.contextFiles.find(f => f.path === path)) {
                this.contextFiles.push({ path, name, content });
                this.renderContextBar();
                this.toast(`Added to AI context: ${name}`);
            }
        } catch (e) {
            this.toast(`Cannot read file: ${e}`, 'error');
        }
    }

    renderContextBar() {
        const bar = document.getElementById('aiContextBar');
        bar.innerHTML = '';
        this.contextFiles.forEach(f => {
            const chip = document.createElement('div');
            chip.className = 'ai-context-chip';
            chip.innerHTML = `${f.name} <span class="ai-context-chip-remove" data-path="${f.path}">✕</span>`;
            chip.querySelector('.ai-context-chip-remove').addEventListener('click', (e) => {
                this.contextFiles = this.contextFiles.filter(c => c.path !== f.path);
                this.renderContextBar();
            });
            bar.appendChild(chip);
        });
        const addBtn = document.createElement('button');
        addBtn.className = 'ai-context-add';
        addBtn.textContent = '+ Add file';
        addBtn.addEventListener('click', () => {
            if (this.activeTab) {
                const tab = this.tabs.find(t => t.path === this.activeTab);
                if (tab) this.addFileToContext(tab.path, tab.name);
            }
        });
        bar.appendChild(addBtn);
    }

    async newFileInDir(dirPath) {
        const name = prompt('New file name:');
        if (!name) return;
        const path = `${dirPath}/${name}`;
        await invoke('fs_write_file', { path, content: '' });
        await this.loadFileTree();
        this.openFile(path, name);
    }

    async newFolderInDir(dirPath) {
        const name = prompt('New folder name:');
        if (!name) return;
        await invoke('fs_create_dir', { path: `${dirPath}/${name}` });
        await this.loadFileTree();
    }

    // ── Panel/View switching ──────────────────────────────────────────────────
    switchView(view) {
        document.querySelectorAll('.activity-icon').forEach(el => {
            el.classList.toggle('active', el.dataset.view === view);
        });
        document.querySelectorAll('.sidebar-view').forEach(el => {
            el.classList.toggle('hidden', el.id !== `view-${view}`);
        });
        const titles = {
            explorer: 'Explorer', search: 'Search', scm: 'Source Control',
            ai: 'AI Agent', settings: 'Settings'
        };
        document.getElementById('sidebarHeader').textContent = titles[view] || view;

        if (view === 'settings') this.loadSettingsUI();
        if (view === 'scm') this.refreshGit();
    }

    switchPanel(panel) {
        document.querySelectorAll('.panel-tab').forEach(el => {
            el.classList.toggle('active', el.dataset.panel === panel);
        });
        document.querySelectorAll('.panel-view').forEach(el => {
            el.classList.toggle('active', el.id === `panel-${panel}`);
        });
        if (panel === 'terminal' && this.activeTerminal) {
            const t = this.terminals.get(this.activeTerminal);
            if (t) { try { t.fitAddon.fit(); t.term.focus(); } catch {} }
        }
    }

    // ── Command palette ───────────────────────────────────────────────────────
    openCommandPalette() {
        const overlay = document.getElementById('cmdOverlay');
        overlay.classList.add('active');
        document.getElementById('cmdInput').value = '';
        document.getElementById('cmdInput').focus();
        this.renderCmdList('');
    }

    renderCmdList(query) {
        const commands = [
            { label: 'File: Open Folder', action: () => this.openFolder() },
            { label: 'File: New File', action: () => { if (this.openFolder) this.newFileInDir(this.openFolder); } },
            { label: 'File: Save', action: () => { if (this.activeTab) this.saveFile(this.activeTab); } },
            { label: 'View: Explorer', action: () => this.switchView('explorer') },
            { label: 'View: Search', action: () => this.switchView('search') },
            { label: 'View: Source Control', action: () => this.switchView('scm') },
            { label: 'View: AI Agent', action: () => this.switchView('ai') },
            { label: 'View: Settings', action: () => this.switchView('settings') },
            { label: 'Terminal: New Terminal', action: () => { this.createTerminal(this.openFolder || '.'); this.switchPanel('terminal'); } },
            { label: 'Git: Refresh Status', action: () => this.refreshGit() },
        ];

        const filtered = query
            ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
            : commands;

        const list = document.getElementById('cmdList');
        list.innerHTML = '';
        this.cmdItems = filtered;
        this.cmdSelectedIdx = 0;

        filtered.forEach((cmd, idx) => {
            const el = document.createElement('div');
            el.className = 'cmd-item' + (idx === 0 ? ' selected' : '');
            el.textContent = cmd.label;
            el.addEventListener('click', () => {
                document.getElementById('cmdOverlay').classList.remove('active');
                cmd.action();
            });
            list.appendChild(el);
        });
    }

    // ── Toast notifications ───────────────────────────────────────────────────
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

    // ── UI initialization ─────────────────────────────────────────────────────
    initUI() {
        // Activity bar clicks
        document.querySelectorAll('.activity-icon[data-view]').forEach(el => {
            el.addEventListener('click', () => this.switchView(el.dataset.view));
        });

        // Panel tab clicks
        document.querySelectorAll('.panel-tab[data-panel]').forEach(el => {
            el.addEventListener('click', () => this.switchPanel(el.dataset.panel));
        });

        // New terminal button
        document.getElementById('newTerminalBtn').addEventListener('click', async () => {
            await this.createTerminal(this.openFolder || await invoke('fs_get_cwd'));
        });

        // AI send button and input
        document.getElementById('aiSendBtn').addEventListener('click', () => this.handleAISend());
        document.getElementById('aiInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleAISend();
            }
        });
        document.getElementById('aiInput').addEventListener('paste', (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of items) {
                if (item.type.startsWith('image/')) {
                    e.preventDefault();
                    const blob = item.getAsFile();
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                        const b64 = ev.target.result.split(',')[1];
                        this.attachedImage = b64;
                        document.getElementById('aiImageThumb').src = ev.target.result;
                        document.getElementById('aiImagePreview').style.display = 'flex';
                    };
                    reader.readAsDataURL(blob);
                    break;
                }
            }
        });

        // Auto-resize AI input
        document.getElementById('aiInput').addEventListener('input', (e) => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
        });

        document.getElementById('aiImageRemove').addEventListener('click', () => {
            this.attachedImage = null;
            document.getElementById('aiImagePreview').style.display = 'none';
        });

        // AI mode button
        document.getElementById('aiModeBtn').addEventListener('click', () => {
            this.agentMode = this.agentMode === 'approval' ? 'autonomous' : 'approval';
            const btn = document.getElementById('aiModeBtn');
            btn.textContent = this.agentMode === 'approval' ? 'Approval' : 'Autonomous';
            btn.className = `ai-mode-btn ${this.agentMode}`;
            this.toast(`Mode: ${this.agentMode}`);
        });

        // Add file to context button
        document.getElementById('aiAddContext').addEventListener('click', () => {
            if (this.activeTab) {
                const tab = this.tabs.find(t => t.path === this.activeTab);
                if (tab) this.addFileToContext(tab.path, tab.name);
            } else {
                this.toast('Open a file first', 'warning');
            }
        });

        // Settings save button
        document.getElementById('settingsSaveBtn').addEventListener('click', () => this.saveSettings());

        // Commit button
        document.getElementById('commitBtn').addEventListener('click', async () => {
            const msg = document.getElementById('commitMessage').value.trim();
            if (!msg) { this.toast('Enter a commit message', 'warning'); return; }
            if (!this.openFolder) { this.toast('No folder opened', 'error'); return; }
            try {
                await invoke('git_commit', { cwd: this.openFolder, message: msg });
                document.getElementById('commitMessage').value = '';
                await this.refreshGit();
                this.toast('Committed!', 'success');
            } catch (e) {
                this.toast(`Commit failed: ${e}`, 'error');
            }
        });
        document.getElementById('commitMessage').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) document.getElementById('commitBtn').click();
        });

        // Stage all / unstage all
        document.getElementById('stageAllBtn').addEventListener('click', async () => {
            if (!this.openFolder) return;
            await invoke('git_add', { cwd: this.openFolder, path: '.' });
            await this.refreshGit();
        });
        document.getElementById('unstageAllBtn').addEventListener('click', async () => {
            if (!this.openFolder) return;
            await invoke('git_unstage', { cwd: this.openFolder, path: '.' });
            await this.refreshGit();
        });

        // Diff panel buttons
        document.getElementById('diffApplyBtn').addEventListener('click', () => this.diffApply());
        document.getElementById('diffRejectBtn').addEventListener('click', () => this.diffReject());

        // Sidebar resizer
        this.initSidebarResizer();

        // Panel resizer
        this.initPanelResizer();

        // Command palette
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                this.openCommandPalette();
            }
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
                e.preventDefault(); this.switchView('explorer');
            }
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'F') {
                e.preventDefault(); this.switchView('search');
            }
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'G') {
                e.preventDefault(); this.switchView('scm');
            }
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
                e.preventDefault(); this.switchView('ai');
            }
            if ((e.ctrlKey || e.metaKey) && e.key === ',') {
                e.preventDefault(); this.switchView('settings');
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 's' && this.activeTab) {
                e.preventDefault(); this.saveFile(this.activeTab);
            }
            if (e.key === 'Escape') {
                document.getElementById('cmdOverlay').classList.remove('active');
                document.getElementById('ctxMenu').classList.add('hidden');
            }
        });

        // Command palette input
        document.getElementById('cmdInput').addEventListener('input', (e) => {
            this.renderCmdList(e.target.value);
        });
        document.getElementById('cmdInput').addEventListener('keydown', (e) => {
            const items = document.querySelectorAll('#cmdList .cmd-item');
            if (e.key === 'ArrowDown') {
                this.cmdSelectedIdx = Math.min(this.cmdSelectedIdx + 1, items.length - 1);
            } else if (e.key === 'ArrowUp') {
                this.cmdSelectedIdx = Math.max(this.cmdSelectedIdx - 1, 0);
            } else if (e.key === 'Enter') {
                if (this.cmdItems[this.cmdSelectedIdx]) {
                    document.getElementById('cmdOverlay').classList.remove('active');
                    this.cmdItems[this.cmdSelectedIdx].action();
                }
                return;
            } else if (e.key === 'Escape') {
                document.getElementById('cmdOverlay').classList.remove('active');
                return;
            }
            items.forEach((el, i) => el.classList.toggle('selected', i === this.cmdSelectedIdx));
        });

        // Close overlays on outside click
        document.getElementById('cmdOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('cmdOverlay')) {
                document.getElementById('cmdOverlay').classList.remove('active');
            }
        });
        document.addEventListener('click', () => {
            document.getElementById('ctxMenu').classList.add('hidden');
        });

        // Menu bar
        this.initMenuBar();

        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchFiles(e.target.value);
        });
    }

    handleAISend() {
        const input = document.getElementById('aiInput');
        const text = input.value.trim();
        if (!text && !this.attachedImage) return;
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

        resizer.addEventListener('mousedown', (e) => {
            startX = e.clientX;
            startW = sidebar.offsetWidth;
            resizer.classList.add('dragging');
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        const onMove = (e) => {
            const w = Math.max(150, Math.min(600, startW + e.clientX - startX));
            sidebar.style.width = w + 'px';
        };
        const onUp = () => {
            resizer.classList.remove('dragging');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            // Relayout Monaco editors
            this.editors.forEach(ed => { if (ed.layout) ed.layout(); });
        };
    }

    initPanelResizer() {
        const panel = document.getElementById('panel');
        let startY, startH, dragging = false;

        panel.querySelector('.panel-tabs').addEventListener('mousedown', (e) => {
            startY = e.clientY;
            startH = panel.offsetHeight;
            dragging = true;
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        const onMove = (e) => {
            if (!dragging) return;
            const h = Math.max(80, Math.min(window.innerHeight - 200, startH - (e.clientY - startY)));
            panel.style.height = h + 'px';
        };
        const onUp = () => {
            dragging = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
    }

    initMenuBar() {
        const menus = {
            file: [
                { label: 'Open Folder...', shortcut: 'Ctrl+Shift+O', action: () => this.openFolder() },
                { label: 'New File', action: () => { if (this.openFolder) this.newFileInDir(this.openFolder); else this.toast('Open a folder first', 'warning'); } },
                { separator: true },
                { label: 'Save', shortcut: 'Ctrl+S', action: () => { if (this.activeTab) this.saveFile(this.activeTab); } },
            ],
            edit: [
                { label: 'Find', shortcut: 'Ctrl+F', action: () => { const ed = this.editors.get(this.activeTab); if (ed && ed.trigger) ed.trigger('', 'actions.find'); } },
                { label: 'Replace', shortcut: 'Ctrl+H', action: () => { const ed = this.editors.get(this.activeTab); if (ed && ed.trigger) ed.trigger('', 'editor.action.startFindReplaceAction'); } },
            ],
            view: [
                { label: 'Explorer', shortcut: 'Ctrl+Shift+E', action: () => this.switchView('explorer') },
                { label: 'Search', shortcut: 'Ctrl+Shift+F', action: () => this.switchView('search') },
                { label: 'Source Control', shortcut: 'Ctrl+Shift+G', action: () => this.switchView('scm') },
                { label: 'AI Agent', shortcut: 'Ctrl+Shift+A', action: () => this.switchView('ai') },
                { separator: true },
                { label: 'Command Palette', shortcut: 'Ctrl+P', action: () => this.openCommandPalette() },
            ],
            terminal: [
                { label: 'New Terminal', action: async () => { await this.createTerminal(this.openFolder || await invoke('fs_get_cwd')); this.switchPanel('terminal'); } },
            ],
            help: [
                { label: 'About DeepSeek IDE', action: () => this.toast('DeepSeek IDE v0.1.0 — Powered by DeepSeek API + Kimi Vision') },
            ]
        };

        document.querySelectorAll('.menu-item[data-menu]').forEach(item => {
            const menuName = item.dataset.menu;
            const menuDef = menus[menuName] || [];

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close others
                document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('open'));
                document.querySelectorAll('.menu-dropdown').forEach(d => d.classList.remove('active'));

                const existing = item.querySelector('.menu-dropdown');
                if (existing) { item.classList.add('open'); existing.classList.add('active'); return; }

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
                            document.querySelectorAll('.menu-dropdown').forEach(d => d.classList.remove('active'));
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
            document.querySelectorAll('.menu-dropdown').forEach(d => d.classList.remove('active'));
        });
    }

    // ── Search across files ───────────────────────────────────────────────────
    async searchFiles(query) {
        const results = document.getElementById('searchResults');
        if (!query || !this.openFolder) { results.innerHTML = ''; return; }

        results.innerHTML = '<div style="padding:8px;color:var(--fg-dim);font-size:12px">Searching...</div>';

        // Search opened files first for instant results
        const matches = [];
        for (const [path, editor] of this.editors) {
            const content = editor.getValue ? editor.getValue() : '';
            const lines = content.split('\n');
            const fileMatches = [];
            lines.forEach((line, i) => {
                if (line.toLowerCase().includes(query.toLowerCase())) {
                    fileMatches.push({ line: i + 1, content: line.trim() });
                }
            });
            if (fileMatches.length > 0) {
                matches.push({ path, lines: fileMatches });
            }
        }

        results.innerHTML = '';
        if (matches.length === 0) {
            results.innerHTML = '<div style="padding:8px;color:var(--fg-dim);font-size:12px">No results in open files.</div>';
            return;
        }

        matches.forEach(m => {
            const fileEl = document.createElement('div');
            fileEl.className = 'search-result-file';
            fileEl.textContent = m.path.split('/').pop();
            fileEl.title = m.path;
            results.appendChild(fileEl);

            m.lines.slice(0, 10).forEach(l => {
                const lineEl = document.createElement('div');
                lineEl.className = 'search-result-line';
                const highlighted = l.content.replace(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '<mark>$&</mark>');
                lineEl.innerHTML = `<span class="search-line-num">${l.line}</span><span class="search-line-content">${highlighted}</span>`;
                lineEl.addEventListener('click', () => {
                    this.openFile(m.path, m.path.split('/').pop());
                    setTimeout(() => {
                        const editor = this.editors.get(m.path);
                        if (editor && editor.revealLineInCenter) {
                            editor.revealLineInCenter(l.line);
                        }
                    }, 200);
                });
                results.appendChild(lineEl);
            });
        });
    }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
window.IDE = new IDEApp();
