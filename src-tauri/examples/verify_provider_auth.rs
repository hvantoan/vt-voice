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

fn normalize_models_url(base_url: &str) -> String {
    let clean_base = base_url.trim().trim_end_matches('/');
    let clean_base = clean_base.strip_suffix("/audio/transcriptions").unwrap_or(clean_base);
    if clean_base.ends_with("/models") {
        clean_base.to_string()
    } else {
        format!("{}/models", clean_base)
    }
}

fn normalize_audio_url(endpoint: &str) -> String {
    let clean = endpoint.trim().trim_end_matches('/');
    if clean.ends_with("/audio/transcriptions") {
        clean.to_string()
    } else {
        format!("{}/audio/transcriptions", clean)
    }
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

    // 3. Verify models endpoint URL normalization
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
    println!("✓ Models URL normalization (handles base, /models, /audio/transcriptions): PASS");

    // 4. Verify audio endpoint URL normalization
    assert_eq!(
        normalize_audio_url("https://api.groq.com/openai/v1"),
        "https://api.groq.com/openai/v1/audio/transcriptions"
    );
    assert_eq!(
        normalize_audio_url("https://api.groq.com/openai/v1/audio/transcriptions"),
        "https://api.groq.com/openai/v1/audio/transcriptions"
    );
    println!("✓ Audio URL normalization (handles base and full endpoint): PASS");

    println!("\nALL LOGIC VERIFICATIONS PASSED!");
}
