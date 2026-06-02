mod ai;
mod config;
mod fs;
mod git;
mod terminal;

use terminal::PtyStore;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(PtyStore::default())
        .invoke_handler(tauri::generate_handler![
            // Config
            config::config_load,
            config::config_save,
            // File system
            fs::fs_list_dir,
            fs::fs_expand_dir,
            fs::fs_read_file,
            fs::fs_write_file,
            fs::fs_delete_path,
            fs::fs_create_dir,
            fs::fs_rename,
            fs::fs_get_cwd,
            fs::fs_search,
            fs::fs_find_files,
            // Git
            git::git_status,
            git::git_diff,
            git::git_diff_staged,
            git::git_add,
            git::git_unstage,
            git::git_commit,
            git::git_log,
            git::git_init,
            git::git_is_repo,
            git::git_pull,
            git::git_push,
            git::git_branches,
            // Terminal
            terminal::terminal_create,
            terminal::terminal_write,
            terminal::terminal_resize,
            terminal::terminal_close,
            terminal::terminal_run_capture,
            // AI
            ai::deepseek::ai_chat_deepseek,
            ai::kimi::ai_kimi_vision,
        ])
        .run(tauri::generate_context!())
        .expect("error while running deepseek IDE");
}
