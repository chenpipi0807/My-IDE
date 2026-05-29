use reqwest::Client;
use serde_json::{json, Value};

use crate::config::config_load;

fn build_client(proxy: &str) -> Result<Client, String> {
    let mut builder = Client::builder();
    if !proxy.is_empty() {
        let p = reqwest::Proxy::all(proxy).map_err(|e| e.to_string())?;
        builder = builder.proxy(p);
    }
    builder.build().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ai_kimi_vision(image_b64: String, prompt: String) -> Result<String, String> {
    let config = config_load();

    if config.kimi_api_key.is_empty() {
        return Err("Kimi API key not configured. Please set it in Settings.".to_string());
    }

    let client = build_client(&config.proxy)?;

    let body = json!({
        "model": "moonshot-v1-8k",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": format!("data:image/png;base64,{}", image_b64)
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }
        ],
        "max_tokens": 4096
    });

    let response = client
        .post("https://api.moonshot.cn/v1/chat/completions")
        .bearer_auth(&config.kimi_api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Kimi API request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let err_body = response.text().await.unwrap_or_default();
        return Err(format!("Kimi API error {}: {}", status, err_body));
    }

    let resp: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Kimi response: {}", e))?;

    resp["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "No content in Kimi response".to_string())
}
