"use client";

export function Aurora({ intensity = 1 }: { intensity?: number }) {
  const op = Math.min(1, Math.max(0, intensity));
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        opacity: op,
      }}
    >
      {/* Orb A — violet, top-left drift */}
      <div
        className="aurora"
        style={{
          width: "65vw",
          height: "65vw",
          maxWidth: 900,
          maxHeight: 900,
          left: "-10%",
          top: "-15%",
          background: "radial-gradient(circle, #7c3aed 0%, transparent 65%)",
          animation: "drift-a 22s ease-in-out infinite",
        }}
      />
      {/* Orb B — magenta, right */}
      <div
        className="aurora"
        style={{
          width: "55vw",
          height: "55vw",
          maxWidth: 780,
          maxHeight: 780,
          right: "-12%",
          top: "5%",
          background: "radial-gradient(circle, #d946ef 0%, transparent 65%)",
          animation: "drift-b 26s ease-in-out infinite",
        }}
      />
      {/* Orb C — deep violet, bottom */}
      <div
        className="aurora"
        style={{
          width: "50vw",
          height: "50vw",
          maxWidth: 700,
          maxHeight: 700,
          left: "20%",
          bottom: "-20%",
          background: "radial-gradient(circle, #4c1d95 0%, transparent 65%)",
          animation: "drift-c 30s ease-in-out infinite",
        }}
      />
    </div>
  );
}
