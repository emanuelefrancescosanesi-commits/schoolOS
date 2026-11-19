/**
 * Pulizia del testo uscito dall'OCR, prima di darlo al parser.
 *
 * Gli errori tipici misurati su screenshot di prova: il simbolo ½ viene letto come "%" o "1/2",
 * le tabelle lasciano barre verticali spurie ("|"), e i caratteri "−" e "–" possono essere
 * confusi tra loro. Qui si correggono solo errori certi: in un voto "%" non può significare altro.
 */
export function cleanOcrText(raw: string): string {
  return raw
    .replace(/\r/g, "")
    // Solo dopo un voto plausibile (0–9): "50%" in un argomento resta com'è.
    .replace(/(?<![\d.,])([0-9])\s?%(?!\w)/g, "$1½")
    .replace(/(?<=\d)\s?1\/2(?![\d/])/g, "½")
    .replace(/(?<=\s|^)[|¦!](?=\s)/gm, " ")
    .replace(/[−–—](?=\s|$)/g, "-")
    .replace(/[ \t]+$/gm, "")
    .trim();
}
