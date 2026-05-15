"use client";
import Link from "next/link";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-dvh flex items-center justify-center px-6 bg-paper text-center">
      <div>
        <p className="text-4xl mb-4">💥</p>
        <h1 className="text-xl font-semibold text-ink mb-2">Something went wrong</h1>
        <p className="text-sm text-muted mb-6">Your sessions are safe. This is just a display issue.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="btn-primary text-sm">Try again</button>
          <Link href="/dashboard" className="btn-secondary text-sm">Dashboard</Link>
        </div>
      </div>
    </div>
  );
}