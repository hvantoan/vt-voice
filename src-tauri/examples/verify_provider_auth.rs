#![allow(dead_code)]

fn mask_key(key: &str) -> String {
    let chars: Vec<char> = key.trim().chars().collect();
    let len = chars.len();
    if len > 6 {
        let prefix: String = chars[..3].iter().collect();
        let suffix: String = chars[len - 3..].iter().collect();
        let asterisks = "*".repeat(len - 6);
        format!("{}{}{}", prefix, asterisks, suffix)
    } else if len > 0 {
        "*".repeat(len)
    } else {
        String::new()
    }
}

fn normalize_base_url(base_url: &str) -> String {
    const SUFFIXES: &[&str] = &[
        "/audio/transcriptions",
        "/chat/completions",
        "/models",
    ];

    let mut clean = base_url.trim().trim_end_matches('/');
    loop {
        let next = SUFFIXES
            .iter()
            .find_map(|suffix| clean.strip_suffix(suffix))
            .map(|s| s.trim_end_matches('/'))
            .unwrap_or(clean);

        if next == clean {
            break;
        }
        clean = next;
    }
    clean.to_string()
}

fn normalize_models_url(base_url: &str) -> String {
    let clean_base = normalize_base_url(base_url);
    format!("{}/models", clean_base)
}

fn normalize_audio_url(endpoint: &str) -> String {
    let clean = normalize_base_url(endpoint);
    format!("{}/audio/transcriptions", clean)
}

fn normalize_chat_url(endpoint: &str) -> String {
    let clean = normalize_base_url(endpoint);
    format!("{}/chat/completions", clean)
}

fn is_masked_key(key: &str) -> bool {
    key.contains('•') || key.contains('*')
}

fn main() {
    println!("=== Verifying Provider Auth & Masking Logic ===");

    // 1. Verify mask_key format: number of asterisks equals number of hidden characters
    let masked1 = mask_key("sk-123adb"); // 9 chars -> 3 hidden
    assert_eq!(masked1, "sk-***adb");
    println!("✓ mask_key('sk-123adb') -> '{}' (3 asterisks for 3 hidden): PASS", masked1);

    let masked2 = mask_key("sk-123456789adb"); // 15 chars -> 9 hidden
    assert_eq!(masked2, "sk-*********adb");
    assert_eq!(masked2.chars().filter(|&c| c == '*').count(), 9);
    println!("✓ mask_key('sk-123456789adb') -> '{}' (9 asterisks for 9 hidden): PASS", masked2);

    let masked_short = mask_key("short"); // 5 chars -> 5 hidden
    assert_eq!(masked_short, "*****");
    println!("✓ mask_key short (5 chars) -> '*****' (all hidden): PASS");
    // 2. Verify masked key detection guard
    assert!(is_masked_key("sk-***adb"));
    assert!(is_masked_key("sk-••••••••adb"));
    assert!(!is_masked_key("sk-validkey123456789"));
    println!("✓ Masked key guards (both * and •): PASS");

    // 3. Verify base URL normalization
    assert_eq!(
        normalize_base_url("https://api.openai.com/v1/models"),
        "https://api.openai.com/v1"
    );
    assert_eq!(
        normalize_base_url("https://api.openai.com/v1/models/"),
        "https://api.openai.com/v1"
    );
    assert_eq!(
        normalize_base_url("https://api.openai.com/v1/audio/transcriptions"),
        "https://api.openai.com/v1"
    );
    assert_eq!(
        normalize_base_url("https://api.openai.com/v1/chat/completions/"),
        "https://api.openai.com/v1"
    );
    assert_eq!(
        normalize_base_url("  https://api.groq.com/openai/v1/  "),
        "https://api.groq.com/openai/v1"
    );
    println!("✓ Base URL normalization: PASS");

    // 4. Verify models endpoint URL normalization
    assert_eq!(
        normalize_models_url("https://api.groq.com/openai/v1"),
        "https://api.groq.com/openai/v1/models"
    );
    assert_eq!(
        normalize_models_url("https://api.groq.com/openai/v1/models"),
        "https://api.groq.com/openai/v1/models"
    );
    assert_eq!(
        normalize_models_url("https://api.groq.com/openai/v1/audio/transcriptions"),
        "https://api.groq.com/openai/v1/models"
    );
    assert_eq!(
        normalize_models_url("https://api.groq.com/openai/v1/chat/completions"),
        "https://api.groq.com/openai/v1/models"
    );
    println!("✓ Models URL normalization (handles base, /models, /audio/transcriptions, /chat/completions): PASS");

    // 5. Verify audio endpoint URL normalization
    assert_eq!(
        normalize_audio_url("https://api.groq.com/openai/v1"),
        "https://api.groq.com/openai/v1/audio/transcriptions"
    );
    assert_eq!(
        normalize_audio_url("https://api.groq.com/openai/v1/audio/transcriptions"),
        "https://api.groq.com/openai/v1/audio/transcriptions"
    );
    assert_eq!(
        normalize_audio_url("https://api.groq.com/openai/v1/models"),
        "https://api.groq.com/openai/v1/audio/transcriptions"
    );
    println!("✓ Audio URL normalization (handles base, full audio endpoint, and /models): PASS");

    // 6. Verify chat completion endpoint URL normalization
    assert_eq!(
        normalize_chat_url("https://api.groq.com/openai/v1/models"),
        "https://api.groq.com/openai/v1/chat/completions"
    );
    println!("✓ Chat completion URL normalization from /models: PASS");
    println!("\nALL LOGIC VERIFICATIONS PASSED!");
}
