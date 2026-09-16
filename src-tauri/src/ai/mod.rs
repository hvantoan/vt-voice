pub mod catalog;
pub mod client;
pub mod fallback;
pub mod groq;
pub mod openrouter;
pub mod prompts;
pub mod provider;
pub mod translate;

pub use catalog::{
    fetch_openai_models, get_available_stt_models, DiscoveredModel, SttModelInfo,
};
pub use client::{AiError, AiHttpClient};
pub use fallback::LocalPolisher;
pub use groq::{polish_grammar, run_pipeline, test_connection, transcribe, AiPipelineResult};
pub use openrouter::{test_openrouter_connection, transcribe_openrouter};
pub use prompts::{DEFAULT_INITIAL_PROMPT, DEFAULT_POLISH_SYSTEM_PROMPT};
pub use provider::{
    polish_with_endpoint, test_endpoint_latency, test_provider_connection,
    transcribe_with_endpoint, transcribe_with_provider, AiProvider,
};
pub use translate::{
    translate_chat, translate_chat_with_lang, translate_google, translate_google_with_langs,
    TranslationResult,
};
