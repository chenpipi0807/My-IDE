use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

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
