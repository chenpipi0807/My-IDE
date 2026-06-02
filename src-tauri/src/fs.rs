use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileEntry>>,
}

const IGNORE_DIRS: &[&str] = &["node_modules", "target", ".git", ".svn", "dist", "build", "__pycache__", ".cache"];

fn should_ignore(name: &str) -> bool {
    IGNORE_DIRS.contains(&name) || name.starts_with('.')
}

fn build_tree(path: &Path, depth: u32) -> FileEntry {
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();
    let is_dir = path.is_dir();

    let children = if is_dir {
        if depth < 2 {
            let mut entries: Vec<FileEntry> = std::fs::read_dir(path)
                .map(|rd| {
                    rd.filter_map(|e| e.ok())
                        .filter(|e| !should_ignore(&e.file_name().to_string_lossy()))
                        .map(|e| build_tree(&e.path(), depth + 1))
                        .collect()
                })
                .unwrap_or_default();
            entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));
            Some(entries)
        } else {
            Some(vec![])
        }
    } else {
        None
    };

    FileEntry {
        name,
        path: path.to_string_lossy().replace('\\', "/").to_string(),
        is_dir,
        children,
    }
}

#[tauri::command]
pub fn fs_list_dir(path: String) -> Result<FileEntry, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    Ok(build_tree(&p, 0))
}

#[tauri::command]
pub fn fs_expand_dir(path: String) -> Result<Vec<FileEntry>, String> {
    let p = PathBuf::from(&path);
    let mut entries: Vec<FileEntry> = std::fs::read_dir(&p)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| !should_ignore(&e.file_name().to_string_lossy()))
        .map(|e| {
            let ep = e.path();
            let is_dir = ep.is_dir();
            FileEntry {
                name: e.file_name().to_string_lossy().to_string(),
                path: ep.to_string_lossy().replace('\\', "/").to_string(),
                is_dir,
                children: if is_dir { Some(vec![]) } else { None },
            }
        })
        .collect();
    entries.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));
    Ok(entries)
}

#[tauri::command]
pub fn fs_read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Cannot read {}: {}", path, e))
}

#[tauri::command]
pub fn fs_write_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, &content).map_err(|e| format!("Cannot write {}: {}", path, e))
}

#[tauri::command]
pub fn fs_delete_path(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        std::fs::remove_dir_all(&path).map_err(|e| e.to_string())
    } else {
        std::fs::remove_file(&path).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn fs_create_dir(path: String) -> Result<(), String> {
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_rename(old_path: String, new_path: String) -> Result<(), String> {
    std::fs::rename(&old_path, &new_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn fs_get_cwd() -> String {
    std::env::current_dir()
        .map(|p| p.to_string_lossy().replace('\\', "/").to_string())
        .unwrap_or_else(|_| "/".to_string())
}

#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub file: String,
    pub line: u32,
    pub content: String,
}

/// 全局文件内容搜索，供搜索面板使用
#[tauri::command]
pub fn fs_search(
    cwd: String,
    query: String,
    case_sensitive: bool,
) -> Result<Vec<SearchResult>, String> {
    if query.is_empty() {
        return Ok(vec![]);
    }
    let query_cmp = if case_sensitive {
        query.clone()
    } else {
        query.to_lowercase()
    };

    let mut results: Vec<SearchResult> = Vec::new();
    let limit = 500usize;

    for entry in WalkDir::new(&cwd)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy();
            !should_ignore(&name) && e.file_type().is_file()
        })
    {
        if results.len() >= limit {
            break;
        }
        // 跳过二进制文件（通过扩展名粗判）
        let ext = entry.path().extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();
        if matches!(ext.as_str(), "exe"|"dll"|"so"|"dylib"|"bin"|"png"|"jpg"|"jpeg"|"gif"|
                    "webp"|"ico"|"pdf"|"zip"|"tar"|"gz"|"7z"|"rar"|"mp4"|"mp3"|"woff"|"woff2"|"ttf") {
            continue;
        }

        let content = match std::fs::read_to_string(entry.path()) {
            Ok(c) => c,
            Err(_) => continue,
        };

        let file_path = entry.path().to_string_lossy().replace('\\', "/").to_string();

        for (idx, line) in content.lines().enumerate() {
            let line_cmp = if case_sensitive { line.to_string() } else { line.to_lowercase() };
            if line_cmp.contains(&query_cmp) {
                results.push(SearchResult {
                    file: file_path.clone(),
                    line: (idx + 1) as u32,
                    content: line.trim().to_string(),
                });
                if results.len() >= limit {
                    break;
                }
            }
        }
    }

    Ok(results)
}

/// 获取目录下所有文件路径列表，供 Ctrl+P 快速打开使用
#[tauri::command]
pub fn fs_find_files(cwd: String) -> Vec<String> {
    WalkDir::new(&cwd)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy();
            !should_ignore(&name) && e.file_type().is_file()
        })
        .take(2000)
        .map(|e| e.path().to_string_lossy().replace('\\', "/").to_string())
        .collect()
}

/// 读取文件为 base64 字符串，用于图片/视频/音频预览
#[tauri::command]
pub fn fs_read_file_base64(path: String) -> Result<String, String> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    Ok(STANDARD.encode(bytes))
}
