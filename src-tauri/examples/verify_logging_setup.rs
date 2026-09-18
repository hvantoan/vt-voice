//! Standalone verification of the logging configuration in `src/lib.rs`.
//!
//! The tauri-plugin-log builder can only run inside a live Tauri app, so this
//! probe reads the builder source and asserts the retention invariants are
//! actually present — catching regressions that would silently drop rotation.
#![allow(dead_code)]

fn run() -> Result<(), String> {
    let src = std::fs::read_to_string(concat!(env!("CARGO_MANIFEST_DIR"), "/src/lib.rs"))
        .map_err(|e| format!("cannot read lib.rs: {e}"))?;

    // Slice the builder block at a real boundary. A fixed byte window would
    // panic on a multi-byte char and would silently miss later additions.
    let builder = src
        .find("tauri_plugin_log::Builder::new()")
        .ok_or("log plugin builder not found in lib.rs")?;
    let end = src[builder..]
        .find(".build();")
        .map(|i| builder + i)
        .ok_or("log plugin builder block has no .build()")?;
    let block = src.get(builder..end).ok_or("builder block is not on a char boundary")?;

    let in_block: [(&str, &str); 5] = [
        ("5 MiB max file size", ".max_file_size(5 * 1024 * 1024)"),
        ("keep 3 rotation files", "RotationStrategy::KeepSome(3)"),
        ("LogDir target", "TargetKind::LogDir"),
        ("default level Info", "log::LevelFilter::Info"),
        ("reqwest downgraded to Warn", ".level_for(\"reqwest\", log::LevelFilter::Warn)"),
    ];
    for (label, needle) in in_block {
        if !block.contains(needle) {
            return Err(format!("missing logging invariant: {label} ({needle})"));
        }
    }
    // The builder must actually be handed to the app, or none of it applies.
    if !src[builder..].contains(".plugin(log_plugin)") {
        return Err("log plugin builder is never registered via .plugin(log_plugin)".into());
    }

    // Every AI log call must target a vt_voice module namespace, and no
    // raw `eprintln!` (which bypasses redaction) may remain in the AI layer.
    let ai_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src/ai");
    let mut ai_src = String::new();
    for entry in std::fs::read_dir(&ai_dir).map_err(|e| format!("read ai dir: {e}"))? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.extension().and_then(|e| e.to_str()) == Some("rs") {
            ai_src.push_str(&std::fs::read_to_string(&path).map_err(|e| e.to_string())?);
        }
    }
    for needle in ["vt_voice::ai::stt", "vt_voice::ai::polish", "vt_voice::ai::translate"] {
        if !ai_src.contains(needle) {
            return Err(format!("missing AI log target: {needle}"));
        }
    }
    if ai_src.contains("eprintln!") {
        return Err("eprintln! remains in the AI layer (bypasses structured logging)".into());
    }

    // Every log site that prints a base URL must use the log-only sanitizer;
    // the plain normalizer does not strip query/userinfo secrets.
    let provider = std::fs::read_to_string(ai_dir.join("provider.rs")).map_err(|e| e.to_string())?;
    if provider.contains("normalize_base_url(base_url),") {
        return Err("a log site logs normalize_base_url(base_url) — query/userinfo secrets leak".into());
    }
    Ok(())
}

fn main() {
    match run() {
        Ok(()) => println!("OK logging-setup: 5MiB x 3 rotation, LogDir target, Info level, AI targets"),
        Err(e) => panic!("FAILED: {e}"),
    }
}
