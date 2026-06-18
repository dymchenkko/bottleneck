export interface OnboardingStep {
  label: string;
  hint: string;
  done: boolean;
}

interface Props {
  steps: OnboardingStep[];
  onDismiss: () => void;
}

export function Onboarding({ steps, onDismiss }: Props) {
  const allDone = steps.every((s) => s.done);
  const activeIdx = allDone
    ? steps.length - 1
    : steps.findIndex((s) => !s.done);

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: "18px 22px 20px",
        marginBottom: 20,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Top row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
        }}
      >
        <div
          style={{
            fontFamily: "Space Grotesk, sans-serif",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: allDone ? "var(--mint)" : "var(--muted)",
          }}
        >
          {allDone ? "✓ Wszystko gotowe!" : "Jak zacząć"}
        </div>
        <button
          onClick={onDismiss}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "3px 9px",
            fontSize: 11,
            color: "var(--faint)",
            cursor: "pointer",
            fontFamily: "Space Grotesk, sans-serif",
            transition: "color 0.12s, border-color 0.12s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--muted)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border-mid)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--faint)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
          }}
        >
          Zamknij
        </button>
      </div>

      {/* Step track */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
        {steps.map((step, i) => {
          const isActive = i === activeIdx;
          const isDone = step.done;
          return (
            <div
              key={i}
              style={{ display: "flex", alignItems: "flex-start", flex: 1, minWidth: 0 }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 0 }}>
                {/* Node */}
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: isDone
                      ? "var(--mint)"
                      : isActive
                      ? "var(--ink)"
                      : "var(--border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "background 0.2s ease",
                    boxShadow: isActive ? "0 0 0 3px var(--mint-ring)" : "none",
                  }}
                >
                  {isDone ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: isActive ? "#fff" : "var(--faint)",
                        fontFamily: "IBM Plex Mono, monospace",
                      }}
                    >
                      {i + 1}
                    </span>
                  )}
                </div>

                {/* Label */}
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 10.5,
                    fontFamily: "Space Grotesk, sans-serif",
                    fontWeight: isActive ? 700 : 500,
                    color: isDone
                      ? "var(--mint)"
                      : isActive
                      ? "var(--ink)"
                      : "var(--faint)",
                    textAlign: "center",
                    lineHeight: 1.3,
                    padding: "0 4px",
                    transition: "color 0.2s ease",
                  }}
                >
                  {step.label}
                </div>
              </div>

              {/* Connector */}
              {i < steps.length - 1 && (
                <div
                  style={{
                    height: 2,
                    flex: 1,
                    background: step.done ? "var(--mint)" : "var(--border)",
                    marginTop: 11,
                    borderRadius: 1,
                    transition: "background 0.3s ease",
                    opacity: step.done ? 0.6 : 1,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Active step hint */}
      {!allDone && (
        <div
          style={{
            marginTop: 16,
            background: "var(--bg)",
            borderRadius: 8,
            padding: "10px 14px",
            fontSize: 12,
            color: "var(--muted)",
            lineHeight: 1.55,
            borderLeft: "3px solid var(--mint)",
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--ink)" }}>
            Krok {activeIdx + 1}:{" "}
          </span>
          {steps[activeIdx]?.hint}
        </div>
      )}
    </div>
  );
}
