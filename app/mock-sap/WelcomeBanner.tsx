"use client";

import { useState } from "react";

export default function WelcomeBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="absolute top-0 right-6 bg-white border border-slate-300 shadow-lg rounded-lg p-4 w-72 text-sm">
      <p className="font-medium mb-1">Welcome to Northwind Demo ERP</p>
      <p className="text-slate-500 text-xs mb-3">
        This test tenant may be reset at any time. Continue to log in below.
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="text-xs bg-slate-800 text-white px-3 py-1.5 rounded hover:bg-slate-700"
      >
        Dismiss
      </button>
    </div>
  );
}
