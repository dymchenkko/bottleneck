interface Props {
  sig: string;
}

export function TxLink({ sig }: Props) {
  return (
    <a
      href={`https://explorer.solana.com/tx/${sig}?cluster=devnet`}
      target="_blank"
      rel="noreferrer"
      style={{
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: 11,
        color: "var(--mint)",
        wordBreak: "break-all",
        display: "block",
        marginTop: 6,
      }}
    >
      {sig.slice(0, 8)}…{sig.slice(-8)} ↗
    </a>
  );
}
