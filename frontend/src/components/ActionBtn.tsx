import { type ReactNode } from "react";

interface Props {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  children: ReactNode;
  fullWidth?: boolean;
}

export function ActionBtn({
  onClick,
  loading,
  disabled,
  variant = "primary",
  children,
  fullWidth,
}: Props) {
  const bg =
    variant === "primary"
      ? "var(--mint)"
      : variant === "danger"
      ? "var(--danger)"
      : "var(--bg)";
  const color =
    variant === "primary" || variant === "danger"
      ? "#fff"
      : "var(--ink)";

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        background: bg,
        color,
        border: "none",
        borderRadius: 8,
        padding: "9px 16px",
        fontFamily: "Space Grotesk, sans-serif",
        fontWeight: 600,
        fontSize: 13,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled || loading ? 0.5 : 1,
        transition: "opacity 0.15s ease",
        width: fullWidth ? "100%" : undefined,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      {loading ? "…" : children}
    </button>
  );
}
