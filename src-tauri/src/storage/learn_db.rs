use std::path::Path;
use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, thiserror::Error)]
pub enum LearnDbError {
    #[error("Database error: {0}")]
    Sqlite(#[from] rusqlite::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Entity not found: {0}")]
    NotFound(String),
}

/// Xếp hạng độ giàu thông tin của chuỗi notes để quyết định merge khi upsert.
/// 3 = JSON do AI làm giàu (source="ai"), 2 = ghi chú thuần/legacy có nội dung,
/// 1 = JSON fallback thưa (source="fallback"), 0 = rỗng/không parse được.
/// Mục tiêu: bản ghi thưa không bao giờ ghi đè bản ghi giàu thông tin hơn.
fn notes_rank(notes: &str) -> u8 {
    let trimmed = notes.trim();
    if trimmed.is_empty() {
        return 0;
    }
    match serde_json::from_str::<serde_json::Value>(trimmed) {
        Ok(v) if v.is_object() => {
            match v.get("source").and_then(|s| s.as_str()) {
                Some("ai") => 3,
                Some("fallback") => 1,
                // JSON cấu trúc không rõ nguồn: coi như ghi chú thuần.
                _ => 2,
            }
        }
        _ => 2,
    }
}

pub use crate::ai::learn::TargetVocabItem;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudySentence {
    pub id: String,
    pub source_lang: String,
    pub target_lang: String,
    pub source_text: String,
    pub reference_translation: Option<String>,
    pub difficulty_level: Option<String>,
    pub category: Option<String>,
    pub origin: String,
    pub created_at: i64,
    pub acceptable_alternatives: Option<Vec<String>>,
    pub target_vocab: Option<Vec<TargetVocabItem>>,
    pub grammar_focus: Option<String>,
    pub common_mistakes: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewSentence {
    pub source_lang: String,
    pub target_lang: String,
    pub source_text: String,
    pub reference_translation: Option<String>,
    pub difficulty_level: Option<String>,
    pub category: Option<String>,
    pub origin: String,
    pub acceptable_alternatives: Option<Vec<String>>,
    pub target_vocab: Option<Vec<TargetVocabItem>>,
    pub grammar_focus: Option<String>,
    pub common_mistakes: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudyAttempt {
    pub id: String,
    pub sentence_id: Option<String>,
    pub user_translation: String,
    pub grammar_score: Option<i32>,
    pub feedback_text: String,
    pub improved_version: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewAttempt {
    pub sentence_id: Option<String>,
    pub user_translation: String,
    pub grammar_score: Option<i32>,
    pub feedback_text: String,
    pub improved_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedVocab {
    pub id: String,
    pub word_or_phrase: String,
    pub source_context: Option<String>,
    pub translation: Option<String>,
    pub notes: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewVocab {
    pub word_or_phrase: String,
    pub source_context: Option<String>,
    pub translation: Option<String>,
    pub notes: Option<String>,
}

pub struct LearnDb {
    conn: Connection,
}

impl LearnDb {
    pub fn init(db_path: &Path) -> Result<Self, LearnDbError> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(db_path)?;
        let db = Self { conn };
        db.run_migrations()?;
        let _ = db.seed_starter_pack_if_empty();
        Ok(db)
    }

    pub fn init_in_memory() -> Result<Self, LearnDbError> {
        let conn = Connection::open_in_memory()?;
        let db = Self { conn };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&self) -> Result<(), LearnDbError> {
        self.conn.execute_batch(
            "PRAGMA foreign_keys = ON;
             PRAGMA journal_mode = WAL;
             PRAGMA busy_timeout = 5000;
             CREATE TABLE IF NOT EXISTS study_sentences (
                 id TEXT PRIMARY KEY,
                 source_lang TEXT NOT NULL,
                 target_lang TEXT NOT NULL,
                 source_text TEXT NOT NULL,
                 reference_translation TEXT,
                 difficulty_level TEXT,
                 category TEXT,
                 origin TEXT NOT NULL,
                 created_at INTEGER NOT NULL
             );

             CREATE TABLE IF NOT EXISTS study_attempts (
                 id TEXT PRIMARY KEY,
                 sentence_id TEXT,
                 user_translation TEXT NOT NULL,
                 grammar_score INTEGER,
                 feedback_text TEXT NOT NULL,
                 improved_version TEXT,
                 created_at INTEGER NOT NULL,
                 FOREIGN KEY(sentence_id) REFERENCES study_sentences(id) ON DELETE CASCADE
             );

             CREATE TABLE IF NOT EXISTS saved_vocab (
                 id TEXT PRIMARY KEY,
                 word_or_phrase TEXT NOT NULL,
                 source_context TEXT,
                 translation TEXT,
                 notes TEXT,
                 created_at INTEGER NOT NULL
             );

             CREATE INDEX IF NOT EXISTS idx_sentences_created ON study_sentences(created_at DESC);
             CREATE INDEX IF NOT EXISTS idx_attempts_sentence ON study_attempts(sentence_id);
             CREATE INDEX IF NOT EXISTS idx_attempts_created ON study_attempts(created_at DESC);
             CREATE INDEX IF NOT EXISTS idx_vocab_created ON saved_vocab(created_at DESC);",
        )?;

        // Migration: Thêm các cột cho Gói bài tập tự trị nếu chưa tồn tại
        let mut stmt = self.conn.prepare("PRAGMA table_info(study_sentences)")?;
        let existing_columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))?
            .filter_map(|r| r.ok())
            .collect();

        if !existing_columns.iter().any(|c| c == "acceptable_alternatives") {
            let _ = self.conn.execute("ALTER TABLE study_sentences ADD COLUMN acceptable_alternatives TEXT", []);
        }
        if !existing_columns.iter().any(|c| c == "target_vocab") {
            let _ = self.conn.execute("ALTER TABLE study_sentences ADD COLUMN target_vocab TEXT", []);
        }
        if !existing_columns.iter().any(|c| c == "grammar_focus") {
            let _ = self.conn.execute("ALTER TABLE study_sentences ADD COLUMN grammar_focus TEXT", []);
        }
        if !existing_columns.iter().any(|c| c == "common_mistakes") {
            let _ = self.conn.execute("ALTER TABLE study_sentences ADD COLUMN common_mistakes TEXT", []);
        }

        Ok(())
    }

    pub fn add_sentence(&self, sentence: NewSentence) -> Result<StudySentence, LearnDbError> {
        let id = Uuid::new_v4().to_string();
        let created_at = Utc::now().timestamp_millis();

        let acceptable_alternatives_json = sentence
            .acceptable_alternatives
            .as_ref()
            .and_then(|v| serde_json::to_string(v).ok());
        let target_vocab_json = sentence
            .target_vocab
            .as_ref()
            .and_then(|v| serde_json::to_string(v).ok());
        let common_mistakes_json = sentence
            .common_mistakes
            .as_ref()
            .and_then(|v| serde_json::to_string(v).ok());

        self.conn.execute(
            "INSERT INTO study_sentences (
                id, source_lang, target_lang, source_text, reference_translation,
                difficulty_level, category, origin, created_at,
                acceptable_alternatives, target_vocab, grammar_focus, common_mistakes
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                id,
                sentence.source_lang,
                sentence.target_lang,
                sentence.source_text,
                sentence.reference_translation,
                sentence.difficulty_level,
                sentence.category,
                sentence.origin,
                created_at,
                acceptable_alternatives_json,
                target_vocab_json,
                sentence.grammar_focus,
                common_mistakes_json,
            ],
        )?;

        Ok(StudySentence {
            id,
            source_lang: sentence.source_lang,
            target_lang: sentence.target_lang,
            source_text: sentence.source_text,
            reference_translation: sentence.reference_translation,
            difficulty_level: sentence.difficulty_level,
            category: sentence.category,
            origin: sentence.origin,
            created_at,
            acceptable_alternatives: sentence.acceptable_alternatives,
            target_vocab: sentence.target_vocab,
            grammar_focus: sentence.grammar_focus,
            common_mistakes: sentence.common_mistakes,
        })
    }

    pub fn list_sentences(&self, limit: usize) -> Result<Vec<StudySentence>, LearnDbError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, source_lang, target_lang, source_text, reference_translation,
                    difficulty_level, category, origin, created_at,
                    acceptable_alternatives, target_vocab, grammar_focus, common_mistakes
             FROM study_sentences
             ORDER BY created_at DESC
             LIMIT ?1",
        )?;

        let rows = stmt.query_map(params![limit as i64], |row| {
            let alt_str: Option<String> = row.get(9)?;
            let vocab_str: Option<String> = row.get(10)?;
            let mistakes_str: Option<String> = row.get(12)?;

            Ok(StudySentence {
                id: row.get(0)?,
                source_lang: row.get(1)?,
                target_lang: row.get(2)?,
                source_text: row.get(3)?,
                reference_translation: row.get(4)?,
                difficulty_level: row.get(5)?,
                category: row.get(6)?,
                origin: row.get(7)?,
                created_at: row.get(8)?,
                acceptable_alternatives: alt_str.and_then(|s| serde_json::from_str(&s).ok()),
                target_vocab: vocab_str.and_then(|s| serde_json::from_str(&s).ok()),
                grammar_focus: row.get(11)?,
                common_mistakes: mistakes_str.and_then(|s| serde_json::from_str(&s).ok()),
            })
        })?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(result)
    }

    pub fn get_sentence(&self, id: &str) -> Result<Option<StudySentence>, LearnDbError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, source_lang, target_lang, source_text, reference_translation,
                    difficulty_level, category, origin, created_at,
                    acceptable_alternatives, target_vocab, grammar_focus, common_mistakes
             FROM study_sentences
             WHERE id = ?1",
        )?;

        let mut rows = stmt.query_map(params![id], |row| {
            let alt_str: Option<String> = row.get(9)?;
            let vocab_str: Option<String> = row.get(10)?;
            let mistakes_str: Option<String> = row.get(12)?;

            Ok(StudySentence {
                id: row.get(0)?,
                source_lang: row.get(1)?,
                target_lang: row.get(2)?,
                source_text: row.get(3)?,
                reference_translation: row.get(4)?,
                difficulty_level: row.get(5)?,
                category: row.get(6)?,
                origin: row.get(7)?,
                created_at: row.get(8)?,
                acceptable_alternatives: alt_str.and_then(|s| serde_json::from_str(&s).ok()),
                target_vocab: vocab_str.and_then(|s| serde_json::from_str(&s).ok()),
                grammar_focus: row.get(11)?,
                common_mistakes: mistakes_str.and_then(|s| serde_json::from_str(&s).ok()),
            })
        })?;

        if let Some(row) = rows.next() {
            Ok(Some(row?))
        } else {
            Ok(None)
        }
    }

    pub fn find_latest_by_source_and_target(
        &self,
        text: &str,
        target_lang: &str,
    ) -> Result<Option<StudySentence>, LearnDbError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, source_lang, target_lang, source_text, reference_translation,
                    difficulty_level, category, origin, created_at,
                    acceptable_alternatives, target_vocab, grammar_focus, common_mistakes
             FROM study_sentences
             WHERE source_text = ?1 AND target_lang = ?2
             ORDER BY created_at DESC
             LIMIT 1",
        )?;

        let mut rows = stmt.query_map(params![text, target_lang], |row| {
            let alt_str: Option<String> = row.get(9)?;
            let vocab_str: Option<String> = row.get(10)?;
            let mistakes_str: Option<String> = row.get(12)?;

            Ok(StudySentence {
                id: row.get(0)?,
                source_lang: row.get(1)?,
                target_lang: row.get(2)?,
                source_text: row.get(3)?,
                reference_translation: row.get(4)?,
                difficulty_level: row.get(5)?,
                category: row.get(6)?,
                origin: row.get(7)?,
                created_at: row.get(8)?,
                acceptable_alternatives: alt_str.and_then(|s| serde_json::from_str(&s).ok()),
                target_vocab: vocab_str.and_then(|s| serde_json::from_str(&s).ok()),
                grammar_focus: row.get(11)?,
                common_mistakes: mistakes_str.and_then(|s| serde_json::from_str(&s).ok()),
            })
        })?;

        if let Some(row) = rows.next() {
            Ok(Some(row?))
        } else {
            Ok(None)
        }
    }

    pub fn delete_sentence(&self, id: &str) -> Result<bool, LearnDbError> {
        // Xóa các bài tập liên quan để đảm bảo không còn orphan records
        let _ = self.conn.execute(
            "DELETE FROM study_attempts WHERE sentence_id = ?1",
            params![id],
        );
        let affected = self.conn.execute(
            "DELETE FROM study_sentences WHERE id = ?1",
            params![id],
        )?;
        Ok(affected > 0)
    }

    pub fn count_sentences(&self) -> Result<i64, LearnDbError> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM study_sentences",
            [],
            |row| row.get(0),
        )?;
        Ok(count)
    }

    pub fn seed_starter_pack_if_empty(&self) -> Result<usize, LearnDbError> {
        if self.count_sentences()? == 0 {
            self.seed_starter_pack()
        } else {
            Ok(0)
        }
    }

    pub fn seed_starter_pack(&self) -> Result<usize, LearnDbError> {
        let starter_sentences = vec![
            NewSentence {
                source_lang: "vi".to_string(),
                target_lang: "en".to_string(),
                source_text: "Họ đã hoãn cuộc họp cho đến thứ Sáu tuần sau.".to_string(),
                reference_translation: Some("They postponed the meeting until next Friday.".to_string()),
                difficulty_level: Some("intermediate".to_string()),
                category: Some("work".to_string()),
                origin: "starter_pack".to_string(),
                acceptable_alternatives: Some(vec![
                    "They delayed the meeting until next Friday.".to_string(),
                    "They put off the meeting until next Friday.".to_string(),
                ]),
                target_vocab: Some(vec![
                    TargetVocabItem {
                        word: "postpone".to_string(),
                        word_type: Some("verb".to_string()),
                        meaning: "hoãn lại, trì hoãn".to_string(),
                    },
                    TargetVocabItem {
                        word: "meeting".to_string(),
                        word_type: Some("noun".to_string()),
                        meaning: "cuộc họp".to_string(),
                    },
                ]),
                grammar_focus: Some("Thì quá khứ đơn (Past Simple); chú ý dùng giới từ 'until' cho mốc thời gian.".to_string()),
                common_mistakes: Some(vec![
                    "Dùng nhầm giới từ 'to' thay vì 'until'".to_string(),
                    "Quên chia quá khứ 'postponed'".to_string(),
                ]),
            },
            NewSentence {
                source_lang: "vi".to_string(),
                target_lang: "en".to_string(),
                source_text: "Tôi thường uống một tách cà phê vào mỗi buổi sáng.".to_string(),
                reference_translation: Some("I usually drink a cup of coffee every morning.".to_string()),
                difficulty_level: Some("beginner".to_string()),
                category: Some("daily".to_string()),
                origin: "starter_pack".to_string(),
                acceptable_alternatives: Some(vec![
                    "I usually have a cup of coffee every morning.".to_string(),
                    "I typically drink a cup of coffee each morning.".to_string(),
                ]),
                target_vocab: Some(vec![
                    TargetVocabItem {
                        word: "usually".to_string(),
                        word_type: Some("adverb".to_string()),
                        meaning: "thường xuyên".to_string(),
                    },
                    TargetVocabItem {
                        word: "coffee".to_string(),
                        word_type: Some("noun".to_string()),
                        meaning: "cà phê".to_string(),
                    },
                ]),
                grammar_focus: Some("Thì hiện tại đơn diễn tả thói quen; trạng từ chỉ tần suất 'usually' đứng trước động từ thường.".to_string()),
                common_mistakes: Some(vec![
                    "Đặt 'usually' ở cuối câu".to_string(),
                    "Quên mạo từ 'a' trước 'cup of coffee'".to_string(),
                ]),
            },
            NewSentence {
                source_lang: "vi".to_string(),
                target_lang: "en".to_string(),
                source_text: "Thời tiết hôm nay thật đẹp và dễ chịu.".to_string(),
                reference_translation: Some("The weather today is very nice and pleasant.".to_string()),
                difficulty_level: Some("beginner".to_string()),
                category: Some("daily".to_string()),
                origin: "starter_pack".to_string(),
                acceptable_alternatives: Some(vec![
                    "The weather is really nice and pleasant today.".to_string(),
                    "Today's weather is very beautiful and pleasant.".to_string(),
                ]),
                target_vocab: Some(vec![
                    TargetVocabItem {
                        word: "pleasant".to_string(),
                        word_type: Some("adjective".to_string()),
                        meaning: "dễ chịu, thoải mái".to_string(),
                    },
                    TargetVocabItem {
                        word: "weather".to_string(),
                        word_type: Some("noun".to_string()),
                        meaning: "thời tiết".to_string(),
                    },
                ]),
                grammar_focus: Some("Tính từ miêu tả sau động từ to be.".to_string()),
                common_mistakes: Some(vec![
                    "Viết sai chính tả 'pleasant'".to_string(),
                    "Dùng nhầm danh từ thay vì tính từ".to_string(),
                ]),
            },
            NewSentence {
                source_lang: "vi".to_string(),
                target_lang: "en".to_string(),
                source_text: "Bạn có thể chỉ cho tôi đường đến nhà ga gần nhất không?".to_string(),
                reference_translation: Some("Could you show me the way to the nearest train station?".to_string()),
                difficulty_level: Some("beginner".to_string()),
                category: Some("travel".to_string()),
                origin: "starter_pack".to_string(),
                acceptable_alternatives: Some(vec![
                    "Can you tell me the way to the nearest station?".to_string(),
                    "Could you tell me how to get to the nearest train station?".to_string(),
                ]),
                target_vocab: Some(vec![
                    TargetVocabItem {
                        word: "nearest".to_string(),
                        word_type: Some("adjective".to_string()),
                        meaning: "gần nhất (so sánh hơn nhất)".to_string(),
                    },
                    TargetVocabItem {
                        word: "station".to_string(),
                        word_type: Some("noun".to_string()),
                        meaning: "nhà ga".to_string(),
                    },
                ]),
                grammar_focus: Some("Câu hỏi yêu cầu lịch sự với 'Could you...'; so sánh hơn nhất 'the nearest'.".to_string()),
                common_mistakes: Some(vec![
                    "Quên mạo từ 'the' trước 'nearest'".to_string(),
                    "Dùng 'near' thay vì 'nearest'".to_string(),
                ]),
            },
            NewSentence {
                source_lang: "vi".to_string(),
                target_lang: "en".to_string(),
                source_text: "Nếu ngày mai trời mưa, chúng tôi sẽ hủy chuyến dã ngoại.".to_string(),
                reference_translation: Some("If it rains tomorrow, we will cancel the picnic.".to_string()),
                difficulty_level: Some("intermediate".to_string()),
                category: Some("daily".to_string()),
                origin: "starter_pack".to_string(),
                acceptable_alternatives: Some(vec![
                    "If it rains tomorrow, we'll call off the picnic.".to_string(),
                    "We will cancel the picnic if it rains tomorrow.".to_string(),
                ]),
                target_vocab: Some(vec![
                    TargetVocabItem {
                        word: "cancel".to_string(),
                        word_type: Some("verb".to_string()),
                        meaning: "hủy bỏ".to_string(),
                    },
                    TargetVocabItem {
                        word: "picnic".to_string(),
                        word_type: Some("noun".to_string()),
                        meaning: "chuyến dã ngoại".to_string(),
                    },
                ]),
                grammar_focus: Some("Câu điều kiện loại 1 (First Conditional): Mệnh đề If dùng hiện tại đơn, mệnh đề chính dùng will + V.".to_string()),
                common_mistakes: Some(vec![
                    "Dùng 'will rain' trong mệnh đề If".to_string(),
                    "Quên chia ngôi thứ 3 số ít 'rains'".to_string(),
                ]),
            },
            NewSentence {
                source_lang: "vi".to_string(),
                target_lang: "en".to_string(),
                source_text: "Cô ấy đã sống ở thành phố này được hơn năm năm.".to_string(),
                reference_translation: Some("She has lived in this city for more than five years.".to_string()),
                difficulty_level: Some("intermediate".to_string()),
                category: Some("daily".to_string()),
                origin: "starter_pack".to_string(),
                acceptable_alternatives: Some(vec![
                    "She has been living in this city for over five years.".to_string(),
                    "She's lived in this city for more than 5 years.".to_string(),
                ]),
                target_vocab: Some(vec![
                    TargetVocabItem {
                        word: "live".to_string(),
                        word_type: Some("verb".to_string()),
                        meaning: "sống, sinh sống".to_string(),
                    },
                    TargetVocabItem {
                        word: "more than".to_string(),
                        word_type: Some("phrase".to_string()),
                        meaning: "hơn, nhiều hơn".to_string(),
                    },
                ]),
                grammar_focus: Some("Thì hiện tại hoàn thành (Present Perfect) với 'for + khoảng thời gian'.".to_string()),
                common_mistakes: Some(vec![
                    "Dùng thì quá khứ đơn 'She lived' thay vì hiện tại hoàn thành".to_string(),
                    "Dùng nhầm 'since' thay vì 'for'".to_string(),
                ]),
            },
            NewSentence {
                source_lang: "vi".to_string(),
                target_lang: "en".to_string(),
                source_text: "Dự án này đòi hỏi sự tập trung cao độ và tính kiên nhẫn.".to_string(),
                reference_translation: Some("This project requires high concentration and patience.".to_string()),
                difficulty_level: Some("intermediate".to_string()),
                category: Some("work".to_string()),
                origin: "starter_pack".to_string(),
                acceptable_alternatives: Some(vec![
                    "This project demands great focus and patience.".to_string(),
                    "This project requires great concentration and patience.".to_string(),
                ]),
                target_vocab: Some(vec![
                    TargetVocabItem {
                        word: "concentration".to_string(),
                        word_type: Some("noun".to_string()),
                        meaning: "sự tập trung".to_string(),
                    },
                    TargetVocabItem {
                        word: "patience".to_string(),
                        word_type: Some("noun".to_string()),
                        meaning: "tính kiên nhẫn".to_string(),
                    },
                ]),
                grammar_focus: Some("Danh từ không đếm được; hòa hợp chủ ngữ số ít và động từ 'requires'.".to_string()),
                common_mistakes: Some(vec![
                    "Dùng tính từ 'patient' thay vì danh từ 'patience'".to_string(),
                    "Quên 's' ở động từ 'requires'".to_string(),
                ]),
            },
            NewSentence {
                source_lang: "vi".to_string(),
                target_lang: "en".to_string(),
                source_text: "Trí tuệ nhân tạo đang làm thay đổi căn bản cách chúng ta làm việc.".to_string(),
                reference_translation: Some("Artificial intelligence is fundamentally changing the way we work.".to_string()),
                difficulty_level: Some("intermediate".to_string()),
                category: Some("technology".to_string()),
                origin: "starter_pack".to_string(),
                acceptable_alternatives: Some(vec![
                    "AI is fundamentally transforming how we work.".to_string(),
                    "Artificial intelligence is fundamentally changing how we work.".to_string(),
                ]),
                target_vocab: Some(vec![
                    TargetVocabItem {
                        word: "artificial intelligence".to_string(),
                        word_type: Some("noun".to_string()),
                        meaning: "trí tuệ nhân tạo".to_string(),
                    },
                    TargetVocabItem {
                        word: "fundamentally".to_string(),
                        word_type: Some("adverb".to_string()),
                        meaning: "về cơ bản, căn bản".to_string(),
                    },
                ]),
                grammar_focus: Some("Thì hiện tại tiếp diễn miêu tả xu hướng thay đổi; trạng từ bổ nghĩa cho động từ.".to_string()),
                common_mistakes: Some(vec![
                    "Dùng tính từ 'fundamental' thay cho trạng từ 'fundamentally'".to_string(),
                    "Viết sai chính tả 'intelligence'".to_string(),
                ]),
            },
            NewSentence {
                source_lang: "vi".to_string(),
                target_lang: "en".to_string(),
                source_text: "Bất chấp những khó khăn ban đầu, đội ngũ đã hoàn thành xuất sắc mục tiêu.".to_string(),
                reference_translation: Some("Despite the initial difficulties, the team successfully achieved their goal.".to_string()),
                difficulty_level: Some("advanced".to_string()),
                category: Some("work".to_string()),
                origin: "starter_pack".to_string(),
                acceptable_alternatives: Some(vec![
                    "In spite of initial difficulties, the team accomplished their goal successfully.".to_string(),
                    "Despite initial challenges, the team successfully accomplished its goal.".to_string(),
                ]),
                target_vocab: Some(vec![
                    TargetVocabItem {
                        word: "despite".to_string(),
                        word_type: Some("preposition".to_string()),
                        meaning: "mặc dù, bất chấp".to_string(),
                    },
                    TargetVocabItem {
                        word: "initial".to_string(),
                        word_type: Some("adjective".to_string()),
                        meaning: "ban đầu".to_string(),
                    },
                    TargetVocabItem {
                        word: "achieve".to_string(),
                        word_type: Some("verb".to_string()),
                        meaning: "đạt được, hoàn thành".to_string(),
                    },
                ]),
                grammar_focus: Some("'Despite / In spite of' đi kèm với danh từ hoặc cụm danh từ, không đi với mệnh đề.".to_string()),
                common_mistakes: Some(vec![
                    "Dùng 'Despite of' (sai ngữ pháp)".to_string(),
                    "Dùng 'Although' kèm cụm danh từ".to_string(),
                ]),
            },
            NewSentence {
                source_lang: "vi".to_string(),
                target_lang: "en".to_string(),
                source_text: "Bạn nên đọc kỹ hướng dẫn trước khi sử dụng thiết bị này.".to_string(),
                reference_translation: Some("You should read the instructions carefully before using this device.".to_string()),
                difficulty_level: Some("beginner".to_string()),
                category: Some("technology".to_string()),
                origin: "starter_pack".to_string(),
                acceptable_alternatives: Some(vec![
                    "You ought to read the instructions carefully before using this device.".to_string(),
                    "You should carefully read the manual before using this equipment.".to_string(),
                ]),
                target_vocab: Some(vec![
                    TargetVocabItem {
                        word: "instructions".to_string(),
                        word_type: Some("noun".to_string()),
                        meaning: "hướng dẫn sử dụng".to_string(),
                    },
                    TargetVocabItem {
                        word: "device".to_string(),
                        word_type: Some("noun".to_string()),
                        meaning: "thiết bị".to_string(),
                    },
                ]),
                grammar_focus: Some("Động từ khuyết thiếu 'should + V'; giới từ 'before + V-ing'.".to_string()),
                common_mistakes: Some(vec![
                    "Dùng 'before use' thay vì 'before using'".to_string(),
                    "Dùng tính từ 'careful' thay cho trạng từ 'carefully'".to_string(),
                ]),
            },
            NewSentence {
                source_lang: "vi".to_string(),
                target_lang: "en".to_string(),
                source_text: "Tôi rất mong sớm nhận được phản hồi từ bạn.".to_string(),
                reference_translation: Some("I look forward to hearing from you soon.".to_string()),
                difficulty_level: Some("intermediate".to_string()),
                category: Some("work".to_string()),
                origin: "starter_pack".to_string(),
                acceptable_alternatives: Some(vec![
                    "I am looking forward to hearing from you soon.".to_string(),
                    "I look forward to receiving your reply soon.".to_string(),
                ]),
                target_vocab: Some(vec![
                    TargetVocabItem {
                        word: "look forward to".to_string(),
                        word_type: Some("phrasal verb".to_string()),
                        meaning: "trông mong, mong đợi".to_string(),
                    },
                    TargetVocabItem {
                        word: "hear from".to_string(),
                        word_type: Some("phrasal verb".to_string()),
                        meaning: "nhận được tin tức/phản hồi từ".to_string(),
                    },
                ]),
                grammar_focus: Some("Cấu trúc 'look forward to + V-ing' ('to' ở đây là giới từ).".to_string()),
                common_mistakes: Some(vec![
                    "Dùng 'to hear' thay vì 'to hearing'".to_string(),
                ]),
            },
            NewSentence {
                source_lang: "vi".to_string(),
                target_lang: "en".to_string(),
                source_text: "Chuyến bay đã bị hoãn do điều kiện thời tiết xấu.".to_string(),
                reference_translation: Some("The flight was delayed due to bad weather conditions.".to_string()),
                difficulty_level: Some("intermediate".to_string()),
                category: Some("travel".to_string()),
                origin: "starter_pack".to_string(),
                acceptable_alternatives: Some(vec![
                    "The flight was postponed because of severe weather conditions.".to_string(),
                    "The flight got delayed owing to bad weather.".to_string(),
                ]),
                target_vocab: Some(vec![
                    TargetVocabItem {
                        word: "delay".to_string(),
                        word_type: Some("verb".to_string()),
                        meaning: "làm chậm, hoãn lại".to_string(),
                    },
                    TargetVocabItem {
                        word: "due to".to_string(),
                        word_type: Some("preposition".to_string()),
                        meaning: "do, bởi vì".to_string(),
                    },
                ]),
                grammar_focus: Some("Thể bị động (Passive Voice) 'was delayed'; liên từ/giới từ chỉ nguyên nhân 'due to + noun phrase'.".to_string()),
                common_mistakes: Some(vec![
                    "Dùng 'due to' với một mệnh đề".to_string(),
                    "Quên dạng bị động 'was delayed'".to_string(),
                ]),
            },
            NewSentence {
                source_lang: "vi".to_string(),
                target_lang: "en".to_string(),
                source_text: "Càng thực hành nhiều, bạn sẽ càng trở nên tự tin hơn khi giao tiếp.".to_string(),
                reference_translation: Some("The more you practice, the more confident you will become when communicating.".to_string()),
                difficulty_level: Some("advanced".to_string()),
                category: Some("education".to_string()),
                origin: "starter_pack".to_string(),
                acceptable_alternatives: Some(vec![
                    "The more you practice, the more confident you become in communication.".to_string(),
                    "The more you practise, the more confident you will be when speaking.".to_string(),
                ]),
                target_vocab: Some(vec![
                    TargetVocabItem {
                        word: "practice".to_string(),
                        word_type: Some("verb".to_string()),
                        meaning: "luyện tập, thực hành".to_string(),
                    },
                    TargetVocabItem {
                        word: "confident".to_string(),
                        word_type: Some("adjective".to_string()),
                        meaning: "tự tin".to_string(),
                    },
                ]),
                grammar_focus: Some("Cấu trúc so sánh kép (Double Comparative): The more..., the more...".to_string()),
                common_mistakes: Some(vec![
                    "Quên 'the' ở vế thứ hai".to_string(),
                    "Dùng 'more practice' sai trật tự".to_string(),
                ]),
            },
            NewSentence {
                source_lang: "vi".to_string(),
                target_lang: "en".to_string(),
                source_text: "Chúng tôi quyết định tổ chức một bữa tiệc bất ngờ cho sinh nhật của anh ấy.".to_string(),
                reference_translation: Some("We decided to throw a surprise party for his birthday.".to_string()),
                difficulty_level: Some("beginner".to_string()),
                category: Some("daily".to_string()),
                origin: "starter_pack".to_string(),
                acceptable_alternatives: Some(vec![
                    "We decided to organize a surprise party for his birthday.".to_string(),
                    "We decided to hold a surprise party for his birthday.".to_string(),
                ]),
                target_vocab: Some(vec![
                    TargetVocabItem {
                        word: "decide".to_string(),
                        word_type: Some("verb".to_string()),
                        meaning: "quyết định".to_string(),
                    },
                    TargetVocabItem {
                        word: "throw a party".to_string(),
                        word_type: Some("idiom".to_string()),
                        meaning: "tổ chức một bữa tiệc".to_string(),
                    },
                ]),
                grammar_focus: Some("Động từ 'decide + to V'; cụm từ tự nhiên 'throw a party'.".to_string()),
                common_mistakes: Some(vec![
                    "Dùng 'make a party' thay vì 'throw/organize a party'".to_string(),
                    "Quên 'to' sau 'decided'".to_string(),
                ]),
            },
            NewSentence {
                source_lang: "vi".to_string(),
                target_lang: "en".to_string(),
                source_text: "Việc duy trì thói quen đọc sách mỗi ngày mang lại vô số lợi ích lâu dài.".to_string(),
                reference_translation: Some("Maintaining a daily reading habit brings countless long-term benefits.".to_string()),
                difficulty_level: Some("advanced".to_string()),
                category: Some("education".to_string()),
                origin: "starter_pack".to_string(),
                acceptable_alternatives: Some(vec![
                    "Keeping a daily habit of reading offers numerous long-term benefits.".to_string(),
                    "Maintaining the habit of reading every day brings immense long-term benefits.".to_string(),
                ]),
                target_vocab: Some(vec![
                    TargetVocabItem {
                        word: "maintain".to_string(),
                        word_type: Some("verb".to_string()),
                        meaning: "duy trì".to_string(),
                    },
                    TargetVocabItem {
                        word: "countless".to_string(),
                        word_type: Some("adjective".to_string()),
                        meaning: "vô số, vô kể".to_string(),
                    },
                    TargetVocabItem {
                        word: "benefit".to_string(),
                        word_type: Some("noun".to_string()),
                        meaning: "lợi ích".to_string(),
                    },
                ]),
                grammar_focus: Some("Danh động từ (Gerund) 'Maintaining...' làm chủ ngữ số ít, động từ chia 'brings'.".to_string()),
                common_mistakes: Some(vec![
                    "Động từ không chia ngôi thứ ba số ít (bỏ 's' ở brings)".to_string(),
                    "Dùng danh từ ghép không chính xác".to_string(),
                ]),
            },
        ];

        let count = starter_sentences.len();
        for sentence in starter_sentences {
            self.add_sentence(sentence)?;
        }

        Ok(count)
    }

    pub fn add_attempt(&self, attempt: NewAttempt) -> Result<StudyAttempt, LearnDbError> {
        let id = Uuid::new_v4().to_string();
        let created_at = Utc::now().timestamp_millis();

        self.conn.execute(
            "INSERT INTO study_attempts (id, sentence_id, user_translation, grammar_score, feedback_text, improved_version, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                id,
                attempt.sentence_id,
                attempt.user_translation,
                attempt.grammar_score,
                attempt.feedback_text,
                attempt.improved_version,
                created_at,
            ],
        )?;

        Ok(StudyAttempt {
            id,
            sentence_id: attempt.sentence_id,
            user_translation: attempt.user_translation,
            grammar_score: attempt.grammar_score,
            feedback_text: attempt.feedback_text,
            improved_version: attempt.improved_version,
            created_at,
        })
    }

    pub fn list_attempts(
        &self,
        sentence_id: Option<&str>,
        limit: usize,
    ) -> Result<Vec<StudyAttempt>, LearnDbError> {
        let mut result = Vec::new();
        if let Some(sid) = sentence_id {
            let mut stmt = self.conn.prepare(
                "SELECT id, sentence_id, user_translation, grammar_score, feedback_text, improved_version, created_at
                 FROM study_attempts
                 WHERE sentence_id = ?1
                 ORDER BY created_at DESC
                 LIMIT ?2",
            )?;
            let rows = stmt.query_map(params![sid, limit as i64], |row| {
                Ok(StudyAttempt {
                    id: row.get(0)?,
                    sentence_id: row.get(1)?,
                    user_translation: row.get(2)?,
                    grammar_score: row.get(3)?,
                    feedback_text: row.get(4)?,
                    improved_version: row.get(5)?,
                    created_at: row.get(6)?,
                })
            })?;
            for row in rows {
                result.push(row?);
            }
        } else {
            let mut stmt = self.conn.prepare(
                "SELECT id, sentence_id, user_translation, grammar_score, feedback_text, improved_version, created_at
                 FROM study_attempts
                 ORDER BY created_at DESC
                 LIMIT ?1",
            )?;
            let rows = stmt.query_map(params![limit as i64], |row| {
                Ok(StudyAttempt {
                    id: row.get(0)?,
                    sentence_id: row.get(1)?,
                    user_translation: row.get(2)?,
                    grammar_score: row.get(3)?,
                    feedback_text: row.get(4)?,
                    improved_version: row.get(5)?,
                    created_at: row.get(6)?,
                })
            })?;
            for row in rows {
                result.push(row?);
            }
        }
        Ok(result)
    }

    pub fn add_vocab(&self, vocab: NewVocab) -> Result<SavedVocab, LearnDbError> {
        let trimmed_word = vocab.word_or_phrase.trim();
        let created_at = Utc::now().timestamp_millis();

        // Kiểm tra xem từ đã có trong sổ tay chưa (case-insensitive)
        let mut check_stmt = self.conn.prepare(
            "SELECT id, source_context, translation, notes FROM saved_vocab WHERE LOWER(TRIM(word_or_phrase)) = LOWER(?1) LIMIT 1",
        )?;
        let mut existing_rows = check_stmt.query_map(params![trimmed_word], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
            ))
        })?;

        if let Some(existing) = existing_rows.next() {
            let (existing_id, old_ctx, old_trans, old_notes) = existing?;
            let new_ctx = vocab.source_context.or(old_ctx);
            let new_trans = vocab.translation.or(old_trans);
            // Bảo toàn notes giàu thông tin: chỉ ghi đè khi notes mới có hạng
            // >= notes cũ (AI > legacy text > fallback thưa > rỗng).
            let new_notes = match (vocab.notes, old_notes) {
                (Some(new), Some(old)) if notes_rank(&new) < notes_rank(&old) => Some(old),
                (new, old) => new.or(old),
            };

            self.conn.execute(
                "UPDATE saved_vocab SET source_context = ?1, translation = ?2, notes = ?3, created_at = ?4 WHERE id = ?5",
                params![new_ctx, new_trans, new_notes, created_at, existing_id],
            )?;

            return Ok(SavedVocab {
                id: existing_id,
                word_or_phrase: trimmed_word.to_string(),
                source_context: new_ctx,
                translation: new_trans,
                notes: new_notes,
                created_at,
            });
        }

        let id = Uuid::new_v4().to_string();
        self.conn.execute(
            "INSERT INTO saved_vocab (id, word_or_phrase, source_context, translation, notes, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                id,
                trimmed_word,
                vocab.source_context,
                vocab.translation,
                vocab.notes,
                created_at,
            ],
        )?;

        Ok(SavedVocab {
            id,
            word_or_phrase: trimmed_word.to_string(),
            source_context: vocab.source_context,
            translation: vocab.translation,
            notes: vocab.notes,
            created_at,
        })
    }

    pub fn list_vocab(&self, limit: Option<usize>) -> Result<Vec<SavedVocab>, LearnDbError> {
        let max_limit = limit.unwrap_or(200) as i64;
        let mut stmt = self.conn.prepare(
            "SELECT id, word_or_phrase, source_context, translation, notes, created_at
             FROM saved_vocab
             ORDER BY created_at DESC
             LIMIT ?1",
        )?;

        let rows = stmt.query_map(params![max_limit], |row| {
            Ok(SavedVocab {
                id: row.get(0)?,
                word_or_phrase: row.get(1)?,
                source_context: row.get(2)?,
                translation: row.get(3)?,
                notes: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(result)
    }

    pub fn delete_vocab(&self, id: &str) -> Result<bool, LearnDbError> {
        let affected = self.conn.execute(
            "DELETE FROM saved_vocab WHERE id = ?1",
            params![id],
        )?;
        Ok(affected > 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_learn_db_in_memory_crud() {
        let db = LearnDb::init_in_memory().expect("failed to init db");

        // Test sentence insertion
        let sentence = db
            .add_sentence(NewSentence {
                source_lang: "en".to_string(),
                target_lang: "vi".to_string(),
                source_text: "Hello world".to_string(),
                reference_translation: Some("Xin chào thế giới".to_string()),
                difficulty_level: Some("A1".to_string()),
                category: Some("Daily".to_string()),
                origin: "overlay".to_string(),
                acceptable_alternatives: Some(vec!["Chào thế giới".to_string()]),
                target_vocab: Some(vec![TargetVocabItem {
                    word: "world".to_string(),
                    word_type: Some("noun".to_string()),
                    meaning: "thế giới".to_string(),
                }]),
                grammar_focus: Some("Câu chào hỏi thông dụng".to_string()),
                common_mistakes: Some(vec!["Quên dịch chữ world".to_string()]),
            })
            .expect("failed to add sentence");
        assert_eq!(sentence.acceptable_alternatives.as_ref().unwrap().len(), 1);
        assert_eq!(sentence.target_vocab.as_ref().unwrap().len(), 1);
        assert_eq!(sentence.grammar_focus.as_deref(), Some("Câu chào hỏi thông dụng"));

        assert_eq!(sentence.source_text, "Hello world");
        let list = db.list_sentences(10).expect("failed to list");
        assert_eq!(list.len(), 1);

        // Test attempt insertion
        let attempt = db
            .add_attempt(NewAttempt {
                sentence_id: Some(sentence.id.clone()),
                user_translation: "Chào thế giới".to_string(),
                grammar_score: Some(90),
                feedback_text: "Tốt".to_string(),
                improved_version: Some("Xin chào thế giới".to_string()),
            })
            .expect("failed to add attempt");

        assert_eq!(attempt.grammar_score, Some(90));
        let attempts = db.list_attempts(Some(&sentence.id), 10).expect("failed to list attempts");
        assert_eq!(attempts.len(), 1);

        // Test vocab insertion
        let vocab = db
            .add_vocab(NewVocab {
                word_or_phrase: "world".to_string(),
                source_context: Some("Hello world".to_string()),
                translation: Some("thế giới".to_string()),
                notes: Some("Danh từ".to_string()),
            })
            .expect("failed to add vocab");

        assert_eq!(vocab.word_or_phrase, "world");
        let vocabs = db.list_vocab(None).expect("failed to list vocab");
        assert_eq!(vocabs.len(), 1);

        // Test delete vocab
        let deleted = db.delete_vocab(&vocab.id).expect("failed to delete vocab");
        assert!(deleted);
        let vocabs_after = db.list_vocab(None).expect("failed to list vocab");
        assert_eq!(vocabs_after.len(), 0);

        // Test cascade delete sentence
        let deleted_s = db.delete_sentence(&sentence.id).expect("failed to delete sentence");
        assert!(deleted_s);
        let attempts_after = db.list_attempts(Some(&sentence.id), 10).expect("failed to list");
        assert_eq!(attempts_after.len(), 0);
    }

    #[test]
    fn test_starter_pack_seed() {
        let db = LearnDb::init_in_memory().expect("failed to init db");
        assert_eq!(db.count_sentences().unwrap(), 0);

        let seeded = db.seed_starter_pack_if_empty().expect("failed to seed starter pack");
        assert_eq!(seeded, 15);
        assert_eq!(db.count_sentences().unwrap(), 15);

        // Calling again should be idempotent and return 0
        let seeded_again = db.seed_starter_pack_if_empty().expect("failed second seed");
        assert_eq!(seeded_again, 0);
        assert_eq!(db.count_sentences().unwrap(), 15);

        // Verify packets
        let list = db.list_sentences(20).expect("failed to list sentences");
        assert_eq!(list.len(), 15);
        for s in list {
            assert!(s.acceptable_alternatives.is_some());
            assert!(s.target_vocab.is_some());
            assert!(s.grammar_focus.is_some());
            assert!(s.common_mistakes.is_some());
            assert_eq!(s.origin, "starter_pack");
        }
    }

    #[test]
    fn test_vocab_upsert_preserves_richer_notes() {
        let db = LearnDb::init_in_memory().expect("failed to init db");

        let ai_notes = serde_json::json!({
            "phonetic": "/pəʊstˈpəʊn/",
            "partOfSpeech": "verb",
            "explanation": "Dời sự kiện sang lúc khác.",
            "example": "They postponed the meeting.",
            "exampleTranslation": "Họ đã hoãn cuộc họp.",
            "source": "ai",
            "version": 1,
        })
        .to_string();

        let fallback_notes = serde_json::json!({
            "phonetic": null,
            "partOfSpeech": null,
            "explanation": "",
            "example": null,
            "exampleTranslation": null,
            "source": "fallback",
            "version": 1,
        })
        .to_string();

        // 1. Lưu notes AI giàu trước.
        db.add_vocab(NewVocab {
            word_or_phrase: "postpone".to_string(),
            source_context: Some("They postponed the meeting.".to_string()),
            translation: Some("hoãn lại".to_string()),
            notes: Some(ai_notes.clone()),
        })
        .expect("failed to add vocab");

        // 2. Ghi đè bằng notes fallback thưa → phải giữ notes AI.
        let saved = db
            .add_vocab(NewVocab {
                word_or_phrase: "postpone".to_string(),
                source_context: None,
                translation: Some("trì hoãn".to_string()),
                notes: Some(fallback_notes.clone()),
            })
            .expect("failed to upsert vocab");
        assert_eq!(saved.notes.as_deref(), Some(ai_notes.as_str()));
        assert_eq!(saved.translation.as_deref(), Some("trì hoãn"));

        // 3. Ghi đè bằng notes AI mới (cùng hạng) → notes mới thắng.
        let ai_notes_v2 = ai_notes.replace("hoãn cuộc họp", "dời cuộc họp");
        let saved2 = db
            .add_vocab(NewVocab {
                word_or_phrase: "postpone".to_string(),
                source_context: None,
                translation: None,
                notes: Some(ai_notes_v2.clone()),
            })
            .expect("failed to upsert vocab v2");
        assert_eq!(saved2.notes.as_deref(), Some(ai_notes_v2.as_str()));

        // 4. Legacy text notes (hạng 2) không bị fallback thưa (hạng 1) ghi đè.
        db.add_vocab(NewVocab {
            word_or_phrase: "legacy".to_string(),
            source_context: None,
            translation: Some("cũ".to_string()),
            notes: Some("Ghi chú thủ công từ submit_study_attempt".to_string()),
        })
        .expect("failed to add legacy vocab");
        let saved3 = db
            .add_vocab(NewVocab {
                word_or_phrase: "legacy".to_string(),
                source_context: None,
                translation: None,
                notes: Some(fallback_notes),
            })
            .expect("failed to upsert legacy vocab");
        assert_eq!(
            saved3.notes.as_deref(),
            Some("Ghi chú thủ công từ submit_study_attempt")
        );
    }
}
