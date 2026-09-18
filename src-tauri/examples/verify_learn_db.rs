//! Kiểm tra hoạt động của module LearnDb với SQLite
#![allow(dead_code)]

#[path = "../src/storage/learn_db.rs"]
mod learn_db;

use learn_db::{LearnDb, NewAttempt, NewSentence, NewVocab};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!(">>> Bắt đầu kiểm tra LearnDb in-memory...");

    let db = LearnDb::init_in_memory()?;

    // 1. Thêm câu học
    let sentence = db.add_sentence(NewSentence {
        source_lang: "en".to_string(),
        target_lang: "vi".to_string(),
        source_text: "The quick brown fox jumps over the lazy dog.".to_string(),
        reference_translation: Some("Con cáo nâu nhanh nhẹn nhảy qua con chó lười biếng.".to_string()),
        difficulty_level: Some("B1".to_string()),
        category: Some("Daily".to_string()),
        origin: "overlay".to_string(),
    })?;

    println!("✓ Thêm câu học thành công: id={}", sentence.id);
    assert_eq!(sentence.source_text, "The quick brown fox jumps over the lazy dog.");

    // 1b. Tìm câu theo source và target
    let found = db.find_latest_by_source_and_target("The quick brown fox jumps over the lazy dog.", "vi")?;
    assert!(found.is_some());
    assert_eq!(found.unwrap().id, sentence.id);
    println!("✓ Tìm câu trùng khớp theo source và target thành công");

    let not_found = db.find_latest_by_source_and_target("The quick brown fox jumps over the lazy dog.", "ja")?;
    assert!(not_found.is_none());
    println!("✓ Không nhầm lẫn khi khác target language thành công");

    // 2. Danh sách câu học
    let sentences = db.list_sentences(10)?;
    assert_eq!(sentences.len(), 1);
    println!("✓ Lấy danh sách câu học thành công: count={}", sentences.len());
    // 3. Thêm lượt làm bài (attempt)
    let attempt = db.add_attempt(NewAttempt {
        sentence_id: Some(sentence.id.clone()),
        user_translation: "Con cáo nâu nhảy qua con chó lười.".to_string(),
        grammar_score: Some(85),
        feedback_text: "Dịch khá tốt, thiếu từ 'nhanh nhẹn' (quick).".to_string(),
        improved_version: Some("Con cáo nâu nhanh nhẹn nhảy qua con chó lười.".to_string()),
    })?;

    println!("✓ Thêm lượt làm bài thành công: id={}", attempt.id);
    assert_eq!(attempt.grammar_score, Some(85));

    let attempts = db.list_attempts(Some(&sentence.id), 10)?;
    assert_eq!(attempts.len(), 1);
    println!("✓ Lấy danh sách lượt làm bài thành công: count={}", attempts.len());

    // 4. Thêm từ vựng đã note
    let vocab = db.add_vocab(NewVocab {
        word_or_phrase: "lazy dog".to_string(),
        source_context: Some(sentence.source_text.clone()),
        translation: Some("con chó lười biếng".to_string()),
        notes: Some("Cụm danh từ".to_string()),
    })?;

    println!("✓ Thêm từ vựng thành công: id={}", vocab.id);
    assert_eq!(vocab.word_or_phrase, "lazy dog");

    let vocabs = db.list_vocab(Some(10))?;
    assert_eq!(vocabs.len(), 1);
    println!("✓ Lấy danh sách từ vựng thành công: count={}", vocabs.len());

    // 4b. Kiểm tra chống trùng lặp từ vựng (Dedup)
    let vocab_dup = db.add_vocab(NewVocab {
        word_or_phrase: "  LAZY DOG  ".to_string(), // case & space khác nhau
        source_context: Some("New context".to_string()),
        translation: Some("con chó rất lười".to_string()),
        notes: Some("Ghi chú mới".to_string()),
    })?;
    assert_eq!(vocab_dup.id, vocab.id);
    let vocabs_after_dup = db.list_vocab(Some(10))?;
    assert_eq!(vocabs_after_dup.len(), 1);
    assert_eq!(vocabs_after_dup[0].translation, Some("con chó rất lười".to_string()));
    println!("✓ Chống trùng lặp từ vựng và cập nhật bản ghi thành công");

    // 5. Xóa từ vựng
    let deleted_v = db.delete_vocab(&vocab.id)?;
    assert!(deleted_v);
    assert_eq!(db.list_vocab(Some(10))?.len(), 0);
    println!("✓ Xóa từ vựng thành công");

    // 6. Xóa câu học (cascade attempts)
    let deleted_s = db.delete_sentence(&sentence.id)?;
    assert!(deleted_s);
    assert_eq!(db.list_sentences(10)?.len(), 0);
    assert_eq!(db.list_attempts(Some(&sentence.id), 10)?.len(), 0);
    println!("✓ Xóa câu học và cascade xóa attempts thành công");

    println!(">>> TOÀN BỘ KIỂM TRA LEARNDB ĐÃ PASS 100%! <<<");
    Ok(())
}
