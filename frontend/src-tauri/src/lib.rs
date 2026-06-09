use std::process::{Command, Child};
use std::sync::Mutex;

static BACKEND: Mutex<Option<Child>> = Mutex::new(None);

fn start_backend(path: &std::path::Path) -> Option<Child> {
    let run_script = path.join("run.sh");
    if !run_script.exists() {
        eprintln!("Backend run.sh not found at {:?}", run_script);
        return None;
    }
    match Command::new("sh")
        .arg(&run_script)
        .current_dir(path)
        .spawn()
    {
        Ok(child) => {
            println!("Backend started (pid={}) from {:?}", child.id(), path);
            Some(child)
        }
        Err(e) => {
            eprintln!("Backend start error: {}", e);
            None
        }
    }
}

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
                    let backend_dir = if exe_dir.ends_with("MacOS") {
                        exe_dir.parent()
                            .map(|p| p.join("Resources").join("backend"))
                    } else {
                        Some(exe_dir.join("backend"))
                    };

                    if let Some(ref dir) = backend_dir {
                        if let Some(child) = start_backend(dir) {
                            if let Ok(mut guard) = BACKEND.lock() {
                                *guard = Some(child);
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
