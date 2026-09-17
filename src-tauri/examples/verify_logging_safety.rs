//! Executable zero-PII auditor over the REAL AI log call sites.
//!
//! Note on why this parses source instead of installing a `log` capture sink:
//! on this Windows toolchain every binary that links `vt_voice_lib` aborts at
//! load with `0xc0000139 (STATUS_ENTRYPOINT_NOT_FOUND)` (documented in
//! AGENTS.md). A capture-sink test therefore cannot run here, and a test that
//! re-derives log templates from its own literals proves nothing. This probe
//! reads the production files and asserts, for every `log::*!` invocation:
//!
//!   1. each `{}` placeholder carries a metadata-only label
//!      (`base_url`, `model`, `text_len`, ... ). Renaming `text_len={}` to
//!      `text={}` — i.e. logging the transcript — fails here.
//!   2. no log argument references user text, a prompt, or a credential.
//!      `X.len()` is explicitly allowed: lengths are the point of the design.
//!   3. the arg count matches the placeholder count.
//!
//! Run: `cargo run --example verify_logging_safety`
#![allow(dead_code)]

use std::fs;
use std::path::{Path, PathBuf};

/// Placeholder labels permitted inside a log format string.
const ALLOWED_LABELS: &[&str] = &[
    "base_url",
    "model",
    "duration_ms",
    "error_kind",
    "input_len",
    "output_len",
    "text_len",
    "audio_size_bytes",
    "source_lang",
    "target_lang",
    "status",
];

/// Identifiers that must never be interpolated into a log line. Matches are
/// whole-word so `text_len` does not trip `text`.
const FORBIDDEN_ARGS: &[&str] = &[
    "raw_text",
    "polished_text",
    "translated_text",
    "system_prompt",
    "sys_prompt",
    "api_key",
    "key",
    "err_body",
    "body",
    "sanitized",
    "trimmed",
    "output",
    "text",
    "transcript",
];

/// Expressions that consume a value safely — stripped before the forbidden
/// identifier scan so `text.len()` and `error_kind(&err)` pass.
const SAFE_CALL_PREFIXES: &[&str] = &[
    "error_kind(",
    "error_kind_status(",
    "sanitize_base_url_for_log(",
];

fn ai_files() -> Result<Vec<PathBuf>, String> {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("src/ai");
    let mut files = vec![];
    for entry in fs::read_dir(&dir).map_err(|e| format!("read {}: {e}", dir.display()))? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.extension().and_then(|e| e.to_str()) == Some("rs") {
            files.push(path);
        }
    }
    files.push(Path::new(env!("CARGO_MANIFEST_DIR")).join("src/lib.rs"));
    files.sort();
    Ok(files)
}

/// Returns the byte span just past the `)` matching the `(` at `open`.
fn matching_paren(bytes: &[u8], open: usize) -> Option<usize> {
    let mut depth = 0usize;
    let mut in_str = false;
    let mut escaped = false;
    for (i, &b) in bytes.iter().enumerate().skip(open) {
        if in_str {
            if escaped {
                escaped = false;
            } else if b == b'\\' {
                escaped = true;
            } else if b == b'"' {
                in_str = false;
            }
            continue;
        }
        match b {
            b'"' => in_str = true,
            b'(' => depth += 1,
            b')' => {
                depth -= 1;
                if depth == 0 {
                    return Some(i + 1);
                }
            }
            _ => {}
        }
    }
    None
}

/// Collects `(line_number, macro_body, target)` for every `log::<level>!(...)`.
/// The identifier path is matched exactly so `log::LevelFilter::Info` is not
/// mistaken for a macro.
fn log_invocations(src: &str) -> Vec<(usize, String, String)> {
    const LEVELS: &[&str] = &["trace", "debug", "info", "warn", "error"];
    let bytes = src.as_bytes();
    let mut out = vec![];
    let mut from = 0usize;
    while let Some(rel) = src[from..].find("log::") {
        let start = from + rel;
        from = start + 5;
        let Some(rest) = LEVELS.iter().find(|l| src[start + 5..].starts_with(**l)) else {
            continue;
        };
        let open = start + 5 + rest.len();
        if !src[open..].starts_with("!(") {
            continue;
        }
        let Some(end) = matching_paren(bytes, open + 1) else { continue };
        let line = src[..start].matches('\n').count() + 1;
        let body = src[open + 2..end - 1].to_string();
        let target = body
            .trim()
            .strip_prefix("target:")
            .and_then(|s| s.split('"').nth(1))
            .unwrap_or_default()
            .to_string();
        out.push((line, body, target));
    }
    out
}

/// Extracts the format string and its argument list from a macro body.
/// Returns `(format_string, args)` with a leading `target: "...",` removed.
fn split_format_and_args(body: &str) -> Result<(String, String), String> {
    let mut rest = body.trim();
    if let Some(stripped) = rest.strip_prefix("target:") {
        let Some(q) = stripped.find('"') else { return Err("malformed target".into()) };
        let Some(close) = stripped[q + 1..].find('"') else { return Err("unterminated target".into()) };
        rest = stripped[q + close + 2..].trim_start_matches([',', ' ', '\n', '\r', '\t']);
    }
    let Some(q) = rest.find('"') else { return Err("no format string".into()) };
    let mut escaped = false;
    let mut close = None;
    for (i, c) in rest[q + 1..].char_indices() {
        if escaped {
            escaped = false;
        } else if c == '\\' {
            escaped = true;
        } else if c == '"' {
            close = Some(q + 1 + i);
            break;
        }
    }
    let Some(close) = close else { return Err("unterminated format string".into()) };
    Ok((rest[q + 1..close].to_string(), rest[close + 1..].to_string()))
}

/// Splits an argument list on top-level commas.
fn split_top_level(args: &str) -> Vec<String> {
    let mut out = vec![];
    let mut depth = 0i32;
    let mut in_str = false;
    let mut escaped = false;
    let mut cur = String::new();
    for c in args.chars() {
        if in_str {
            cur.push(c);
            if escaped {
                escaped = false;
            } else if c == '\\' {
                escaped = true;
            } else if c == '"' {
                in_str = false;
            }
            continue;
        }
        match c {
            '"' => {
                in_str = true;
                cur.push(c);
            }
            '(' | '[' | '{' => {
                depth += 1;
                cur.push(c);
            }
            ')' | ']' | '}' => {
                depth -= 1;
                cur.push(c);
            }
            ',' if depth == 0 => {
                if !cur.trim().is_empty() {
                    out.push(cur.trim().to_string());
                }
                cur.clear();
            }
            _ => cur.push(c),
        }
    }
    if !cur.trim().is_empty() {
        out.push(cur.trim().to_string());
    }
    out
}

/// Removes safe value-consuming expressions so lengths survive the scan.
fn strip_safe_expressions(args: &str) -> String {
    let mut s = args.to_string();
    for prefix in SAFE_CALL_PREFIXES {
        while let Some(i) = s.find(prefix) {
            let Some(end) = matching_paren(s.as_bytes(), i + prefix.len() - 1) else { break };
            let consumed = if s[end..].starts_with(".len()") { end + ".len()".len() } else { end };
            s.replace_range(i..consumed, " ");
        }
    }
    // Drop every `X.len()` — a length is metadata, never content.
    while let Some(dot) = s.find(".len()") {
        let start = s[..dot]
            .rfind(|c: char| !(c.is_alphanumeric() || c == '_' || c == '.' || c == ')' || c == ' '))
            .map(|i| i + 1)
            .unwrap_or(0);
        s.replace_range(start..dot + ".len()".len(), " ");
    }
    s
}

/// True when `ident` appears as a whole word in `haystack`.
fn contains_word(haystack: &str, ident: &str) -> bool {
    let mut from = 0usize;
    while let Some(rel) = haystack[from..].find(ident) {
        let i = from + rel;
        let before_ok = i == 0
            || !haystack[..i]
                .chars()
                .next_back()
                .is_some_and(|c| c.is_alphanumeric() || c == '_');
        let after = i + ident.len();
        let after_ok = !haystack[after..]
            .chars()
            .next()
            .is_some_and(|c| c.is_alphanumeric() || c == '_');
        if before_ok && after_ok {
            return true;
        }
        from = after;
    }
    false
}

fn run() -> Result<(), String> {
    let mut checked = 0usize;
    let mut violations: Vec<String> = vec![];

    for path in ai_files()? {
        let src = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        let name = path.file_name().unwrap().to_string_lossy().into_owned();
        let in_ai_layer = path.parent().map(|p| p.ends_with("ai")).unwrap_or(false);
        for (line, body, target) in log_invocations(&src) {
            // Only the AI logging surface is governed by this plan's zero-PII
            // contract, and every log in src/ai must carry such a target —
            // an untargeted log would escape this audit entirely.
            if !target.starts_with("vt_voice::ai::") {
                if in_ai_layer {
                    violations.push(format!(
                        "{name}:{line}: AI-layer log must target vt_voice::ai::* (found `{}`)",
                        if target.is_empty() { "<none>" } else { &target }
                    ));
                }
                continue;
            }
            let (fmt, raw_args) = match split_format_and_args(&body) {
                Ok(v) => v,
                Err(e) => {
                    violations.push(format!("{name}:{line}: unparsable log macro ({e})"));
                    continue;
                }
            };
            checked += 1;

            // Rule 1 — every placeholder must carry a metadata-only label.
            let mut placeholders = 0usize;
            let mut rest = fmt.as_str();
            while let Some(open) = rest.find('{') {
                let Some(close) = rest[open..].find('}') else { break };
                let inner = &rest[open + 1..open + close];
                placeholders += 1;
                if !inner.is_empty() {
                    // Named/format-spec placeholders are not used in this codebase.
                    violations.push(format!("{name}:{line}: non-plain placeholder {{{inner}}}"));
                }
                let label: String = rest[..open]
                    .trim_end_matches('=')
                    .chars()
                    .rev()
                    .take_while(|c| c.is_alphanumeric() || *c == '_')
                    .collect::<Vec<_>>()
                    .into_iter()
                    .rev()
                    .collect();
                if !ALLOWED_LABELS.contains(&label.as_str()) {
                    violations.push(format!(
                        "{name}:{line}: placeholder label `{label}` is not metadata-only"
                    ));
                }
                rest = &rest[open + close + 1..];
            }

            // Rule 2 — no argument may reference user content or a credential.
            let args = split_top_level(&raw_args);
            let scanned = strip_safe_expressions(&raw_args);
            for forbidden in FORBIDDEN_ARGS {
                if contains_word(&scanned, forbidden) {
                    violations.push(format!(
                        "{name}:{line}: log argument references `{forbidden}` (user content/credential)"
                    ));
                }
            }

            // Rule 3 — arg count must match the placeholder count.
            if args.len() != placeholders {
                violations.push(format!(
                    "{name}:{line}: {placeholders} placeholder(s) vs {} argument(s)",
                    args.len()
                ));
            }
        }
    }

    if checked < 15 {
        return Err(format!("only audited {checked} log sites; parser likely broke"));
    }
    if !violations.is_empty() {
        for v in &violations {
            eprintln!("PII VIOLATION: {v}");
        }
        return Err(format!("{} zero-PII violation(s) across {checked} log sites", violations.len()));
    }
    println!("OK logging-safety: {checked} log sites audited, metadata-only labels, zero-PII args");
    Ok(())
}

fn main() {
    if let Err(e) = run() {
        panic!("FAILED: {e}");
    }
}
