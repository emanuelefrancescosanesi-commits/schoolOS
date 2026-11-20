# App per telefono con login al registro — fattibilità e rischi

Obiettivo (Emanuele, 20/11): lo studente apre SchoolOS, fa **solo il login al registro** (Axios per primo, poi ClasseViva/Argo) e i voti compaiono. Niente estensione, ZIP, codici, SQL. L'estensione Chrome resta un extra per PC e non viene più rifinita.

## Decisione

App **Capacitor** (iOS + Android) che carica SchoolOS e apre il registro in una **webview nativa gestita dall'app**. Dopo il login, un piccolo script iniettato legge la pagina voti, la manda all'app, e l'app la invia a SchoolOS con la sessione già attiva (`sync_my_grades`, nuova). Le credenziali restano nella webview del dispositivo (cookie di sessione): **non passano mai dai nostri server e non le vediamo**.

```
SchoolOS (Capacitor)  ──apre──▶  webview registro (Axios)   ← l'utente fa login qui, solo qui
        ▲                              │ script iniettato legge la griglia voti
        └──── messageFromWebview ──────┘ (solo materia/data/voto/tipo/peso)
        │
        └─ server action ─▶ rpc sync_my_grades(rows) ─▶ voti nel database (RLS, utente = sessione)
```

## 1. Fattibilità tecnica

| Punto | Esito |
|---|---|
| Leggere il DOM di un sito di terzi | **Sì, solo con webview nativa gestita dall'app.** iOS: `WKWebView.evaluateJavaScript`/`WKUserScript`; Android: `WebView.evaluateJavascript`. L'iniezione ignora la CSP della pagina. Non funziona con `@capacitor/browser` (SFSafariViewController / Custom Tabs): per design non permette script né lettura. Nemmeno con un `<iframe>` (X-Frame-Options, same-origin). |
| Plugin | `@capgo/inappbrowser` (Capacitor ≥ 8): `openWebView`, `executeScript`, evento `messageFromWebview` (`window.mobileApp.postMessage`), webview nascosta (`hidden`), dati persistenti (`persistWebViewData`). In alternativa `cordova-plugin-inappbrowser`; come ultima spiaggia un plugin nostro (~150 righe per piattaforma). Nessun lock-in: il codice usa un'interfaccia sottile (`lib/registry/bridge.ts`). |
| Sessione ricordata | Cookie persistenti nella webview: dalla seconda volta il login non serve finché il registro non fa scadere la sessione. 2FA/captcha funzionano perché l'utente è sulla pagina vera. |
| Aggiornamento all'apertura | Webview **nascosta** → pagina voti → lettura → chiusura. Se la sessione è scaduta si mostra la webview per rifare il login. |
| Background | **iOS: non fattibile in modo affidabile** (nessuna webview in background, BGAppRefresh dà ~30 s non garantiti). Android: idem per le webview. Quindi **aggiornamento solo quando l'app è aperta**; nessuna notifica push “nuovo voto” senza credenziali sul server. Va detto chiaramente nell'app. |
| Regole di lettura aggiornabili | `GET /api/registry-rules`: JSON **dichiarativo** (selettori, formati data, mappa tipi) + motore fisso `public/registry/engine.js`, serviti dal sito. Se Axios cambia l'HTML si corregge il JSON, senza nuova release. Interruttore per registro (`enabled:false`) per spegnere subito un parser rotto. |
| Peso del voto | Letto come nell'estensione (es. Biologia 8 peso 0,5): `weight` già gestito dal database. |
| Pagine non verificate | Il fetch dalla home Axios (riquadro «Voti») non è confermato su pagina vera: l'estensione registra `hrefKind`. Il motore prova (1) griglia già in pagina, (2) fetch dell'href, (3) click sul riquadro e rilettura. ClasseViva/Argo: serve una pagina vera (anche anonimizzata) prima di scrivere il parser. |

## 2. Regole Apple / Google

**Apple (App Store Review Guidelines)**
- **4.2 Minimum functionality**: un guscio che mostra solo un sito viene respinto. Il sito carica da `server.url` ma l'app ha funzione nativa reale (lettura del registro, sessione, notifiche locali). Mitigazione: funzioni native visibili e, se serve, bundle locale. **Rischio medio.**
- **2.5.2 codice scaricato**: gli script non cambiano lo scopo dell'app; le regole sono dati. Il motore è lo stesso per tutti i registri. Se richiesto, il motore passa nel bundle dell'app e si versiona. **Rischio basso-medio.**
- **5.1.1(v) cancellazione account**: obbligatoria dentro l'app (c'è la registrazione). **Da costruire prima della pubblicazione.**
- **4.8 Login con terzi**: se si aggiunge «Accedi con Google» serve offrire anche Sign in with Apple (o equivalente). Non riguarda il login al registro (non crea l'account SchoolOS).
- **Review**: i revisori non hanno un account Axios. Servono note di review, video del flusso e una **modalità demo** (esiste `lib/demo`).
- Privacy nutrition label + informativa; minori (14–19): non è categoria Kids, ma 5.1.4 impone cautela.
- Costo: 99 $/anno. Per un account **organizzazione** serve D-U-N-S; per i dati di minori è preferibile alla persona fisica.

**Google Play**
- Webview con login di terze parti: lecito se l'utente vede **sempre l'indirizzo reale** del registro e non c'è auto-compilazione o raccolta delle credenziali (policy su phishing/comportamento ingannevole). Barra con dominio sempre visibile.
- Modulo **Data safety**, link di cancellazione account/dati sul web, informativa.
- Account personale nuovo: test chiuso con **12 tester per 14 giorni** prima della produzione (da riverificare in Play Console). Pesa sui tempi.
- Costo: 25 $ una tantum.
- Target d'età dichiarato 13+; con utenti under 14 serve il consenso dei genitori (età del consenso digitale in Italia: 14 anni).

## 3. Condizioni d'uso dei registri e legale

- **Axios**: non ho trovato condizioni d'uso del Registro Famiglie sull'accesso automatizzato. Le licenze software ad Axios (stipulate con le scuole) vietano l'accesso al database da parte di terzi non autorizzati «se non tramite le procedure previste». Non è chiaro se un'app che legge la pagina con le credenziali dell'utente sul suo telefono ricada nel divieto. **Non è verificato e non lo trasformo in un “va bene”.**
- **Spaggiari (ClasseViva) e Argo**: da verificare separatamente; ClasseViva è noto per essere restrittivo sulle API non ufficiali.
- Cosa riduce il rischio: letture solo a richiesta dell'utente e all'apertura dell'app, una pagina per volta, dal dispositivo dell'utente (la sua rete, la sua sessione), nessuna credenziale sul server, nessuna scansione massiva.
- Cosa NON lo elimina: finché non c'è un accordo, il registro può bloccarci (WAF/anti-bot, UA, markup) o contestarci le condizioni. **Prima del lancio pubblico: scrivere ad Axios, Spaggiari e Argo per autorizzazione/partnership.** Avvocato per termini, informativa e DPIA (dati scolastici di minori).
- GDPR: titolare = SchoolOS; trattiamo solo materia/data/voto/tipo/peso (mai credenziali, mai altri dati del registro); l'utente può cancellare tutto.

## 4. Sicurezza

- La pagina del registro può chiamare `window.mobileApp.postMessage`: i messaggi sono **non attendibili**. L'app li valida con schema rigido (max 300 righe, tipi e lunghezze) e il database rivalida (`sync_grades_for`). Un messaggio falso può solo aggiungere voti falsi al proprio account.
- Navigazione della webview limitata ai domini del registro (lista nelle regole, con controllo anche nell'app).
- `sync_grades_for` non è chiamabile dal client; `sync_my_grades` richiede la sessione (`auth.uid()`).
- «Esci dal registro» cancella i cookie della webview.

## 5. Cosa serve a Emanuele, e quando

- **Ora**: dirmi se ha Android o iPhone. Per Android posso far costruire ogni volta un **APK di prova** (GitHub Actions) da installare, senza account store. Per iPhone la prova richiede l'account Apple (99 $/anno, TestFlight).
- **Alla pubblicazione**: account Apple (99 $/anno) e Google (25 $), scelta persona fisica/organizzazione, contatto con i registri.

## 6. Piano a PR piccole

1. Questa analisi + `sync_my_grades` (sync con la sessione, senza codice) + test DB.
2. Motore di lettura dichiarativo, regole Axios, `/api/registry-rules`, test su pagine di prova.
3. Capacitor (Android + iOS), ponte con la webview, schermata «Collega il registro», APK di prova da CI.
4. Cancellazione account, modalità demo per la review, regole ClasseViva/Argo con pagine vere.
