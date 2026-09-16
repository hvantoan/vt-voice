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
        "translate" => "vt_voice_translate".to_string(),
        "groq" => "groq_api_key".to_string(),
        "openrouter" => "openrouter_api_key".to_string(),
        "custom" => "custom_api_key".to_string(),
        other => format!("{}_api_key", other),
    }
}

/// Masks an API key for safe UI presentation.
/// For keys with more than 6 characters: preserves first 3 and last 3 characters,
/// replacing the hidden characters with exactly that many asterisks ('*').
/// For keys with 6 or fewer characters: replaces all characters with asterisks.
pub fn mask_key(key: &str) -> String {
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
        assert_eq!(mask_key("abc"), "***");
        assert_eq!(mask_key("short"), "*****"); // 5 chars -> 5 asterisks
        assert_eq!(mask_key("123456"), "******"); // 6 chars -> 6 asterisks
    }

    #[test]
    fn test_mask_key_seven_chars() {
        assert_eq!(mask_key("1234567"), "123*567"); // 7 chars: 3 prefix, 1 hidden, 3 suffix
    }

    #[test]
    fn test_mask_key_nine_chars() {
        assert_eq!(mask_key("sk-123adb"), "sk-***adb"); // 9 chars: 3 prefix, 3 hidden, 3 suffix
    }

    #[test]
    fn test_mask_key_typical_api_keys() {
        assert_eq!(
            mask_key("sk-123456789adb"),
            "sk-*********adb" // 15 chars: 3 prefix, 9 asterisks, 3 suffix
        );
        assert_eq!(
            mask_key("gsk_1234567890abcdef1234"),
            "gsk******************234" // 24 chars: 3 prefix, 18 asterisks, 3 suffix
        );
        let key = "sk-or-v1-abcdef1234567890abcdef4a2f";
        assert_eq!(
            mask_key(key),
            format!("sk-{}a2f", "*".repeat(key.len() - 6))
        );
    }
}
