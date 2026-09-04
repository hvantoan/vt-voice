---
phase: 2
title: "Windows Native Audio Capture & DSP Engine"
status: pending
priority: P1
effort: "5h"
dependencies: [1]
---
# Phase 2: Windows Native Audio Capture & DSP Engine

## Overview

Implement the native Rust audio recording pipeline using `cpal` with the Windows WASAPI backend. Runs on a dedicated MMCSS audio thread to guarantee zero frame drops and zero background throttling when Tauri's UI is hidden. Converts arbitrary hardware input (44.1k/48k stereo) into 16,000 Hz mono 16-bit PCM WAV in-memory for Whisper, while streaming real-time RMS audio levels to the frontend overlay.

## Requirements

- Functional:
  - Enumerate Windows audio input devices and select default or user-configured microphone.
  - Non-blocking start/stop recording control via Rust channels / state machine.
  - Lock-free ring buffer between WASAPI audio callback and worker thread.
  - Stereo-to-mono downmixing and dynamic sinc resampling to 16,000 Hz using `rubato`.
  - In-memory 44-byte RIFF WAV generator (`hound`) producing valid audio payload for Whisper API.
  - Calculate real-time RMS volume levels every 50ms and emit `audio-level` event for waveform animation.
- Non-functional:
  - Audio processing memory footprint < 10MB during active recording.
  - Zero frame drops or crackling artifacts.

## Architecture

```
WASAPI Device Input (cpal callback, 48kHz Stereo f32)
       │
       ▼ (lock-free ring buffer)
Worker Thread -> Stereo to Mono -> Resampler (rubato -> 16kHz)
       │                                  │
       ▼                                  ▼
RMS Volume Calculator              In-Memory Buffer (Vec<i16>)
(emits "audio-level" event)               │ (on stop recording)
                                          ▼
                                   hound::WavWriter -> Vec<u8> WAV
```

## Related Code Files

- Create: `src-tauri/src/audio/mod.rs`
- Create: `src-tauri/src/audio/capture.rs`
- Create: `src-tauri/src/audio/resampler.rs`
- Create: `src-tauri/src/audio/wav.rs`
- Modify: `src-tauri/src/lib.rs`

## Implementation Steps

1. Create `audio` module in `src-tauri/src/audio/`.
2. Implement `capture.rs`: Setup `cpal::traits::HostTrait` with WASAPI host. Enable Windows MMCSS thread characteristics (`"Audio"`) via Win32 API.
3. Build lock-free ring buffer using `ringbuf::HeapRb` to decouple WASAPI callback from DSP processing.
4. Implement `resampler.rs`: Downmix stereo channels to mono ($M = \frac{L + R}{2}$). Apply `rubato::FftFixedInOut` or sinc decimation from hardware rate (44.1kHz/48kHz) to 16kHz.
5. Implement `wav.rs`: Encode processed S16LE samples into an in-memory `std::io::Cursor<Vec<u8>>` using `hound::WavWriter`.
6. Implement RMS volume computation ($RMS = \sqrt{\frac{1}{N}\sum x_i^2}$) clamped between 0.0 and 1.0, dispatched to Tauri window events.
7. Expose Tauri commands: `start_recording()`, `stop_recording() -> Vec<u8>`, `get_audio_devices()`.

## Success Criteria

- [x] Record 5 seconds of speech and generate a valid 16kHz mono WAV file in memory.
- [x] Generated WAV header verified: 16,000 Hz, 1 channel, 16-bit PCM.
- [x] RMS events reliably emitted and reflect ambient volume fluctuations.
- [x] Unit tests pass for stereo-to-mono downmixing and sample rate conversion.

## Risk Assessment

- *Risk*: Hardware sample rate is non-standard (e.g. 96kHz or 44.1kHz).
  *Mitigation*: `rubato` handles arbitrary input-to-output ratios dynamically; calculate GCD for resampling parameters.
