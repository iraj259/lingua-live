import Link from "next/link";
export default function NotFound() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-6 bg-paper text-center">
      <div>
        <p className="font-mono text-6xl font-bold text-border mb-4">404</p>
        <h1 className="text-xl font-semibold text-ink mb-2">Page not found</h1>
        <p className="text-sm text-muted mb-6">This page doesn&apos;t exist or has been moved.</p>
        <Link href="/dashboard" className="btn-primary text-sm">Go to dashboard</Link>
      </div>
    </div>
  );
}