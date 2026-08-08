mod browser_surface;
mod commands;
mod desktop_settings;
mod pi_host;
#[cfg(test)]
mod pi_host_tests;
mod shell_terminal;
mod system_tray;

use desktop_settings::DesktopSettingsStore;
use pi_host::PiHostManager;
use shell_terminal::ShellTerminalManager;
use tauri::{webview::WebviewWindowBuilder, Emitter, Listener, Manager};
use tokio::sync::Mutex;

/// 第二个实例启动时唤起并聚焦已有主窗口。
/// dev 构建的主窗口 label 是 "main-cdp"(lib.rs 建独立 CDP 窗口后销毁 "main"),
/// release 是 "main";按存在性优先选其一。
fn restore_main_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    let window = app
        .get_webview_window("main")
        .or_else(|| app.get_webview_window("main-cdp"));
    if let Some(window) = window {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

pub struct AppState {
    pub settings: Mutex<DesktopSettingsStore>,
    pub host: Mutex<PiHostManager>,
    pub terminals: Mutex<ShellTerminalManager>,
    pub browsers: Mutex<BrowserSurfaceManager>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            // 第二个实例进程启动时回调:唤起已有主窗口,本进程随后由插件退出。
            restore_main_window(app);
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .on_page_load(|webview, _payload| {
            // dev 构建自动打开 DevTools,方便调试(release 不编译,open_devtools 是 dev-only)
            #[cfg(debug_assertions)]
            {
                webview.open_devtools();
            }
            let _ = webview;
        })
        .setup(|app| {
            system_tray::install(app)?;

            let mut settings = DesktopSettingsStore::load(app.handle())?;
            settings.ensure_default_project_workspace()?;
            let host = PiHostManager::new(app.handle().clone(), &settings);
            app.manage(AppState {
                settings: Mutex::new(settings),
                host: Mutex::new(host),
                terminals: Mutex::new(ShellTerminalManager::new()),
                browsers: Mutex::new(BrowserSurfaceManager::new()),
            });

            // dev 构建:重建主窗口并注入 WebView2 `--remote-debugging-port`,
            // 供自动化测试脚本经 CDP 连入操控真实 Tauri WebView(带 __TAURI__ IPC)。
            // 环境变量 WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS 经 pnpm→cargo→exe 链路会丢失,
            // 只能在 Rust 端建窗口时直接设。release 不编译,不影响生产。
            #[cfg(debug_assertions)]
            {
                // 主窗口由 conf 声明但 create:false(不自动建),这里手动建并注入
                // WebView2 --remote-debugging-port=9223,供自动化测试脚本经 CDP 连入
                // 操控真实 Tauri WebView(带 __TAURI__ IPC)。必须让带 CDP args 的窗口
                // 首个创建 WebView2 environment,否则被老 environment 复用而忽略 args。
                // 用 9223 避开已运行的安装版(它占 9222)。
                // release 不编译本块,且 conf 无 create:false → 自动建窗口,行为不变。
                if let Some(cfg) = app.config().app.windows.iter().find(|w| w.label == "main") {
                    eprintln!("[dev-cdp] building main window with --remote-debugging-port=9223");
                    match WebviewWindowBuilder::from_config(app.handle(), cfg)?
                        .additional_browser_args("--remote-debugging-port=9223 --disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection")
                        .build() {
                        Ok(_) => eprintln!("[dev-cdp] main window built with CDP"),
                        Err(e) => eprintln!("[dev-cdp] build failed: {e}"),
                    }
                } else {
                    eprintln!("[dev-cdp] no 'main' window in config");
                }
            }

            let handle = app.handle().clone();
            // dev 构建:conf 自动建了 label='main' 的窗口(共享 WebView2 user-data-dir,
            // 与已装实例冲突会导致 WebView2 初始化失败)。这里建一个独立窗口(label='main-cdp'
            // 避开冲突),用独立 data_directory + 开 CDP 9223,再销毁老窗口。前端用
            // getCurrentWindow/getCurrentWebview(当前焦点窗口),不依赖 label。
            #[cfg(debug_assertions)]
            {
                eprintln!("[dev-cdp] building main-cdp: independent webview2 data-dir + CDP 9223");
                match WebviewWindowBuilder::new(
                    app.handle(),
                    "main-cdp",
                    tauri::WebviewUrl::App("index.html".into()),
                )
                .title("LXCode")
                .inner_size(1280.0, 800.0)
                .min_inner_size(960.0, 600.0)
                .resizable(true)
                .decorations(false)
                .data_directory(std::env::temp_dir().join("lxcode-dev-webview2"))
                .additional_browser_args("--remote-debugging-port=9223 --disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection")
                .build()
                {
                    Ok(_) => eprintln!("[dev-cdp] main-cdp window built with CDP"),
                    Err(e) => eprintln!("[dev-cdp] build failed: {e}"),
                }
                if let Some(old) = app.get_webview_window("main") {
                    // 不 destroy(会触发 app 退出判断),改为 hide 保留实例避免进程退出
                    let _ = old.hide();
                    eprintln!("[dev-cdp] old main hidden (not destroyed to avoid app exit)");
                }
            }
            tauri::async_runtime::spawn(async move {
                let state = handle.state::<AppState>();
                // start_unlocked never holds the host mutex across the ready-wait,
                // so IPC commands and app exit stay responsive during startup.
                if let Err(e) =
                    pi_host::start_unlocked(&state.host, pi_host::StartKind::Fresh).await
                {
                    eprintln!("[lxcode] failed to start host: {e}");
                    // Surface to UI as host.fatal so the banner shows the real cause
                    let _ = handle.emit(
                        "pi-host-stdout",
                        serde_json::json!({
                            "protocolVersion": 1,
                            "event": "host.fatal",
                            "sequence": 1,
                            "timestamp": 0,
                            "hostInstanceId": "00000000-0000-4000-8000-000000000001",
                            "workspaceId": null,
                            "workspaceRevision": 0,
                            "sessionId": null,
                            "sessionRevision": 0,
                            "packageRevision": 0,
                            "payload": {
                                "error": {
                                    "code": "INTERNAL_ERROR",
                                    "message": e,
                                    "retryable": true
                                }
                            }
                        })
                        .to_string(),
                    );
                }
            });

            // One-shot auto-restart after unexpected Host exit (R3)
            let handle_ar = app.handle().clone();
            app.listen("pi-host-auto-restart", move |_event| {
                let handle = handle_ar.clone();
                tauri::async_runtime::spawn(async move {
                    let state = handle.state::<AppState>();
                    eprintln!("[lxcode] auto-restarting Host once after crash");
                    if let Err(e) = pi_host::start_unlocked(
                        &state.host,
                        pi_host::StartKind::AutoRestartAfterCrash,
                    )
                    .await
                    {
                        eprintln!("[lxcode] auto-restart failed: {e}");
                        let _ = handle.emit(
                            "pi-host-stdout",
                            serde_json::json!({
                                "protocolVersion": 1,
                                "event": "host.fatal",
                                "sequence": 1,
                                "timestamp": 0,
                                "hostInstanceId": "00000000-0000-4000-8000-000000000003",
                                "workspaceId": null,
                                "workspaceRevision": 0,
                                "sessionId": null,
                                "sessionRevision": 0,
                                "packageRevision": 0,
                                "payload": {
                                    "error": {
                                        "code": "INTERNAL_ERROR",
                                        "message": format!("Auto-restart failed: {e}"),
                                        "retryable": false
                                    }
                                }
                            })
                            .to_string(),
                        );
                    }
                });
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::desktop_settings_get,
            commands::desktop_settings_patch,
            commands::desktop_open_path,
            commands::desktop_read_small_file,
            commands::desktop_write_temp_image,
            commands::desktop_cleanup_temp_images,
            commands::web_search_config_get,
            commands::web_search_config_patch,
            commands::automation_test_config_get,
            commands::automation_test_config_set,
            commands::pi_host_send,
            commands::pi_host_restart,
            commands::pi_host_status,
            commands::shell_terminal_create,
            commands::shell_terminal_profiles,
            commands::shell_terminal_write,
            commands::shell_terminal_resize,
            commands::shell_terminal_close,
            commands::browser_surface_create,
            commands::browser_surface_navigate,
            commands::browser_surface_control,
            commands::browser_surface_set_bounds,
            commands::browser_surface_set_visible,
            commands::browser_surface_focus,
            commands::browser_surface_close,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| match event {
            tauri::RunEvent::WindowEvent {
                label,
                event: tauri::WindowEvent::CloseRequested { api, .. },
                ..
            } if system_tray::should_hide_on_close(&label) => {
                api.prevent_close();
                if let Some(window) = app_handle.get_webview_window(&label) {
                    let _ = window.hide();
                }
            }
            tauri::RunEvent::Exit => {
                system_tray::remove(app_handle);
                let handle = app_handle.clone();
                tauri::async_runtime::block_on(async move {
                    let state = handle.state::<AppState>();
                    let mut browsers = state.browsers.lock().await;
                    browsers.shutdown_all();
                    drop(browsers);
                    let mut terminals = state.terminals.lock().await;
                    terminals.shutdown_all();
                    drop(terminals);
                    let mut host = state.host.lock().await;
                    host.shutdown_for_app_exit().await;
                });
            }
            _ => {}
        });
}
use browser_surface::BrowserSurfaceManager;
