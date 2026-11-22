import type { Metadata } from "next";
import { Suspense } from "react";
import { TodoApp } from "@/components/todo/todo-app";
import { Skeleton } from "@/components/ui/skeleton";
import { getTodoPageData } from "@/lib/data/todo-data";
import { getMessages } from "@/lib/i18n";

export const metadata: Metadata = { title: getMessages().todo.title };

export default function TasksPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-96 w-full max-w-5xl" aria-busy="true" />}>
      <Todos />
    </Suspense>
  );
}

async function Todos() {
  const { subjects, ...data } = await getTodoPageData();
  return <TodoApp data={data} subjects={subjects} />;
}
