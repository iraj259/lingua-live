import type { Metadata } from "next";
import { Sora, JetBrains_Mono, Unbounded } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import "../globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
  weight: ["200", "300", "400", "500", "600"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  weight: ["400", "500"],
});

const unbounded = Unbounded({
  subsets: ["latin"],
  variable: "--font-unbounded",
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: { default: "Lingua Live", template: "%s | Lingua Live" },
  description: "Practice real conversations with an AI language tutor. Speak or type. No judgment — just progress.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${jetbrains.variable} ${unbounded.variable}`}>
      <body className="font-sans antialiased" style={{ background: "var(--bg-0)", color: "var(--ink)" }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
