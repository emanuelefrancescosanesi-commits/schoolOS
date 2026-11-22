import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/data/session";
import { createClient } from "@/lib/supabase/server";

/** Esporta in JSON tutti i dati dell'utente (diritto alla portabilità, art. 20 GDPR). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Non autenticato", { status: 401 });
  const supabase = await createClient();
  const tables = ["profiles", "school_years", "periods", "subjects", "grades", "assignments", "todo_projects", "todo_labels", "todos", "todo_label_links", "events", "inbox_messages"] as const;
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), email: user.email };
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select("*");
    // Tabella di una migrazione non ancora applicata: nessun dato da esportare.
    if (error?.code === "PGRST205" || error?.code === "42P01") {
      out[t] = [];
      continue;
    }
    if (error) return new NextResponse("Esportazione non riuscita", { status: 500 });
    out[t] = data;
  }
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="schoolos-i-miei-dati.json"',
      "Cache-Control": "no-store",
    },
  });
}
