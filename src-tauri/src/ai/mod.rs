pub mod catalog;
pub mod client;
pub mod fallback;
pub mod groq;
pub mod openrouter;
pub mod prompts;
pub mod provider;

pub use catalog::{get_available_stt_models, SttModelInfo};
pub use client::{AiError, AiHttpClient};
pub use fallback::LocalPolisher;
pub use groq::{polish_grammar, run_pipeline, test_connection, transcribe, AiPipelineResult};
pub use openrouter::{test_openrouter_connection, transcribe_openrouter};
pub use prompts::{DEFAULT_INITIAL_PROMPT, DEFAULT_POLISH_SYSTEM_PROMPT};
pub use provider::{test_provider_connection, transcribe_with_provider, AiProvider};
