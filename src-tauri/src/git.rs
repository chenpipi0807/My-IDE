use serde::Serialize;
use std::process::Command;

#[derive(Debug, Serialize)]
pub struct GitStatus {
    pub branch: String,
    pub changes: Vec<GitChange>,
    pub staged: Vec<GitChange>,
}

#[derive(Debug, Serialize)]
pub struct GitChange {
    pub status: String,
    pub path: String,
}

#[derive(Debug, Serialize)]
pub struct CommitInfo {
    pub hash: String,
    pub author: String,
    pub date: String,
    pub message: String,
}

fn run_git(cwd: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .current_dir(cwd)
        .args(args)
        .output()
        .map_err(|e| format!("Failed to run git (is git installed?): {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("git {}: {}", args.first().unwrap_or(&""), stderr.trim()))
    }
}

#[tauri::command]
pub fn git_status(cwd: String) -> Result<GitStatus, String> {
    let branch = run_git(&cwd, &["branch", "--show-current"])
        .unwrap_or_else(|_| "main\n".to_string())
        .trim()
        .to_string();

    let status_out = run_git(&cwd, &["status", "--porcelain=v1"])
        .unwrap_or_default();

    let mut changes = Vec::new();
    let mut staged = Vec::new();

    for line in status_out.lines() {
        if line.len() < 3 {
            continue;
        }
        let x = &line[0..1];
        let y = &line[1..2];
        let path = line[3..].to_string();

        if x != " " && x != "?" {
            staged.push(GitChange { status: x.to_string(), path: path.clone() });
        }
        if y != " " {
            changes.push(GitChange { status: if y == "?" { "U".to_string() } else { y.to_string() }, path });
        }
    }

    Ok(GitStatus { branch, changes, staged })
}

#[tauri::command]
pub fn git_diff(cwd: String, file: Option<String>) -> Result<String, String> {
    match file {
        Some(f) => run_git(&cwd, &["diff", "--", &f]),
        None => run_git(&cwd, &["diff"]),
    }
}

#[tauri::command]
pub fn git_diff_staged(cwd: String) -> Result<String, String> {
    run_git(&cwd, &["diff", "--cached"])
}

#[tauri::command]
pub fn git_add(cwd: String, path: String) -> Result<(), String> {
    run_git(&cwd, &["add", &path]).map(|_| ())
}

#[tauri::command]
pub fn git_unstage(cwd: String, path: String) -> Result<(), String> {
    run_git(&cwd, &["restore", "--staged", &path]).map(|_| ())
}

#[tauri::command]
pub fn git_commit(cwd: String, message: String) -> Result<String, String> {
    run_git(&cwd, &["commit", "-m", &message])
}

#[tauri::command]
pub fn git_log(cwd: String) -> Result<Vec<CommitInfo>, String> {
    let output = run_git(&cwd, &["log", "--pretty=format:%h|%an|%ar|%s", "-20"])?;
    let commits = output
        .lines()
        .filter(|l| !l.is_empty())
        .map(|line| {
            let parts: Vec<&str> = line.splitn(4, '|').collect();
            CommitInfo {
                hash: parts.first().copied().unwrap_or("").to_string(),
                author: parts.get(1).copied().unwrap_or("").to_string(),
                date: parts.get(2).copied().unwrap_or("").to_string(),
                message: parts.get(3).copied().unwrap_or("").to_string(),
            }
        })
        .collect();
    Ok(commits)
}

#[tauri::command]
pub fn git_init(cwd: String) -> Result<String, String> {
    run_git(&cwd, &["init"])
}

#[tauri::command]
pub fn git_is_repo(cwd: String) -> bool {
    run_git(&cwd, &["rev-parse", "--is-inside-work-tree"]).is_ok()
}

#[tauri::command]
pub fn git_pull(cwd: String) -> Result<String, String> {
    run_git(&cwd, &["pull"])
}

#[tauri::command]
pub fn git_push(cwd: String) -> Result<String, String> {
    run_git(&cwd, &["push"])
}

#[tauri::command]
pub fn git_branches(cwd: String) -> Result<Vec<String>, String> {
    let out = run_git(&cwd, &["branch", "-a", "--format=%(refname:short)"])?;
    Ok(out.lines().filter(|l| !l.is_empty()).map(|l| l.to_string()).collect())
}
