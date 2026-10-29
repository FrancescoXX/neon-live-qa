import type { Metadata } from "next";
import type { ReactNode } from "react";

// The host token lives in the query string. Keep that URL out of search indexes
// and out of the Referer header when the browser requests another origin.
export const metadata: Metadata = {
  title: "Host · Live Q&A",
  robots: { index: false, follow: false },
  referrer: "same-origin",
};

export default function HostLayout({ children }: { children: ReactNode }) {
  return children;
}
