use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

pub struct PtyHandle {
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
}

pub type PtyStore = Mutex<HashMap<String, PtyHandle>>;

fn default_shell() -> String {
    if cfg!(windows) {
        std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
    }
}

#[tauri::command]
pub fn terminal_create(
    app: AppHandle,
    cwd: String,
    shell: Option<String>,
    state: tauri::State<'_, PtyStore>,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    let id_clone = id.clone();

    let pty_system = NativePtySystem::default();
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    let shell = shell.unwrap_or_else(default_shell);
    let mut cmd = CommandBuilder::new(&shell);
    cmd.cwd(&cwd);

    // Spawn the shell process
    let _child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    // Get the reader/writer
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to get PTY writer: {}", e))?;
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to get PTY reader: {}", e))?;

    let writer = Arc::new(Mutex::new(writer));

    // Background thread: read PTY output and emit events
    let app_clone = app.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_clone.emit(&format!("terminal_output:{}", id_clone), &data);
                }
                Err(_) => break,
            }
        }
        let _ = app_clone.emit(&format!("terminal_exit:{}", id_clone), ());
    });

    state
        .lock()
        .unwrap()
        .insert(id.clone(), PtyHandle { writer });

    Ok(id)
}

#[tauri::command]
pub fn terminal_write(
    id: String,
    data: String,
    state: tauri::State<'_, PtyStore>,
) -> Result<(), String> {
    let store = state.lock().unwrap();
    if let Some(handle) = store.get(&id) {
        let mut writer = handle.writer.lock().unwrap();
        writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err(format!("Terminal {} not found", id))
    }
}

#[tauri::command]
pub fn terminal_resize(
    id: String,
    cols: u16,
    rows: u16,
    state: tauri::State<'_, PtyStore>,
) -> Result<(), String> {
    // portable-pty resize is done on the master, but we stored only the writer
    // For now, this is a no-op — resize support can be added with full PtyMaster storage
    let _ = (id, cols, rows, state);
    Ok(())
}

#[tauri::command]
pub fn terminal_close(id: String, state: tauri::State<'_, PtyStore>) -> Result<(), String> {
    state.lock().unwrap().remove(&id);
    Ok(())
}

/// 捕获命令输出给 AI 使用（不显示在可视终端中）
#[tauri::command]
pub fn terminal_run_capture(cwd: String, command: String) -> Result<String, String> {
    use std::process::Command;
    let output = if cfg!(windows) {
        Command::new("cmd")
            .current_dir(&cwd)
            .args(["/C", &command])
            .output()
    } else {
        Command::new("sh")
            .current_dir(&cwd)
            .args(["-c", &command])
            .output()
    }
    .map_err(|e| format!("执行命令失败: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    let mut result = String::new();
    if !stdout.is_empty() { result.push_str(&stdout); }
    if !stderr.is_empty() {
        if !result.is_empty() { result.push('\n'); }
        result.push_str("[stderr]: ");
        result.push_str(&stderr);
    }
    if result.is_empty() {
        result = format!("（命令退出码: {}）", output.status.code().unwrap_or(-1));
    }
    Ok(result)
}
