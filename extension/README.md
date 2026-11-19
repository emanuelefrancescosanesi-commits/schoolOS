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
Solo PC. Sincronizzazione automatica solo su Axios, quando apri la pagina voti (non in background con il registro chiuso). Chrome/Edge; Firefox da adattare.

## Sincronizzazione automatica (Axios)
1. In SchoolOS: Voti → Importa dal registro → «Collega l'estensione» → crea il codice.
2. Opzioni dell'estensione → incolla il codice → Salva codice.
3. Da ora, ogni volta che apri la pagina voti di Axios l'estensione manda i voti nuovi a SchoolOS (nessun clic). Il codice è revocabile da SchoolOS.

Permessi in più rispetto al clic manuale: lettura delle pagine `*.axioscloud.it` (solo per leggere la griglia voti) e invio a Supabase.
