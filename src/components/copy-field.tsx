"use client";

import { useState } from "react";

export function CopyField({
  label,
  value,
  copyValue,
}: {
  label: string;
  value: string;
  copyValue?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const text = copyValue ?? value;
    const absolute = text.startsWith("http://") || text.startsWith("https://") ? text : new URL(text, window.location.origin).href;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">{label}</p>
      <div className="flex gap-2">
        <input
          readOnly
          value={value}
          aria-label={label}
          className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2 font-mono text-sm break-all"
          onFocus={(event) => event.currentTarget.select()}
        />
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 rounded-xl border border-ink px-3 py-2 text-sm font-semibold"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
