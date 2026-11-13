use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_updater::UpdaterExt;

use crate::daemon::TrayManager;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub available: bool,
    pub version: Option<String>,
    pub notes: Option<String>,
    pub date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProgressPayload {
    pub event: String,
    pub downloaded: u64,
    pub total: Option<u64>,
}

#[derive(Default)]
pub struct PendingUpdateState {
    pub info: Mutex<Option<UpdateInfo>>,
    pub is_installing: AtomicBool,
}

struct InstallGuard<'a>(&'a AtomicBool);

impl Drop for InstallGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

impl UpdateInfo {
    pub fn none() -> Self {
        Self {
            available: false,
            version: None,
            notes: None,
            date: None,
        }
    }
}

pub async fn check_for_updates_internal(app: &AppHandle) -> Result<UpdateInfo, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    let maybe_update = updater.check().await.map_err(|e| e.to_string())?;

    let info = match maybe_update {
        Some(update) => {
            let info = UpdateInfo {
                available: true,
                version: Some(update.version.clone()),
                notes: update.body.clone(),
                date: update.date.map(|d| d.to_string()),
            };
            TrayManager::set_update_available(app, Some(&update.version));
            let _ = app.emit("updater:available", &info);
            info
        }
        None => {
            TrayManager::set_update_available(app, None);
            UpdateInfo::none()
        }
    };

    if let Some(pending) = app.try_state::<PendingUpdateState>() {
        *pending.info.lock() = if info.available {
            Some(info.clone())
        } else {
            None
        };
    }

    Ok(info)
}

#[tauri::command]
pub fn get_pending_update(state: State<'_, PendingUpdateState>) -> Option<UpdateInfo> {
    state.info.lock().clone()
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<UpdateInfo, String> {
    check_for_updates_internal(&app).await
}

#[tauri::command]
pub async fn install_update(
    app: AppHandle,
    state: State<'_, PendingUpdateState>,
) -> Result<(), String> {
    if state
        .is_installing
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("Update installation is already in progress".to_string());
    }
    let _guard = InstallGuard(&state.is_installing);

    let updater = app.updater().map_err(|e| e.to_string())?;
    let update = updater
        .check()
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "No update available".to_string())?;

    let downloaded = Arc::new(AtomicU64::new(0));
    let started = Arc::new(AtomicBool::new(false));
    let app_chunk = app.clone();
    let app_finish = app.clone();
    let downloaded_chunk = Arc::clone(&downloaded);
    let downloaded_finish = Arc::clone(&downloaded);
    let started_chunk = Arc::clone(&started);

    update
        .download_and_install(
            move |chunk_length, content_length| {
                if !started_chunk.swap(true, Ordering::SeqCst) {
                    let _ = app_chunk.emit(
                        "updater:progress",
                        UpdateProgressPayload {
                            event: "Started".to_string(),
                            downloaded: 0,
                            total: content_length,
                        },
                    );
                }
                let total_downloaded =
                    downloaded_chunk.fetch_add(chunk_length as u64, Ordering::SeqCst)
                        + chunk_length as u64;
                let _ = app_chunk.emit(
                    "updater:progress",
                    UpdateProgressPayload {
                        event: "Progress".to_string(),
                        downloaded: total_downloaded,
                        total: content_length,
                    },
                );
            },
            move || {
                let final_downloaded = downloaded_finish.load(Ordering::SeqCst);
                let _ = app_finish.emit(
                    "updater:progress",
                    UpdateProgressPayload {
                        event: "Finished".to_string(),
                        downloaded: final_downloaded,
                        total: Some(final_downloaded),
                    },
                );
            },
        )
        .await
        .map_err(|e| e.to_string())?;

    app.restart();
}

pub fn spawn_startup_update_check(app: AppHandle, auto_check: bool) {
    if !auto_check {
        return;
    }

    tauri::async_runtime::spawn(async move {
        // Đợi ổn định hook/tray sau khi khởi động trước khi kiểm tra mạng ngầm
        tokio::time::sleep(Duration::from_secs(6)).await;
        if let Err(err) = check_for_updates_internal(&app).await {
            log::warn!("Background update check skipped/failed: {}", err);
        }
    });
}
