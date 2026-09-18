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
        Ok(())
    }

    pub fn add_sentence(&self, sentence: NewSentence) -> Result<StudySentence, LearnDbError> {
        let id = Uuid::new_v4().to_string();
        let created_at = Utc::now().timestamp_millis();

        self.conn.execute(
            "INSERT INTO study_sentences (id, source_lang, target_lang, source_text, reference_translation, difficulty_level, category, origin, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
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
        })
    }

    pub fn list_sentences(&self, limit: usize) -> Result<Vec<StudySentence>, LearnDbError> {
        let mut stmt = self.conn.prepare(
            "SELECT id, source_lang, target_lang, source_text, reference_translation, difficulty_level, category, origin, created_at
             FROM study_sentences
             ORDER BY created_at DESC
             LIMIT ?1",
        )?;

        let rows = stmt.query_map(params![limit as i64], |row| {
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
            "SELECT id, source_lang, target_lang, source_text, reference_translation, difficulty_level, category, origin, created_at
             FROM study_sentences
             WHERE id = ?1",
        )?;

        let mut rows = stmt.query_map(params![id], |row| {
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
            "SELECT id, source_lang, target_lang, source_text, reference_translation, difficulty_level, category, origin, created_at
             FROM study_sentences
             WHERE source_text = ?1 AND target_lang = ?2
             ORDER BY created_at DESC
             LIMIT 1",
        )?;

        let mut rows = stmt.query_map(params![text, target_lang], |row| {
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
            let new_notes = vocab.notes.or(old_notes);

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
            })
            .expect("failed to add sentence");

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
}
