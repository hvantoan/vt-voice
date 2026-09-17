//! Kiểm chứng end-to-end cho lỗi `parse_error` khi dịch qua gateway mặc định SSE.
//!
//! Bối cảnh: gateway 9router (và các proxy tương thích OpenAI tương tự) trả
//! `Content-Type: text/event-stream` với body dạng `data: {...}\ndata: [DONE]`
//! khi request KHÔNG khai báo `Accept: application/json`. `res.json()` của reqwest
//! khi đó thất bại -> `AiError::ParseError` -> log `error_kind=parse_error`.
//!
//! Probe dùng CHÍNH các module production (`src/ai/*`) thay vì viết lại request,
//! vì mọi binary link `vt_voice_lib` đều abort khi nạp với
//! `0xc0000139 (STATUS_ENTRYPOINT_NOT_FOUND)` trên toolchain này (xem AGENTS.md).
//!
//! Chạy: `cargo run --example verify_translate_negotiation`
//! Bỏ qua (exit 0) nếu vault không có key cho provider 9router.
//!
//! Lưu ý khi đọc kết quả: `translate_chat_with_lang` FAIL kèm `output_len` lớn bất thường
//! KHÔNG phải hồi quy của bản vá Accept. Đó là lỗi #2 đã điều tra: gateway 9router chèn
//! sẵn prefix ~2400 token phía server với `ol/gemma4:31b`, khiến model trả văn bản lạ.
//! Bản vá Accept vẫn đúng khi `polish_with_endpoint` (cùng endpoint) PASS.

#![allow(dead_code)]

/// Stub tối thiểu cho `crate::storage::get_provider` mà `ai/provider.rs` tham chiếu.
/// Hai nhánh dùng tới nó (`transcribe_with_provider`, `test_provider_connection`)
/// không được gọi trong probe này.
mod storage {
    pub struct ProviderInfo {
        pub base_url: String,
    }
    pub fn get_provider(_id: &str) -> Option<ProviderInfo> {
        None
    }
}

#[path = "../src/ai/mod.rs"]
mod ai;

#[path = "../src/storage/keyring.rs"]
mod keyring_store;

use std::time::Duration;

use ai::AiError;

const PROVIDER_ID: &str = "9router";
const BASE_URL: &str = "https://9router.hvantoan.xyz/v1";
const MODEL: &str = "ol/gemma4:31b";

/// 16 ký tự, khớp `input_len=16` trong log lỗi gốc.
const INPUT: &str = "Hello world test";

#[tokio::main]
async fn main() {
    let key = match keyring_store::get_provider_key(PROVIDER_ID) {
        Ok(Some(k)) => k,
        Ok(None) => {
            println!("SKIP: vault không có key cho provider {PROVIDER_ID}");
            return;
        }
        Err(e) => {
            println!("SKIP: không đọc được vault: {e}");
            return;
        }
    };

    // 8s mặc định của app quá sát ngưỡng phản hồi của gateway (~4.3s trong log lỗi).
    let http = ai::AiHttpClient::with_timeout(Duration::from_secs(60));
    let mut failed = 0u32;

    // Assertion "dịch hợp lý": bám theo input. Nếu chỉ in output_len thì gateway trả
    // ~2000 ký tự văn bản lạ (lỗi #2) vẫn báo PASS — đúng thứ cần phát hiện.
    let plausible = |text: &str| !text.is_empty() && text.len() <= INPUT.len() * 3;

    // Hợp đồng của probe này là THƯƠNG LƯỢNG NỘI DUNG (Accept -> JSON, không phải SSE).
    // `AiError::ParseError` = hồi quy của bản vá -> FAIL.
    // Nội dung lạ dài bất thường = lỗi #2 phía gateway -> WARN, không tính là thất bại.
    let translated = ai::translate_chat_with_lang(&http, Some(BASE_URL), &key, MODEL, INPUT, "vi").await;
    match translated {
        Ok(text) if plausible(&text) => println!(
            "PASS translate_chat_with_lang: output_len={} preview={:?}",
            text.len(),
            text.chars().take(60).collect::<String>()
        ),
        Ok(text) => println!(
            "WARN translate_chat_with_lang: JSON đọc được (hợp đồng OK) nhưng output_len={} không bám input \
             -> lỗi #2 phía gateway, không phải hồi quy Accept",
            text.len()
        ),
        Err(AiError::ParseError(e)) => {
            failed += 1;
            println!("FAIL translate_chat_with_lang: hồi quy parse_error -> {e}");
        }
        Err(e) => {
            failed += 1;
            println!("FAIL translate_chat_with_lang: {e}");
        }
    }

    // Cùng client, cùng endpoint -> chứng minh bản vá ở tầng client phủ cả polish,
    // vốn dùng chung endpoint /chat/completions qua `polish_with_endpoint`.
    let polished = ai::polish_with_endpoint(&http, BASE_URL, &key, MODEL, INPUT, None).await;
    match polished {
        Ok(text) if plausible(&text) => println!(
            "PASS polish_with_endpoint: output_len={} preview={:?}",
            text.len(),
            text.chars().take(60).collect::<String>()
        ),
        Ok(text) => println!(
            "WARN polish_with_endpoint: JSON đọc được (hợp đồng OK) nhưng output_len={} không bám input \
             -> lỗi #2 phía gateway",
            text.len()
        ),
        Err(AiError::ParseError(e)) => {
            failed += 1;
            println!("FAIL polish_with_endpoint: hồi quy parse_error -> {e}");
        }
        Err(e) => {
            failed += 1;
            println!("FAIL polish_with_endpoint: {e}");
        }
    }

    if failed > 0 {
        eprintln!("{failed} kiểm chứng THẤT BẠI");
        std::process::exit(1);
    }
    println!("Tất cả kiểm chứng PASS");

    // Hồi quy: Accept mặc định phải vô hại với provider trả JSON chuẩn (openrouter
    // đang là provider active cho polish/stt trong settings.json).
    match keyring_store::get_provider_key("openrouter") {
        Ok(Some(orkey)) => {
            match ai::polish_with_endpoint(
                &http,
                "https://openrouter.ai/api/v1",
                &orkey,
                "openai/gpt-4o-mini",
                INPUT,
                None,
            )
            .await
            {
                Ok(text) => println!(
                    "PASS openrouter regression: output_len={} text={:?}",
                    text.len(),
                    text
                ),
                Err(e) => {
                    eprintln!("FAIL openrouter regression: {e}");
                    std::process::exit(1);
                }
            }
        }
        _ => println!("SKIP openrouter regression: vault không có key"),
    }
}
