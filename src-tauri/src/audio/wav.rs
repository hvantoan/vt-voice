use std::io::Cursor;
use hound::{WavSpec, WavWriter, SampleFormat};

#[derive(Debug, thiserror::Error)]
pub enum WavError {
    #[error("Hound WAV encoding error: {0}")]
    Hound(#[from] hound::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// Encode 16kHz mono f32 samples to standard 16-bit PCM WAV bytes
pub fn encode_pcm_wav(samples: &[f32], sample_rate: u32) -> Result<Vec<u8>, WavError> {
    let spec = WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 16,
        sample_format: SampleFormat::Int,
    };

    let mut cursor = Cursor::new(Vec::with_capacity(44 + samples.len() * 2));
    {
        let mut writer = WavWriter::new(&mut cursor, spec)?;
        for &sample in samples {
            // Clamp and convert f32 (-1.0 .. 1.0) to i16
            let clamped = sample.max(-1.0).min(1.0);
            let s16 = (clamped * 32767.0) as i16;
            writer.write_sample(s16)?;
        }
        writer.finalize()?;
    }

    Ok(cursor.into_inner())
}

/// Calculate Root-Mean-Square (RMS) volume normalized to 0.0 - 1.0
pub fn calculate_rms(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }

    let sum_sq: f32 = samples.iter().map(|&s| s * s).sum();
    let mean_sq = sum_sq / (samples.len() as f32);
    let rms = mean_sq.sqrt();

    // Multiply by gain boost for natural mic sensitivity and clamp to [0.0, 1.0]
    (rms * 2.5).min(1.0).max(0.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_pcm_wav() {
        let samples = vec![0.0, 0.5, -0.5, 1.0, -1.0];
        let bytes = encode_pcm_wav(&samples, 16000).expect("encoding failed");
        
        // WAV header is 44 bytes, 5 samples * 2 bytes = 10 bytes -> total 54 bytes
        assert_eq!(bytes.len(), 54);
        assert_eq!(&bytes[0..4], b"RIFF");
        assert_eq!(&bytes[8..12], b"WAVE");
    }

    #[test]
    fn test_rms_calculation() {
        assert_eq!(calculate_rms(&[]), 0.0);
        let silence = vec![0.0; 100];
        assert_eq!(calculate_rms(&silence), 0.0);

        let signal = vec![0.5; 100];
        assert!(calculate_rms(&signal) > 0.0);
    }
}
