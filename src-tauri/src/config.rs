use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub deepseek_api_key: String,
    pub kimi_api_key: String,
    pub proxy: String,
    pub theme: String,
    pub font_size: u32,
    pub agent_mode: String,
    pub deepseek_model: String,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            deepseek_api_key: String::new(),
            kimi_api_key: String::new(),
            proxy: String::new(),
            theme: "vs-dark".to_string(),
            font_size: 14,
            agent_mode: "approval".to_string(),
            deepseek_model: "deepseek-chat".to_string(),
        }
    }
}

pub fn config_path() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("deepseek-ide")
        .join("config.json")
}

#[tauri::command]
pub fn config_load() -> Config {
    let path = config_path();
    if path.exists() {
        let content = std::fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        Config::default()
    }
}

#[tauri::command]
pub fn config_save(config: Config) -> Result<(), String> {
    let path = config_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(&path, content).map_err(|e| e.to_string())
}
