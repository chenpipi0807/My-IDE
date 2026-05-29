use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

use crate::config::config_load;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub role: String,
    pub content: Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Tool {
    pub name: String,
    pub description: String,
    pub parameters: Value,
}

fn build_client(proxy: &str) -> Result<Client, String> {
    let mut builder = Client::builder();
    if !proxy.is_empty() {
        let p = reqwest::Proxy::all(proxy).map_err(|e| e.to_string())?;
        builder = builder.proxy(p);
    }
    builder.build().map_err(|e| e.to_string())
}

fn build_tools_json(tools: &[Tool]) -> Vec<Value> {
    tools
        .iter()
        .map(|t| {
            json!({
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.parameters,
                }
            })
        })
        .collect()
}

#[tauri::command]
pub async fn ai_chat_deepseek(
    app: AppHandle,
    request_id: String,
    messages: Vec<Message>,
    tools: Option<Vec<Tool>>,
) -> Result<(), String> {
    let config = config_load();

    if config.deepseek_api_key.is_empty() {
        return Err("DeepSeek API key not configured. Please set it in Settings.".to_string());
    }

    let client = build_client(&config.proxy)?;

    let mut body = json!({
        "model": config.deepseek_model,
        "messages": messages,
        "stream": true,
        "temperature": 0.0,
    });

    if let Some(ref t) = tools {
        if !t.is_empty() {
            body["tools"] = json!(build_tools_json(t));
            body["tool_choice"] = json!("auto");
        }
    }

    let response = client
        .post("https://api.deepseek.com/v1/chat/completions")
        .bearer_auth(&config.deepseek_api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("DeepSeek API request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let err_body = response.text().await.unwrap_or_default();
        return Err(format!("DeepSeek API error {}: {}", status, err_body));
    }

    let mut stream = response.bytes_stream();

    // Accumulate tool call fragments across chunks
    let mut tool_call_acc: std::collections::HashMap<u32, (String, String, String)> =
        std::collections::HashMap::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream error: {}", e))?;
        let text = String::from_utf8_lossy(&chunk);

        for line in text.lines() {
            if let Some(data) = line.strip_prefix("data: ") {
                if data == "[DONE]" {
                    // Emit any completed tool calls
                    for (_, (id, name, args)) in &tool_call_acc {
                        let _ = app.emit(
                            &format!("ai_tool_call:{}", request_id),
                            json!({ "id": id, "name": name, "arguments": args }),
                        );
                    }
                    let _ = app.emit(&format!("ai_done:{}", request_id), ());
                    return Ok(());
                }

                if let Ok(val) = serde_json::from_str::<Value>(data) {
                    let choice = &val["choices"][0];
                    let delta = &choice["delta"];

                    // Text content
                    if let Some(content) = delta["content"].as_str() {
                        if !content.is_empty() {
                            let _ = app.emit(
                                &format!("ai_delta:{}", request_id),
                                json!({ "content": content }),
                            );
                        }
                    }

                    // Tool call fragments
                    if let Some(tool_calls) = delta["tool_calls"].as_array() {
                        for tc in tool_calls {
                            let index = tc["index"].as_u64().unwrap_or(0) as u32;
                            let entry = tool_call_acc.entry(index).or_insert((
                                String::new(),
                                String::new(),
                                String::new(),
                            ));

                            if let Some(id) = tc["id"].as_str() {
                                if !id.is_empty() {
                                    entry.0 = id.to_string();
                                }
                            }
                            if let Some(name) = tc["function"]["name"].as_str() {
                                if !name.is_empty() {
                                    entry.1 = name.to_string();
                                }
                            }
                            if let Some(args) = tc["function"]["arguments"].as_str() {
                                entry.2.push_str(args);
                            }
                        }
                    }

                    // Finish reason
                    if let Some(reason) = choice["finish_reason"].as_str() {
                        if reason == "tool_calls" {
                            for (_, (id, name, args)) in &tool_call_acc {
                                let _ = app.emit(
                                    &format!("ai_tool_call:{}", request_id),
                                    json!({ "id": id, "name": name, "arguments": args }),
                                );
                            }
                            tool_call_acc.clear();
                        }
                    }
                }
            }
        }
    }

    let _ = app.emit(&format!("ai_done:{}", request_id), ());
    Ok(())
}
