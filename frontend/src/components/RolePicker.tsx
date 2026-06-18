import { useState } from "react";
import { type AppView } from "../App";

interface Props {
  onSelect: (role: AppView) => void;
}

const ROLES = [
  {
    id: "consumer" as AppView,
    icon: "🛒",
    title: "Klient",
    tagline: "Odbierz swoją kaucję",
    description:
      "Kupiłeś napój w butelce z kaucją? Powiąż portfel z opakowaniem i odbierz pieniądze po oddaniu go w sklepie.",
    steps: ["Połącz portfel", "Kup opakowanie", "Oddaj w sklepie", "Odbierz kaucję"],
    accent: "#059669",
    accentBg: "#ECFDF5",
    accentBorder: "rgba(5,150,105,0.22)",
  },
  {
    id: "store" as AppView,
    icon: "🏪",
    title: "Sklep",
    tagline: "Przyjmuj zwroty i rozliczaj",
    description:
      "Akceptujesz puste opakowania od klientów. Każdy zwrot trafia na blockchain — bez papierów, bez czekania.",
    steps: ["Połącz portfel", "Przyjmij zwrot", "Rozlicz się"],
    accent: "#D97706",
    accentBg: "#FFFBEB",
    accentBorder: "rgba(217,119,6,0.22)",
  },
  {
    id: "producer" as AppView,
    icon: "🏭",
    title: "Producent",
    tagline: "Rejestruj opakowania",
    description:
      "Wprowadzasz produkty na rynek. Każde zarejestrowane opakowanie blokuje kaucję w transparentnym skarbcu.",
    steps: ["Połącz portfel", "Zarejestruj opakowanie"],
    accent: "#111827",
    accentBg: "#F9FAFB",
    accentBorder: "#D4D3CF",
  },
] as const;

export function RolePicker({ onSelect }: Props) {
  const [hovered, setHovered] = useState<AppView | null>(null);

  return (
    <div
      style={{
        height: "100%",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        overflow: "auto",
      }}
    >
      {/* Logo */}
      <div style={{ marginBottom: 52, textAlign: "center" }}>
        <div
          style={{
            fontFamily: "Space Grotesk, sans-serif",
            fontWeight: 700,
            fontSize: 22,
            color: "var(--ink)",
            letterSpacing: "-0.02em",
          }}
        >
          Bottleneck
        </div>
        <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 4 }}>
          system kaucji on-chain · devnet
        </div>
      </div>

      {/* Heading */}
      <div
        style={{
          fontFamily: "Space Grotesk, sans-serif",
          fontWeight: 700,
          fontSize: 28,
          color: "var(--ink)",
          marginBottom: 8,
          letterSpacing: "-0.02em",
        }}
      >
        Kim jesteś?
      </div>
      <div
        style={{
          fontSize: 14,
          color: "var(--muted)",
          marginBottom: 40,
          textAlign: "center",
          maxWidth: 400,
          lineHeight: 1.55,
        }}
      >
        Wybierz swoją rolę — interfejs w pełni dostosuje się do Twoich potrzeb.
      </div>

      {/* Role cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
          width: "100%",
          maxWidth: 840,
        }}
      >
        {ROLES.map((role) => {
          const isHovered = hovered === role.id;
          return (
            <button
              key={role.id}
              onClick={() => onSelect(role.id)}
              onMouseEnter={() => setHovered(role.id)}
              onMouseLeave={() => setHovered(null)}
              style={{
                background: isHovered ? role.accentBg : "var(--surface)",
                border: `1.5px solid ${isHovered ? role.accentBorder : "var(--border)"}`,
                borderRadius: 16,
                padding: "28px 24px 24px",
                textAlign: "left",
                cursor: "pointer",
                transition: "border-color 0.15s ease, background 0.15s ease, transform 0.12s ease, box-shadow 0.15s ease",
                transform: isHovered ? "translateY(-2px)" : "none",
                boxShadow: isHovered
                  ? `0 8px 24px rgba(0,0,0,0.08), 0 0 0 3px ${role.accentBorder}`
                  : "var(--shadow-sm)",
              }}
            >
              {/* Title */}
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontFamily: "Space Grotesk, sans-serif",
                    fontWeight: 700,
                    fontSize: 17,
                    color: "var(--ink)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {role.title}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: isHovered ? role.accent : "var(--muted)",
                    fontWeight: 500,
                    marginTop: 2,
                    transition: "color 0.15s ease",
                  }}
                >
                  {role.tagline}
                </div>
              </div>

              {/* Description */}
              <p
                style={{
                  fontSize: 12.5,
                  color: "var(--muted)",
                  lineHeight: 1.6,
                  marginBottom: 20,
                  minHeight: 56,
                }}
              >
                {role.description}
              </p>

              {/* Steps preview */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {role.steps.map((step, i) => (
                  <div key={step} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontSize: 10,
                      fontFamily: "IBM Plex Mono, monospace",
                      color: "var(--faint)",
                      fontWeight: 500,
                      minWidth: 12,
                    }}>
                      {i + 1}.
                    </span>
                    <span style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      fontFamily: "Space Grotesk, sans-serif",
                      fontWeight: 500,
                    }}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div
                style={{
                  marginTop: 22,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontFamily: "Space Grotesk, sans-serif",
                    fontWeight: 700,
                    color: isHovered ? role.accent : "var(--faint)",
                    transition: "color 0.15s ease",
                  }}
                >
                  Wybierz tę rolę →
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Dashboard link */}
      <button
        onClick={() => onSelect("dashboard")}
        style={{
          marginTop: 28,
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 12,
          color: "var(--faint)",
          fontFamily: "Space Grotesk, sans-serif",
          padding: "4px 8px",
          transition: "color 0.15s ease",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--muted)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--faint)")}
      >
        Panel operatora / podgląd systemu →
      </button>
    </div>
  );
}
