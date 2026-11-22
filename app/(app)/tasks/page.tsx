import type { Metadata } from "next";
import { Suspense } from "react";
import { TaskBoard } from "@/components/tasks/task-board";
import { Skeleton } from "@/components/ui/skeleton";
import { getSchoolContext } from "@/lib/data/school-data";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = { title: getMessages().nav.tasks };

export default function TasksPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" aria-busy="true" />}>
      <Tasks />
    </Suspense>
  );
}

async function Tasks() {
  const { data, today } = await getSchoolContext();
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{getMessages().nav.tasks}</h1>
        <p className="mt-1 text-sm text-muted">{getMessages().tasksPage.intro}</p>
      </div>
      <TaskBoard tasks={data.tasks} subjects={data.subjects} today={today} demo={data.isDemo} />
    </div>
  );
}
