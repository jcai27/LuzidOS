import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Northwind Demo ERP",
};

/**
 * A deliberately generic, non-SAP-branded mock ERP used only as a stand-in
 * test target while the real SAP sandbox credentials were unavailable.
 * This is its own Next.js root layout (separate <html>/<body> from the
 * Luzid console in app/(console)/layout.tsx) so it doesn't inherit the
 * console's nav/branding — it needs to read as an unrelated system to
 * both a human watching the demo and the agent navigating it.
 */
export default function MockSapLayout({ children }: LayoutProps<"/mock-sap">) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased">
        <header className="bg-slate-800 text-white px-6 py-3 flex items-center justify-between">
          <span className="font-semibold">Northwind Demo ERP</span>
          <span className="text-xs text-slate-400">Test sandbox — not affiliated with SAP</span>
        </header>
        {children}
        <footer className="max-w-3xl mx-auto px-6 py-8 text-xs text-slate-400">
          This is a stand-in test environment used for automated-agent evidence capture, not a
          real ERP system.
        </footer>
      </body>
    </html>
  );
}
