import { type FeedEvent, type FeedRole } from "../useActivityFeed";

interface Props {
  events: FeedEvent[];
  relativeTime: (ts: number) => string;
  loading?: boolean;
  role?: FeedRole;
}

const TYPE_COLOR: Record<string, string> = {
  registered: "var(--mint)",
  purchased:  "var(--mint)",
  returned:   "var(--mint)",
  claimed:    "var(--mint)",
  settled:    "var(--amber)",
  swept:      "var(--amber)",
};

const EMPTY_HINT: Record<string, string> = {
  consumer: "Brak aktywności klienta.",
  store:    "Brak zwrotów ani rozliczeń.",
  producer: "Brak rejestracji ani windykacji.",
  all:      "Brak aktywności —\nzarejestruj pierwsze opakowanie.",
};

const LABEL: Record<string, string> = {
  consumer: "Dziennik klienta",
  store:    "Dziennik sklepu",
  producer: "Dziennik producenta",
  all:      "Dziennik aktywności",
};

export function ActivityFeed({ events, relativeTime, loading, role }: Props) {
  const filtered = role ? events.filter(e => e.role === role) : events;
  const label = role ? LABEL[role] : LABEL.all;
  const emptyHint = role ? EMPTY_HINT[role] : EMPTY_HINT.all;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        padding: "14px 18px 12px",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "var(--surface)",
      }}>
        <span style={{
          fontFamily: "Space Grotesk, sans-serif",
          fontSize: 11, fontWeight: 700,
          letterSpacing: "0.08em", textTransform: "uppercase",
          color: "var(--muted)",
        }}>
          {label}
        </span>
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: "var(--mint)",
          animation: "feed-pulse 2s infinite",
        }} />
        {filtered.length > 0 && (
          <span style={{
            marginLeft: "auto", fontSize: 10,
            fontFamily: "IBM Plex Mono, monospace",
            color: "var(--faint)",
          }}>
            {filtered.length}
          </span>
        )}
      </div>

      {/* Events */}
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
        {loading && filtered.length === 0 ? (
          <div style={{
            padding: "36px 20px", textAlign: "center",
            color: "var(--faint)", fontSize: 12, lineHeight: 1.6,
          }}>
            Ładowanie historii…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            padding: "36px 20px", textAlign: "center",
            color: "var(--faint)", fontSize: 12, lineHeight: 1.6,
          }}>
            {emptyHint}
          </div>
        ) : (
          filtered.map(ev => (
            <div key={ev.id} style={{
              padding: "9px 18px",
              borderBottom: "1px solid var(--border)",
              display: "flex", gap: 10, alignItems: "flex-start",
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: "50%", marginTop: 4, flexShrink: 0,
                background: TYPE_COLOR[ev.type] ?? "var(--faint)",
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "IBM Plex Mono, monospace",
                  fontSize: 11, color: "var(--ink)", wordBreak: "break-word", lineHeight: 1.4,
                }}>
                  {ev.label}
                </div>
                <div style={{ fontSize: 10, color: "var(--faint)", marginTop: 2 }}>
                  {relativeTime(ev.ts)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        @keyframes feed-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.25; }
        }
      `}</style>
    </div>
  );
}
