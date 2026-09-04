use rubato::{FftFixedInOut, Resampler};

#[derive(Debug, thiserror::Error)]
pub enum ResampleError {
    #[error("Failed to initialize Rubato resampler: {0}")]
    Init(#[from] rubato::ResamplerConstructionError),
    #[error("Resampling processing error: {0}")]
    Process(#[from] rubato::ResampleError),
}

/// Downmix multi-channel interleaved audio samples to single-channel mono
pub fn downmix_to_mono(interleaved: &[f32], channels: u16) -> Vec<f32> {
    if channels <= 1 {
        return interleaved.to_vec();
    }

    let ch = channels as usize;
    interleaved
        .chunks_exact(ch)
        .map(|frame| frame.iter().sum::<f32>() / (ch as f32))
        .collect()
}

/// Resample mono audio samples from `input_rate` to `target_rate` (16,000 Hz)
pub fn resample_to_16k(mono_samples: &[f32], input_rate: u32) -> Result<Vec<f32>, ResampleError> {
    const TARGET_RATE: u32 = 16_000;

    if input_rate == TARGET_RATE || mono_samples.is_empty() {
        return Ok(mono_samples.to_vec());
    }

    // Use FftFixedInOut with 1024 frame chunk size for low latency & high quality
    let chunk_size = 1024;
    let mut resampler = FftFixedInOut::<f32>::new(
        input_rate as usize,
        TARGET_RATE as usize,
        chunk_size,
        1, // 1 mono channel
    )?;

    let mut output = Vec::with_capacity(
        (mono_samples.len() as f64 * (TARGET_RATE as f64 / input_rate as f64)) as usize + 256,
    );

    let mut pos = 0;
    while pos < mono_samples.len() {
        let needed_in = resampler.input_frames_next();
        let end = (pos + needed_in).min(mono_samples.len());
        let slice = &mono_samples[pos..end];

        let mut input_chunk = slice.to_vec();
        if input_chunk.len() < needed_in {
            input_chunk.resize(needed_in, 0.0);
        }

        let waves_in = vec![input_chunk];
        let waves_out = resampler.process(&waves_in, None)?;
        if let Some(channel_out) = waves_out.first() {
            output.extend_from_slice(channel_out);
        }

        pos += needed_in;
    }

    // Trim output according to the exact duration ratio
    let expected_len = ((mono_samples.len() as f64) * (TARGET_RATE as f64 / input_rate as f64)).round() as usize;
    if output.len() > expected_len && expected_len > 0 {
        output.truncate(expected_len);
    }

    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_downmix_stereo_to_mono() {
        // L = 1.0, R = 0.5 -> Mono = 0.75
        let stereo = vec![1.0, 0.5, -0.4, 0.4];
        let mono = downmix_to_mono(&stereo, 2);
        assert_eq!(mono.len(), 2);
        assert!((mono[0] - 0.75).abs() < 1e-6);
        assert!((mono[1] - 0.0).abs() < 1e-6);
    }

    #[test]
    fn test_resample_48k_to_16k() {
        // 1 second of 48kHz audio (48,000 samples)
        let samples = vec![0.1; 48_000];
        let resampled = resample_to_16k(&samples, 48_000).expect("resampling failed");
        // Should produce approximately 16,000 samples
        assert!((resampled.len() as i32 - 16_000).abs() < 50);
    }

    #[test]
    fn test_resample_44100_to_16k() {
        // 1 second of 44.1kHz audio (44,100 samples)
        let samples = vec![0.1; 44_100];
        let resampled = resample_to_16k(&samples, 44_100).expect("resampling failed");
        assert!((resampled.len() as i32 - 16_000).abs() < 50);
    }
}
