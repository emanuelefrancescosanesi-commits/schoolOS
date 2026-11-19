import type { Metadata } from "next";
import { Suspense } from "react";
import { SubjectList } from "@/components/subjects/subject-list";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchoolContext } from "@/lib/data/school-data";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = { title: getMessages().nav.subjects };

export default function SubjectsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-72 w-full" aria-busy="true" />}>
      <Subjects />
    </Suspense>
  );
}

async function Subjects() {
  const { data } = await getSchoolContext();
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{getMessages().nav.subjects}</h1>
        <p className="mt-1 text-sm text-muted">
          Rinomina le materie come sono scritte sul registro: l&apos;importazione dei voti le riconosce dal nome.
        </p>
      </div>
      <SubjectList subjects={data.subjects} demo={data.isDemo} />
    </div>
  );
}
