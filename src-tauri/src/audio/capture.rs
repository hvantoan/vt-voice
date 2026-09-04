use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::time::Instant;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{SampleFormat, StreamConfig};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use super::resampler::{downmix_to_mono, resample_to_16k};
use super::wav::{calculate_rms, encode_pcm_wav};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

#[derive(Debug, thiserror::Error)]
pub enum AudioError {
    #[error("No audio input device found")]
    NoDevice,
    #[error("Device not found: {0}")]
    DeviceNotFound(String),
    #[error("Audio device configuration error: {0}")]
    ConfigError(String),
    #[error("Failed to build input stream: {0}")]
    StreamError(#[from] cpal::BuildStreamError),
    #[error("Failed to play audio stream: {0}")]
    PlayStreamError(#[from] cpal::PlayStreamError),
    #[error("Resampling error: {0}")]
    Resample(#[from] super::resampler::ResampleError),
    #[error("WAV encoding error: {0}")]
    Wav(#[from] super::wav::WavError),
}

/// Enumerate available Windows audio input devices
pub fn list_input_devices() -> Result<Vec<AudioDevice>, AudioError> {
    let host = cpal::default_host();
    let default_device_name = host
        .default_input_device()
        .and_then(|d| d.name().ok());

    let mut devices = Vec::new();
    let input_devices = host.input_devices().map_err(|e| AudioError::ConfigError(e.to_string()))?;

    for device in input_devices {
        if let Ok(name) = device.name() {
            let is_default = default_device_name.as_ref().is_some_and(|d| d == &name);
            devices.push(AudioDevice {
                id: name.clone(),
                name,
                is_default,
            });
        }
    }

    Ok(devices)
}

pub struct AudioRecorder {
    is_recording: Arc<AtomicBool>,
    current_stream: Option<cpal::Stream>,
    recorded_samples: Arc<Mutex<Vec<f32>>>,
    sample_rate: u32,
    channels: u16,
}
unsafe impl Send for AudioRecorder {}
unsafe impl Sync for AudioRecorder {}

impl AudioRecorder {
    pub fn new() -> Self {
        Self {
            is_recording: Arc::new(AtomicBool::new(false)),
            current_stream: None,
            recorded_samples: Arc::new(Mutex::new(Vec::new())),
            sample_rate: 48_000,
            channels: 2,
        }
    }

    pub fn is_recording(&self) -> bool {
        self.is_recording.load(Ordering::SeqCst)
    }

    pub fn start(&mut self, app_handle: Option<AppHandle>, device_name: Option<String>) -> Result<(), AudioError> {
        if self.is_recording() {
            return Ok(());
        }

        let host = cpal::default_host();
        let device = if let Some(target_name) = &device_name {
            host.input_devices()
                .map_err(|e| AudioError::ConfigError(e.to_string()))?
                .find(|d| d.name().map_or(false, |n| &n == target_name))
                .ok_or_else(|| AudioError::DeviceNotFound(target_name.clone()))?
        } else {
            host.default_input_device().ok_or(AudioError::NoDevice)?
        };

        let default_config = device
            .default_input_config()
            .map_err(|e| AudioError::ConfigError(e.to_string()))?;

        self.sample_rate = default_config.sample_rate().0;
        self.channels = default_config.channels();

        let samples_buffer = Arc::new(Mutex::new(Vec::with_capacity(self.sample_rate as usize * 10)));
        self.recorded_samples = Arc::clone(&samples_buffer);

        let is_recording_flag = Arc::clone(&self.is_recording);
        is_recording_flag.store(true, Ordering::SeqCst);

        let err_fn = |err| {
            eprintln!("[AudioRecorder] Stream error: {}", err);
        };

        let last_rms_time = Arc::new(Mutex::new(Instant::now()));
        let rms_buffer = Arc::new(Mutex::new(Vec::with_capacity(2048)));

        let stream_config: StreamConfig = default_config.clone().into();

        let stream = match default_config.sample_format() {
            SampleFormat::F32 => {
                let samples_clone = Arc::clone(&samples_buffer);
                let app_clone = app_handle.clone();
                let last_time = Arc::clone(&last_rms_time);
                let rms_buf = Arc::clone(&rms_buffer);

                device.build_input_stream(
                    &stream_config,
                    move |data: &[f32], _: &cpal::InputCallbackInfo| {
                        samples_clone.lock().extend_from_slice(data);

                        if let Some(app) = &app_clone {
                            let mut last = last_time.lock();
                            let mut buf = rms_buf.lock();
                            buf.extend_from_slice(data);
                            if last.elapsed().as_millis() >= 50 {
                                let level = calculate_rms(&buf);
                                buf.clear();
                                *last = Instant::now();
                                let _ = app.emit("audio-level", level);
                            }
                        }
                    },
                    err_fn,
                    None,
                )?
            }
            SampleFormat::I16 => {
                let samples_clone = Arc::clone(&samples_buffer);
                let app_clone = app_handle.clone();
                let last_time = Arc::clone(&last_rms_time);
                let rms_buf = Arc::clone(&rms_buffer);

                device.build_input_stream(
                    &stream_config,
                    move |data: &[i16], _: &cpal::InputCallbackInfo| {
                        let f32_samples: Vec<f32> = data
                            .iter()
                            .map(|&s| (s as f32) / 32768.0)
                            .collect();

                        samples_clone.lock().extend_from_slice(&f32_samples);

                        if let Some(app) = &app_clone {
                            let mut last = last_time.lock();
                            let mut buf = rms_buf.lock();
                            buf.extend_from_slice(&f32_samples);
                            if last.elapsed().as_millis() >= 50 {
                                let level = calculate_rms(&buf);
                                buf.clear();
                                *last = Instant::now();
                                let _ = app.emit("audio-level", level);
                            }
                        }
                    },
                    err_fn,
                    None,
                )?
            }
            sample_format => {
                return Err(AudioError::ConfigError(format!(
                    "Unsupported audio format: {:?}",
                    sample_format
                )));
            }
        };

        stream.play()?;
        self.current_stream = Some(stream);

        Ok(())
    }

    pub fn stop(&mut self) -> Result<Vec<u8>, AudioError> {
        self.is_recording.store(false, Ordering::SeqCst);
        self.current_stream = None;

        let raw_samples = {
            let mut lock = self.recorded_samples.lock();
            std::mem::take(&mut *lock)
        };

        if raw_samples.is_empty() {
            return Ok(encode_pcm_wav(&[], 16_000)?);
        }

        // 1. Downmix to mono
        let mono_samples = downmix_to_mono(&raw_samples, self.channels);

        // 2. Resample to 16,000 Hz for Whisper
        let resampled_samples = resample_to_16k(&mono_samples, self.sample_rate)?;

        // 3. Encode to 16-bit PCM WAV
        let wav_bytes = encode_pcm_wav(&resampled_samples, 16_000)?;

        Ok(wav_bytes)
    }
}
