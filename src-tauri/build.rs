fn main() {
    #[cfg(target_os = "windows")]
    {
        let manifest_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("manifest.res");
        if manifest_path.exists() {
            println!("cargo:rustc-link-arg={}", manifest_path.display());
        }
    }

    tauri_build::build()
}
