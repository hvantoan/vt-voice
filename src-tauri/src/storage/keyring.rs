use keyring::Entry;

const SERVICE_NAME: &str = "vt-voice";

#[derive(Debug, thiserror::Error)]
pub enum KeyringError {
    #[error("Keyring operation error: {0}")]
    Keyring(#[from] keyring::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// Maps provider identifier to Windows Credential Vault account name
pub fn get_account_name(provider: &str) -> String {
    match provider.trim().to_lowercase().as_str() {
        "groq" => "groq_api_key".to_string(),
        "openrouter" => "openrouter_api_key".to_string(),
        "custom" => "custom_api_key".to_string(),
        other => format!("{}_api_key", other),
    }
}

/// Masks an API key for safe UI presentation.
/// For keys with 12 or more characters: preserves first 4 and last 4 chars, replacing middle with 8 bullets.
/// For shorter keys: returns 8 bullets.
pub fn mask_key(key: &str) -> String {
    let chars: Vec<char> = key.trim().chars().collect();
    if chars.len() >= 12 {
        let prefix: String = chars[..4].iter().collect();
        let suffix: String = chars[chars.len() - 4..].iter().collect();
        format!("{}••••••••{}", prefix, suffix)
    } else if !chars.is_empty() {
        "••••••••".to_string()
    } else {
        String::new()
    }
}

/// Securely save an API key for a specific provider in Windows Credential Vault
pub fn set_provider_key(provider: &str, key: &str) -> Result<(), KeyringError> {
    let account = get_account_name(provider);
    let entry = Entry::new(SERVICE_NAME, &account)?;
    entry.set_password(key.trim())?;
    Ok(())
}

/// Retrieve the stored API key for a specific provider from Windows Credential Vault
pub fn get_provider_key(provider: &str) -> Result<Option<String>, KeyringError> {
    let account = get_account_name(provider);
    let entry = Entry::new(SERVICE_NAME, &account)?;
    match entry.get_password() {
        Ok(password) => {
            if password.trim().is_empty() {
                Ok(None)
            } else {
                Ok(Some(password))
            }
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(KeyringError::Keyring(e)),
    }
}

/// Check if an API key exists and is non-empty for a specific provider
pub fn has_provider_key(provider: &str) -> bool {
    match get_provider_key(provider) {
        Ok(Some(key)) => !key.trim().is_empty(),
        _ => false,
    }
}

/// Delete the stored API key for a specific provider from Windows Credential Vault
pub fn delete_provider_key(provider: &str) -> Result<(), KeyringError> {
    let account = get_account_name(provider);
    let entry = Entry::new(SERVICE_NAME, &account)?;
    match entry.delete_credential() {
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(KeyringError::Keyring(e)),
    }
}

/// Backwards-compatible save function targeting default Groq provider
pub fn set_api_key(key: &str) -> Result<(), KeyringError> {
    set_provider_key("groq", key)
}

/// Backwards-compatible retrieve function targeting default Groq provider
pub fn get_api_key() -> Result<Option<String>, KeyringError> {
    get_provider_key("groq")
}

/// Backwards-compatible delete function targeting default Groq provider
pub fn delete_api_key() -> Result<(), KeyringError> {
    delete_provider_key("groq")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_account_name() {
        assert_eq!(get_account_name("groq"), "groq_api_key");
        assert_eq!(get_account_name("GROQ"), "groq_api_key");
        assert_eq!(get_account_name("openrouter"), "openrouter_api_key");
        assert_eq!(get_account_name("OpenRouter"), "openrouter_api_key");
        assert_eq!(get_account_name("custom"), "custom_api_key");
        assert_eq!(get_account_name("other"), "other_api_key");
    }

    #[test]
    fn test_mask_key_empty() {
        assert_eq!(mask_key(""), "");
        assert_eq!(mask_key("   "), "");
    }

    #[test]
    fn test_mask_key_short() {
        assert_eq!(mask_key("short"), "••••••••");
        assert_eq!(mask_key("12345678901"), "••••••••"); // 11 chars
    }

    #[test]
    fn test_mask_key_twelve_chars() {
        assert_eq!(mask_key("123456789012"), "1234••••••••9012");
    }

    #[test]
    fn test_mask_key_typical_api_keys() {
        assert_eq!(
            mask_key("gsk_1234567890abcdef1234"),
            "gsk_••••••••1234"
        );
        assert_eq!(
            mask_key("sk-or-v1-abcdef1234567890abcdef4a2f"),
            "sk-o••••••••4a2f"
        );
    }
}
