use vt_voice_lib::ai::{
    DEFAULT_INITIAL_PROMPT, DEFAULT_POLISH_SYSTEM_PROMPT, LocalPolisher,
};

#[test]
fn test_default_prompts_contain_required_domain_terms() {
    let prompt = DEFAULT_INITIAL_PROMPT;
    assert!(prompt.to_lowercase().contains("commit"));
    assert!(prompt.contains("PR"));
    assert!(prompt.contains("deploy"));
    assert!(prompt.contains("API"));
    assert!(prompt.contains("Kubernetes"));
    assert!(prompt.contains("Docker"));

    let sys_prompt = DEFAULT_POLISH_SYSTEM_PROMPT;
    assert!(sys_prompt.contains("Vietnamese-English"));
    assert!(sys_prompt.contains("acronyms"));
}

#[test]
fn test_fallback_polisher_developer_speech() {
    let raw = "ừm push code lên staging để test api và kiểm tra memory leak rồi tạo pr nhé";
    let polished = LocalPolisher::polish(raw);

    assert!(polished.starts_with("Push code"));
    assert!(polished.contains("API"));
    assert!(polished.contains("PR"));
    assert!(!polished.to_lowercase().contains("ừm"));
    assert!(polished.ends_with('.'));
}

#[test]
fn test_fallback_polisher_preserves_vietnamese_diacritics() {
    let raw = "triển khai dịch vụ mới trên cụm k8s và đồng bộ database";
    let polished = LocalPolisher::polish(raw);

    assert!(polished.contains("Triển khai dịch vụ mới"));
    assert!(polished.contains("K8s"));
    assert!(polished.contains("đồng bộ database"));
}

#[test]
fn test_fallback_polisher_multiple_fillers() {
    let raw = "à kiểu như là thì là fix bug xong rồi";
    let polished = LocalPolisher::polish(raw);

    assert_eq!(polished, "Fix bug xong rồi.");
}

#[test]
fn test_fallback_polisher_punctuation_preservation() {
    let question = "anh đã merge pr chưa?";
    let polished = LocalPolisher::polish(question);
    assert_eq!(polished, "Anh đã merge PR chưa?");

    let exclaim = "hệ thống deploy thành công rồi!";
    let polished_exclaim = LocalPolisher::polish(exclaim);
    assert_eq!(polished_exclaim, "Hệ thống deploy thành công rồi!");
}
