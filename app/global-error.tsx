"use client";

/** Ultima rete di sicurezza: errore nel layout radice. Sostituisce l'intero documento, quindi stili in linea. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="it">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          textAlign: "center",
          background: "#fafafb",
          color: "#12141a",
        }}
      >
        <main role="alert" style={{ maxWidth: 360 }}>
          <h1 style={{ fontSize: 22 }}>Qualcosa è andato storto</h1>
          <p style={{ color: "#5f6675", lineHeight: 1.5 }}>Non siamo riusciti a caricare SchoolOS. Riprova tra un attimo.</p>
          <button
            type="button"
            onClick={reset}
            style={{ minHeight: 44, padding: "0 20px", border: 0, borderRadius: 10, background: "#4f46e5", color: "#fff", fontSize: 16 }}
          >
            Riprova
          </button>
        </main>
      </body>
    </html>
  );
}
