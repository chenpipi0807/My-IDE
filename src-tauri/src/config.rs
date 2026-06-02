use std::path::PathBuf;

pub fn config_path() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("my-ide")
        .join("config.json")
}

/// Config 使用自由 JSON，前端任何字段都可透传保存
#[tauri::command]
pub fn config_load() -> serde_json::Value {
    let path = config_path();
    if path.exists() {
        let content = std::fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or(default_config())
    } else {
        default_config()
    }
}

#[tauri::command]
pub fn config_save(config: serde_json::Value) -> Result<(), String> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

fn default_config() -> serde_json::Value {
    serde_json::json!({
        "deepseek_api_key": "",
        "kimi_api_key": "",
        "proxy": "",
        "theme": "vs-dark",
        "font_size": 14,
        "font_family": "Cascadia Code,Fira Code,Consolas,monospace",
        "tab_size": 4,
        "auto_save": false,
        "word_wrap": false,
        "agent_mode": "approval",
        "deepseek_model": "deepseek-chat",
        "system_prompt": ""
    })
}
