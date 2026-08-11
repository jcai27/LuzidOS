import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import NavLinks from "./_components/NavLinks";

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
  description: "Launch and monitor AI agents that work in SAP for you",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink text-white">
        <header className="border-b border-panel-border px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold tracking-tight text-base">Luzid</span>
            <span className="text-slate/50 text-sm hidden sm:inline">SAP Agent Console</span>
          </div>
          <NavLinks />
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
