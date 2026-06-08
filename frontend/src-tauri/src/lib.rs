use std::process::{Command, Child};
use std::sync::Mutex;

static BACKEND: Mutex<Option<Child>> = Mutex::new(None);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            if let Ok(exe) = std::env::current_exe() {
                if let Some(exe_dir) = exe.parent() {
                    let backend_path = if exe_dir.ends_with("MacOS") {
                        exe_dir.parent()
                            .map(|p| p.join("Resources").join("backend").join("listening-backend"))
                    } else {
                        Some(exe_dir.join("listening-backend"))
                    };

                    if let Some(ref path) = backend_path {
                        if path.exists() {
                            match Command::new(path).spawn() {
                                Ok(child) => {
                                    if let Ok(mut guard) = BACKEND.lock() {
                                        *guard = Some(child);
                                    }
                                }
                                Err(e) => eprintln!("Backend start error: {}", e),
                            }
                        }
                    }
                }
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error building app")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                if let Ok(mut guard) = BACKEND.lock() {
                    if let Some(ref mut child) = *guard {
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                }
            }
        });
}
