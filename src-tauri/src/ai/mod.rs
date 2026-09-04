pub mod client;
pub mod fallback;
pub mod groq;
pub mod prompts;

pub use client::{AiError, AiHttpClient};
pub use fallback::LocalPolisher;
pub use groq::{polish_grammar, run_pipeline, test_connection, transcribe, AiPipelineResult};
pub use prompts::{DEFAULT_INITIAL_PROMPT, DEFAULT_POLISH_SYSTEM_PROMPT};
