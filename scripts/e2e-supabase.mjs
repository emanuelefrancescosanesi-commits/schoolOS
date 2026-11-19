#!/usr/bin/env node
/**
 * Test end-to-end contro un progetto Supabase REALE (non il Postgres locale dei test).
 *
 * Crea due studenti, completa l'onboarding, inserisce voti e verifica che nessuno dei due
 * possa leggere, modificare, cancellare o agganciarsi ai dati dell'altro.
 *
 * Requisiti: "Confirm email" disattivato sul progetto (altrimenti signUp non apre la sessione).
 * Uso:
 *   NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... \
 *   E2E_EMAIL_DOMAIN=mailinator.com node scripts/e2e-supabase.mjs
 *
 * Gli utenti creati restano nel progetto (il client non può cancellare utenti):
 * eliminali da Authentication → Users. Hanno prefisso "schoolos-e2e-".
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const domain = process.env.E2E_EMAIL_DOMAIN ?? "mailinator.com";
if (!url || !key) {
  console.error("Imposta NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  process.exit(2);
}

const run = Date.now().toString(36);
let failures = 0;
const check = (name, ok, detail) => {
  if (!ok) failures++;
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? `\n    ${JSON.stringify(detail)}` : ""}`);
};

function client() {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function student(tag) {
  const sb = client();
  const email = `schoolos-e2e-${run}-${tag}@${domain}`;
  const { data, error } = await sb.auth.signUp({
    email,
    password: `E2e-${run}-${tag}-Pass!`,
    options: { data: { first_name: `Test${tag.toUpperCase()}` } },
  });
  if (error) throw new Error(`signUp ${tag}: ${error.code} ${error.message}`);
  if (!data.session) throw new Error(`signUp ${tag}: nessuna sessione. "Confirm email" è ancora attivo?`);
  return { sb, id: data.user.id, email };
}

const onboarding = (subjects) => ({
  profile: {
    first_name: "Test",
    school_name: "Liceo E2E",
    class_name: "4B",
    grade_min: 1,
    grade_max: 10,
    allow_half: true,
    allow_plus_minus: true,
    pass_threshold: 6,
    average_method: "weighted",
    registro: "classeviva",
    period_scheme: "trimestre-pentamestre",
  },
  school_year: { label: "2026/27", starts_on: "2026-09-14", ends_on: "2027-06-10" },
  periods: [
    { name: "Trimestre", starts_on: "2026-09-14", ends_on: "2026-12-22" },
    { name: "Pentamestre", starts_on: "2027-01-07", ends_on: "2027-06-10" },
  ],
  subjects: subjects.map((name, i) => ({ name, color: i + 1, teacher_name: "" })),
});

async function main() {
  const a = await student("a");
  const b = await student("b");
  check("signup A e B aprono una sessione", true);

  // Profilo creato dal trigger con il nome del signup.
  const { data: profA } = await a.sb.from("profiles").select("*").single();
  check("trigger crea il profilo con first_name", profA?.first_name === "TestA", profA);

  // Onboarding.
  const oa = await a.sb.rpc("complete_onboarding", { payload: onboarding(["Matematica", "Italiano"]) });
  const ob = await b.sb.rpc("complete_onboarding", { payload: onboarding(["Fisica"]) });
  check("onboarding A", !oa.error, oa.error);
  check("onboarding B", !ob.error, ob.error);
  const again = await a.sb.rpc("complete_onboarding", { payload: onboarding(["Storia"]) });
  check("onboarding ripetuto rifiutato", !!again.error && again.error.message.includes("già completato"), again.error);

  const { data: subjA } = await a.sb.from("subjects").select("id,name").order("position");
  const { data: subjB } = await b.sb.from("subjects").select("id,name");
  check("A vede solo le sue 2 materie", subjA?.length === 2, subjA);
  check("B vede solo la sua materia", subjB?.length === 1, subjB);

  // Voti.
  const ins = await a.sb
    .from("grades")
    .insert([
      { subject_id: subjA[0].id, value: 7.25, kind: "written", graded_on: "2026-10-05" },
      { subject_id: subjA[1].id, value: 6.5, kind: "oral", graded_on: "2026-10-12", weight: 0.5 },
    ])
    .select("*");
  check("A inserisce 2 voti (7+ e 6½)", ins.data?.length === 2 && !ins.error, ins.error);
  const gradeA = ins.data?.[0];

  const outOfScale = await a.sb.from("grades").insert({ subject_id: subjA[0].id, value: 10.5, graded_on: "2026-10-06" });
  check("voto fuori scala rifiutato", !!outOfScale.error, outOfScale.error);
  const badStep = await a.sb.from("grades").insert({ subject_id: subjA[0].id, value: 6.3, graded_on: "2026-10-06" });
  check("voto 6,3 rifiutato (solo quarti)", !!badStep.error, badStep.error);

  const insB = await b.sb.from("grades").insert({ subject_id: subjB[0].id, value: 8, graded_on: "2026-10-07" }).select("*").single();
  check("B inserisce un voto", !insB.error, insB.error);

  // ── Isolamento ──
  for (const table of ["profiles", "school_years", "periods", "subjects", "grades", "assignments"]) {
    const col = table === "profiles" ? "id" : "user_id";
    const { data, error } = await b.sb.from(table).select("*").eq(col, a.id);
    check(`B non legge ${table} di A`, !error && data.length === 0, error ?? data);
  }
  const byId = await b.sb.from("grades").select("*").eq("id", gradeA.id);
  check("B non legge un voto di A nemmeno per id", byId.data?.length === 0, byId);

  const upd = await b.sb.from("grades").update({ value: 10 }).eq("id", gradeA.id).select("*");
  check("B non modifica voti di A", !upd.error && upd.data.length === 0, upd);
  const del = await b.sb.from("grades").delete().eq("id", gradeA.id).select("*");
  check("B non cancella voti di A", !del.error && del.data.length === 0, del);
  const { data: stillThere } = await a.sb.from("grades").select("value").eq("id", gradeA.id).single();
  check("il voto di A è intatto", Number(stillThere?.value) === 7.25, stillThere);

  const hijack = await b.sb.from("grades").insert({ subject_id: subjA[0].id, value: 4, graded_on: "2026-10-08" });
  check("B non aggancia un voto alla materia di A", !!hijack.error, hijack);
  const forge = await b.sb.from("grades").insert({ user_id: a.id, subject_id: subjA[0].id, value: 4, graded_on: "2026-10-08" });
  check("B non scrive voti a nome di A", !!forge.error, forge);
  const forgeSubject = await b.sb
    .from("subjects")
    .insert({ user_id: a.id, school_year_id: subjA[0].id, name: "X", color: 1 });
  check("B non crea materie a nome di A", !!forgeSubject.error, forgeSubject);

  const profUpd = await b.sb.from("profiles").update({ first_name: "Hacked" }).eq("id", a.id).select("*");
  check("B non modifica il profilo di A", !profUpd.error && profUpd.data.length === 0, profUpd);
  const sysCol = await a.sb.from("profiles").update({ onboarding_completed_at: null }).eq("id", a.id);
  check("A non può azzerare onboarding_completed_at", !!sysCol.error, sysCol);

  // Anonimo.
  const anon = client();
  const anonRead = await anon.from("grades").select("*");
  check("anonimo non legge i voti", !!anonRead.error, anonRead);
  const anonRpc = await anon.rpc("complete_onboarding", { payload: onboarding(["X"]) });
  check("anonimo non chiama complete_onboarding", !!anonRpc.error, anonRpc);

  console.log(`\nUtenti creati: ${a.email}, ${b.email}`);
  console.log(failures ? `\n${failures} controlli falliti` : "\nTutti i controlli superati");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
