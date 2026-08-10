import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Luzid SAP Agent Console",
  description: "Launch and monitor AI browser agents against SAP",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink text-white">
        <header className="border-b border-panel-border px-6 py-3 flex items-center gap-6">
          <Link href="/" className="font-semibold tracking-tight">
            Luzid <span className="text-slate/70 font-normal">SAP Agent Console</span>
          </Link>
          <nav className="flex gap-5 text-sm text-slate/80 font-mono uppercase tracking-wide text-xs">
            <Link href="/" className="hover:text-brand transition-colors">
              Launch
            </Link>
            <Link href="/history" className="hover:text-brand transition-colors">
              History
            </Link>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
