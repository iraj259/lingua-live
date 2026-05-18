"use client";

/**
 * useAudioCapture
 *
 * Manages the microphone, AudioContext, and AudioWorklet.
 * Captures audio in push-to-talk mode.
 *
 * How it works:
 * 1. Request microphone permission
 * 2. Create AudioContext at 16kHz (what Whisper expects)
 * 3. Load the AudioWorklet processor
 * 4. Connect: microphone → worklet → collects PCM chunks
 * 5. On stop: combine all chunks into one blob, call onAudioReady
 */

import { useState, useEffect, useCallback, useRef } from "react";

interface UseAudioCaptureOptions {
  // Called when the user stops recording
  // Receives base64 encoded audio and the mime type
  onAudioReady: (audioBase64: string, mimeType: string) => void;
}

interface UseAudioCaptureReturn {
  isRecording:    boolean;
  hasPermission:  boolean | null;  // null = not asked yet
  audioLevel:     number;          // 0-1 for visualizer
  startRecording: () => Promise<void>;
  stopRecording:  () => void;
}

export function useAudioCapture(
  { onAudioReady }: UseAudioCaptureOptions
): UseAudioCaptureReturn {
  const [isRecording,   setIsRecording]   = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [audioLevel,    setAudioLevel]    = useState(0);

  const audioContextRef  = useRef<AudioContext | null>(null);
  const workletNodeRef   = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef    = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef      = useRef<AnalyserNode | null>(null);
  const streamRef        = useRef<MediaStream | null>(null);
  const chunksRef        = useRef<Int16Array[]>([]);
  const rafRef           = useRef<number>(0);
  // Ref-based flag so stopRecording always sees the latest value,
  // even if called before the setState re-render from startRecording
  const isRecordingRef   = useRef(false);
  const onAudioReadyRef  = useRef(onAudioReady);
  useEffect(() => { onAudioReadyRef.current = onAudioReady; }, [onAudioReady]);

  // ── startRecording ────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return;
    isRecordingRef.current = true;  // set before async so stopRecording sees it immediately

    try {
      // Request microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate:       16000,
          channelCount:     1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      setHasPermission(true);
      streamRef.current = stream;
      chunksRef.current = []; // reset chunks for new recording

      // Create AudioContext at 16kHz
      const ctx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = ctx;

      // Load AudioWorklet processor
      await ctx.audioWorklet.addModule("/audio-processor.js");

      // Create nodes
      const source  = ctx.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(ctx, "audio-processor");
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      // Collect PCM chunks from the worklet
      worklet.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer }>) => {
        const pcm = new Int16Array(e.data.pcm);
        chunksRef.current.push(pcm);
      };

      // Connect the audio graph
      source.connect(analyser);
      source.connect(worklet);
      // Do NOT connect worklet to destination — we don't want to hear ourselves

      sourceNodeRef.current  = source;
      workletNodeRef.current = worklet;
      analyserRef.current    = analyser;

      // Audio level animation loop
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(avg / 255);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      setIsRecording(true);

    } catch (err) {
      isRecordingRef.current = false;
      console.error("Microphone error:", err);
      setHasPermission(false);
    }
  }, []);

  // ── stopRecording ─────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;

    // Stop the animation loop
    cancelAnimationFrame(rafRef.current);
    setAudioLevel(0);

    // Disconnect audio nodes
    workletNodeRef.current?.disconnect();
    sourceNodeRef.current?.disconnect();

    // Stop the microphone stream
    streamRef.current?.getTracks().forEach(t => t.stop());

    // Close the AudioContext
    audioContextRef.current?.close();

    setIsRecording(false);

    // Combine all PCM chunks into one buffer
    const chunks = chunksRef.current;
    if (chunks.length === 0) return;

    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const combined    = new Int16Array(totalLength);
    let   offset      = 0;

    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    // Convert to WAV format
    // WAV is more universally supported than raw PCM
    const wav       = encodeWAV(combined, 16000);
    const base64    = arrayBufferToBase64(wav);
    const mimeType  = "audio/wav";

    onAudioReadyRef.current(base64, mimeType);

  }, []);

  return {
    isRecording,
    hasPermission,
    audioLevel,
    startRecording,
    stopRecording,
  };
}

// ── WAV encoder ────────────────────────────────────────────────────────────
// Whisper works best with WAV. This encodes raw PCM16 as a proper WAV file.
function encodeWAV(samples: Int16Array, sampleRate: number): ArrayBuffer {
  const buffer     = new ArrayBuffer(44 + samples.length * 2);
  const view       = new DataView(buffer);
  const numChannels = 1;
  const bitsPerSample = 16;

  // RIFF header
  writeString(view, 0,  "RIFF");
  view.setUint32(4,  36 + samples.length * 2, true);
  writeString(view, 8,  "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);              // chunk size
  view.setUint16(20, 1,  true);              // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate,  true);
  view.setUint32(28, sampleRate * numChannels * bitsPerSample / 8, true);
  view.setUint16(32, numChannels * bitsPerSample / 8, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(offset, samples[i]!, true);
    offset += 2;
  }

  return buffer;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes  = new Uint8Array(buffer);
  let   binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}