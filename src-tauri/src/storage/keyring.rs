use keyring::Entry;

const SERVICE_NAME: &str = "vt-voice";
const USER_KEY: &str = "groq_api_key";

#[derive(Debug, thiserror::Error)]
pub enum KeyringError {
    #[error("Keyring operation error: {0}")]
    Keyring(#[from] keyring::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// Securely save the API key in the Windows Credential Vault
pub fn set_api_key(key: &str) -> Result<(), KeyringError> {
    let entry = Entry::new(SERVICE_NAME, USER_KEY)?;
    entry.set_password(key)?;
    Ok(())
}

/// Retrieve the stored API key from Windows Credential Vault
pub fn get_api_key() -> Result<Option<String>, KeyringError> {
    let entry = Entry::new(SERVICE_NAME, USER_KEY)?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(KeyringError::Keyring(e)),
    }
}

/// Delete the stored API key from Windows Credential Vault
pub fn delete_api_key() -> Result<(), KeyringError> {
    let entry = Entry::new(SERVICE_NAME, USER_KEY)?;
    match entry.delete_credential() {
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(KeyringError::Keyring(e)),
    }
}
