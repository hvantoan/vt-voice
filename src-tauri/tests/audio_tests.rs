use vt_voice_lib::audio::{
    calculate_rms, downmix_to_mono, encode_pcm_wav, resample_to_16k,
};

#[test]
fn test_audio_downmix_multi_channels() {
    // 4 frames of stereo (L, R)
    let stereo = vec![1.0, 0.0, 0.5, 0.5, -0.5, 0.5, -1.0, 1.0];
    let mono = downmix_to_mono(&stereo, 2);

    assert_eq!(mono.len(), 4);
    assert!((mono[0] - 0.5).abs() < 1e-6);
    assert!((mono[1] - 0.5).abs() < 1e-6);
    assert!((mono[2] - 0.0).abs() < 1e-6);
    assert!((mono[3] - 0.0).abs() < 1e-6);
}

#[test]
fn test_audio_resampling_48k_to_16k() {
    // 1 second of 48kHz audio (48,000 samples)
    let input_rate = 48_000;
    let samples: Vec<f32> = (0..input_rate)
        .map(|i| (i as f32 * 440.0 * 2.0 * std::f32::consts::PI / input_rate as f32).sin())
        .collect();

    let resampled = resample_to_16k(&samples, input_rate).expect("Resampling should succeed");

    // Output length should be approximately 16,000 samples (within small FFT block margin)
    let diff = (resampled.len() as i32 - 16_000).abs();
    assert!(diff < 100, "Resampled count should be ~16000, got {}", resampled.len());
}

#[test]
fn test_audio_resampling_44100_to_16k() {
    // 1 second of 44.1kHz audio (44,100 samples)
    let input_rate = 44_100;
    let samples: Vec<f32> = (0..input_rate)
        .map(|i| (i as f32 * 440.0 * 2.0 * std::f32::consts::PI / input_rate as f32).sin())
        .collect();

    let resampled = resample_to_16k(&samples, input_rate).expect("Resampling should succeed");

    let diff = (resampled.len() as i32 - 16_000).abs();
    assert!(diff < 100, "Resampled count should be ~16000, got {}", resampled.len());
}

#[test]
fn test_wav_encoding_header() {
    let samples = vec![0.0f32, 0.5, -0.5, 1.0, -1.0];
    let wav_bytes = encode_pcm_wav(&samples, 16_000).expect("WAV encoding should succeed");

    // RIFF header checks
    assert!(wav_bytes.len() >= 44);
    assert_eq!(&wav_bytes[0..4], b"RIFF");
    assert_eq!(&wav_bytes[8..12], b"WAVE");
    assert_eq!(&wav_bytes[12..16], b"fmt ");

    // Verify 16kHz sample rate at offset 24..28 (little-endian u32)
    let sample_rate = u32::from_le_bytes([wav_bytes[24], wav_bytes[25], wav_bytes[26], wav_bytes[27]]);
    assert_eq!(sample_rate, 16_000);

    // Verify 1 channel at offset 22..24 (little-endian u16)
    let channels = u16::from_le_bytes([wav_bytes[22], wav_bytes[23]]);
    assert_eq!(channels, 1);

    // Verify 16 bits per sample at offset 34..36 (little-endian u16)
    let bits_per_sample = u16::from_le_bytes([wav_bytes[34], wav_bytes[35]]);
    assert_eq!(bits_per_sample, 16);
}

#[test]
fn test_rms_calculation_levels() {
    assert_eq!(calculate_rms(&[]), 0.0);

    let silence = vec![0.0f32; 100];
    assert_eq!(calculate_rms(&silence), 0.0);

    let max_volume = vec![1.0f32; 100];
    assert_eq!(calculate_rms(&max_volume), 1.0);

    // 0.2 * 2.5 gain boost = 0.5
    let quiet_volume = vec![0.2f32; 100];
    assert!((calculate_rms(&quiet_volume) - 0.5).abs() < 1e-6);
}
