"use client";

import { WaveBlob } from "./wave-blob";

interface VoiceOverlayProps {
  isVisible:    boolean;
  isRecording:  boolean;
  audioLevel?:  number;
  personaName?: string | undefined;
  language?:    string | undefined;
  onRelease:    () => void;
}

export function VoiceOverlay({
  isVisible,
  isRecording,
  personaName,
  language,
  onRelease,
}: VoiceOverlayProps) {
  if (!isVisible) return null;

  return (
    <div
      style={{
        position:        "fixed",
        inset:           0,
        zIndex:          100,
        display:         "flex",
        flexDirection:   "column",
        alignItems:      "center",
        justifyContent:  "center",
        background:      "rgba(5,2,8,0.88)",
        backdropFilter:  "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        animation:       "overlayIn 0.18s ease",
      }}
      onMouseUp={onRelease}
      onTouchEnd={e => { e.preventDefault(); onRelease(); }}
    >
      <style>{`
        @keyframes overlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes ringPulse {
          0%, 100% { transform: scale(1);   opacity: 0.30; }
          50%       { transform: scale(1.18); opacity: 0.08; }
        }
      `}</style>

      {/* Outer pulse ring */}
      <div style={{
        position: "absolute",
        width: 260, height: 260,
        borderRadius: "50%",
        border: "1.5px solid rgba(168,85,247,0.3)",
        animation: isRecording ? "ringPulse 1.6s ease-in-out infinite" : "none",
        pointerEvents: "none",
      }} />

      {/* Inner glow orb */}
      <div style={{
        position:     "absolute",
        width:        180, height: 180,
        borderRadius: "50%",
        background:   "radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 70%)",
        filter:       "blur(32px)",
        pointerEvents: "none",
        animation:    isRecording ? "ringPulse 2s ease-in-out infinite 0.4s" : "none",
      }} />

      {/* Persona initial badge */}
      {personaName && (
        <div style={{
          width:          44, height: 44, borderRadius: "50%",
          background:     "linear-gradient(135deg, #7c3aed, #a855f7)",
          display:        "grid", placeItems: "center",
          color:          "#fff", fontSize: 16, fontWeight: 600,
          boxShadow:      "0 0 24px rgba(168,85,247,0.5)",
          marginBottom:   20,
          position:       "relative",
        }}>
          {personaName.charAt(0)}
        </div>
      )}

      {/* WaveBlob waveform */}
      <div style={{ position: "relative" }}>
        <WaveBlob speaking={isRecording} width={280} height={90} accentHue={280} />
      </div>

      {/* Status text */}
      <div style={{ marginTop: 20, textAlign: "center" }}>
        <p style={{
          fontSize: 15, fontWeight: 500, color: "#e9d5ff",
          letterSpacing: "-0.01em",
        }}>
          {isRecording ? "Listening…" : "Processing…"}
        </p>
        {language && (
          <p style={{ fontSize: 11.5, color: "rgba(192,132,252,0.5)", marginTop: 4 }}>
            {language}
          </p>
        )}
      </div>

      {/* Release hint */}
      <div style={{
        position:   "absolute",
        bottom:     40,
        fontSize:   12,
        color:      "rgba(255,255,255,0.2)",
        letterSpacing: ".04em",
      }}>
        Release to send
      </div>
    </div>
  );
}
