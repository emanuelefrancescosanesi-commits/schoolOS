# Estensione «Importa voti»

Legge la pagina del registro **già aperta e loggata** e la porta in SchoolOS. Nessuna password, nessun server intermedio: il testo viaggia nel frammento dell'URL (dopo `#`).

## Installazione (sviluppo)
- Chrome/Edge: `chrome://extensions` → Modalità sviluppatore → «Carica estensione non pacchettizzata» → cartella `extension/`.
- Firefox: `about:debugging` → «Carica componente aggiuntivo temporaneo» → `manifest.json`.
- Apri Impostazioni dell'estensione e inserisci l'indirizzo della tua app SchoolOS.

## Uso
Apri la pagina dei voti del registro, clicca l'icona, «Importa questa pagina».

## Permessi
Solo `activeTab` (la scheda su cui clicchi), `scripting` e `storage` (l'indirizzo dell'app). Nessun accesso ai siti in background.

## Limiti
Solo PC. Lettura a richiesta, non ancora automatica in background (prossimo passo).
