/**
 * AudioWorklet processor.
 *
 * Runs in the browser audio thread — NOT in the main JS thread.
 * Captures raw PCM audio at 16kHz and sends 250ms chunks
 * back to the main thread via postMessage.
 *
 * 16kHz × 250ms = 4000 samples per chunk.
 * Each sample is a Float32 converted to Int16 PCM.
 */

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    // 4000 samples = 250ms at 16kHz
    // Large enough to avoid too many messages,
    // small enough for low latency
    this._bufferSize = 4000;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const samples = input[0];

    for (let i = 0; i < samples.length; i++) {
      this._buffer.push(samples[i]);
    }

    // When we have enough samples, send a chunk
    while (this._buffer.length >= this._bufferSize) {
      const chunk = this._buffer.splice(0, this._bufferSize);

      // Convert Float32 [-1, 1] to Int16 [-32768, 32767]
      // This is standard PCM16 format that Whisper accepts
      const pcm16 = new Int16Array(chunk.length);
      for (let i = 0; i < chunk.length; i++) {
        const clamped = Math.max(-1, Math.min(1, chunk[i]));
        pcm16[i] = clamped < 0
          ? clamped * 32768
          : clamped * 32767;
      }

      // Transfer the buffer — zero-copy, fast
      this.port.postMessage(
        { pcm: pcm16.buffer },
        [pcm16.buffer]
      );
    }

    // Return true to keep the processor alive
    return true;
  }
}

registerProcessor("audio-processor", AudioProcessor);