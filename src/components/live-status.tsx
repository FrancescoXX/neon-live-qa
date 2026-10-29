const ORDER = ["error", "closed", "stale", "connecting", "live"] as const;

export type LiveStatusName = (typeof ORDER)[number];

const LABEL: Record<LiveStatusName, string> = {
  error: "Stopped",
  closed: "Closed",
  stale: "Reconnecting",
  connecting: "Connecting",
  live: "Live",
};

export function worstStatus(a: string, b: string): LiveStatusName {
  const rank = (status: string) => {
    const index = ORDER.indexOf(status as LiveStatusName);
    return index === -1 ? 0 : index;
  };
  return rank(a) <= rank(b) ? (a as LiveStatusName) : (b as LiveStatusName);
}

export function LiveStatus({ status }: { status: LiveStatusName }) {
  const live = status === "live";
  return (
    <p
      role="status"
      className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-xs font-semibold tracking-wide uppercase"
    >
      <span
        className={`size-2 rounded-full ${live ? "live-dot bg-live" : status === "error" ? "bg-accent" : "bg-warn"}`}
      />
      {LABEL[status]}
    </p>
  );
}
