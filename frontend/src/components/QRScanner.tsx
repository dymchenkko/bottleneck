import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";

interface Props {
  onScan: (id: string) => void;
  onClose: () => void;
}

function extractId(raw: string): string {
  const s = raw.trim();
  // plain number (EAN-13, container ID, etc.)
  if (/^\d+$/.test(s)) return s;
  // URL with number: /container/42, ?id=42, #42
  const m = s.match(/[/#?=&](\d{1,13})\b/);
  if (m) return m[1];
  const d = s.match(/\d+/);
  return d ? d[0] : s;
}

export function QRScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    reader
      .decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current!,
        (result, error) => {
          if (result) {
            onScan(extractId(result.getText()));
          } else if (error && !error.message?.includes("No MultiFormat")) {
            console.warn("scan error", error);
          }
        }
      )
      .catch((e) => {
        setErr(e?.message?.includes("Permission")
          ? "Brak dostępu do kamery. Zezwól w ustawieniach przeglądarki."
          : "Nie można uruchomić kamery.");
      });

    return () => {
      // stop camera stream
      const video = videoRef.current;
      if (video?.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        video.srcObject = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.88)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 16,
    }}>
      <div style={{ position: "relative", width: "min(92vw, 380px)" }}>
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ width: "100%", borderRadius: 12, display: "block", background: "#111", minHeight: 200 }}
        />
        {/* viewfinder corners */}
        {(["tl","tr","bl","br"] as const).map(pos => (
          <div key={pos} style={{
            position: "absolute",
            width: 28, height: 28,
            borderColor: "var(--mint)",
            borderStyle: "solid",
            borderWidth: 0,
            ...(pos === "tl" ? { top: 10, left: 10, borderTopWidth: 3, borderLeftWidth: 3, borderRadius: "4px 0 0 0" } : {}),
            ...(pos === "tr" ? { top: 10, right: 10, borderTopWidth: 3, borderRightWidth: 3, borderRadius: "0 4px 0 0" } : {}),
            ...(pos === "bl" ? { bottom: 10, left: 10, borderBottomWidth: 3, borderLeftWidth: 3, borderRadius: "0 0 0 4px" } : {}),
            ...(pos === "br" ? { bottom: 10, right: 10, borderBottomWidth: 3, borderRightWidth: 3, borderRadius: "0 0 4px 0" } : {}),
          }} />
        ))}
      </div>

      {err ? (
        <p style={{ color: "#f87171", fontSize: 13, fontFamily: "IBM Plex Mono, monospace", textAlign: "center", padding: "0 24px", margin: 0 }}>
          {err}
        </p>
      ) : (
        <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, fontFamily: "Space Grotesk, sans-serif", margin: 0, textAlign: "center" }}>
          Skieruj kamerę na <strong style={{ color: "#fff" }}>kod kreskowy lub QR</strong> z butelki
        </p>
      )}

      <button
        onClick={onClose}
        style={{
          background: "rgba(255,255,255,0.1)", color: "#fff",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 8, padding: "10px 28px",
          fontFamily: "Space Grotesk, sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer",
        }}
      >
        Zamknij
      </button>
    </div>
  );
}
