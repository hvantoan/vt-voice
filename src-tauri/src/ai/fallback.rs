use regex::Regex;

/// Local heuristic text polisher used as fallback when LLM is unavailable or times out
pub struct LocalPolisher;

impl LocalPolisher {
    /// Clean filler words, capitalize first letter, uppercase known technical acronyms, and format punctuation
    pub fn polish(raw: &str) -> String {
        let text = raw.trim();
        if text.is_empty() {
            return String::new();
        }

        // 1. Remove spoken filler phrases (case-insensitive)
        let fillers = [
            r"(?i)\bkiểu như là\b",
            r"(?i)\bkiểu như\b",
            r"(?i)\bnhư kiểu\b",
            r"(?i)\bnhư là\b",
            r"(?i)\bthì là\b",
            r"(?i)\bấy là\b",
            r"(?i)\bừm\b",
            r"(?i)\bà\b",
            r"(?i)\bờ\b",
        ];

        let mut cleaned = text.to_string();
        for filler in &fillers {
            if let Ok(re) = Regex::new(filler) {
                cleaned = re.replace_all(&cleaned, "").to_string();
            }
        }

        // Collapse multiple spaces into single space
        if let Ok(space_re) = Regex::new(r"\s+") {
            cleaned = space_re.replace_all(&cleaned, " ").to_string();
        }
        let mut cleaned = cleaned.trim().to_string();
        if cleaned.is_empty() {
            return String::new();
        }

        // 2. Auto-capitalize common technical acronyms
        let acronyms = [
            (r"(?i)\bapi\b", "API"),
            (r"(?i)\bpr\b", "PR"),
            (r"(?i)\bci/cd\b", "CI/CD"),
            (r"(?i)\bsql\b", "SQL"),
            (r"(?i)\bk8s\b", "K8s"),
            (r"(?i)\baws\b", "AWS"),
            (r"(?i)\burl\b", "URL"),
            (r"(?i)\bhttp\b", "HTTP"),
            (r"(?i)\bhttps\b", "HTTPS"),
            (r"(?i)\bjson\b", "JSON"),
            (r"(?i)\bui\b", "UI"),
            (r"(?i)\bux\b", "UX"),
            (r"(?i)\bsdk\b", "SDK"),
            (r"(?i)\bcli\b", "CLI"),
            (r"(?i)\bcpu\b", "CPU"),
            (r"(?i)\bram\b", "RAM"),
            (r"(?i)\bgithub\b", "GitHub"),
            (r"(?i)\bgitlab\b", "GitLab"),
            (r"(?i)\bdocker\b", "Docker"),
            (r"(?i)\bredis\b", "Redis"),
            (r"(?i)\bgraphql\b", "GraphQL"),
            (r"(?i)\brest\b", "REST"),
        ];

        for (pattern, replacement) in &acronyms {
            if let Ok(re) = Regex::new(pattern) {
                cleaned = re.replace_all(&cleaned, *replacement).to_string();
            }
        }

        // 3. Capitalize first character
        let mut chars = cleaned.chars();
        let first = match chars.next() {
            Some(c) => c.to_uppercase().collect::<String>(),
            None => String::new(),
        };
        let mut result = first + chars.as_str();

        // 4. Ensure trailing punctuation if missing
        if !result.is_empty() && !result.ends_with('.') && !result.ends_with('?') && !result.ends_with('!') {
            result.push('.');
        }

        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_local_polisher_empty() {
        assert_eq!(LocalPolisher::polish(""), "");
        assert_eq!(LocalPolisher::polish("   "), "");
    }

    #[test]
    fn test_local_polisher_strips_fillers() {
        let input = "ừm deploy lên staging cho anh thì là fix bug";
        let output = LocalPolisher::polish(input);
        assert_eq!(output, "Deploy lên staging cho anh fix bug.");
    }

    #[test]
    fn test_local_polisher_capitalizes_acronyms() {
        let input = "tạo một pr mới để cập nhật api và đẩy lên k8s";
        let output = LocalPolisher::polish(input);
        assert_eq!(output, "Tạo một PR mới để cập nhật API và đẩy lên K8s.");
    }

    #[test]
    fn test_local_polisher_preserves_punctuation() {
        let input = "hệ thống đã chạy chưa?";
        let output = LocalPolisher::polish(input);
        assert_eq!(output, "Hệ thống đã chạy chưa?");
    }
}
