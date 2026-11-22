import type { Metadata } from "next";
import { Suspense } from "react";
import { type AssistantState, ChatView } from "@/components/assistant/chat-view";
import { Skeleton } from "@/components/ui/skeleton";
import { assistantAvailability } from "@/lib/assistant/policy";
import { getCurrentUser, getProfile } from "@/lib/data/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { assistantMessages } from "@/lib/assistant/messages";

export const metadata: Metadata = { title: assistantMessages.title };

export default function AssistantPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full max-w-2xl" />}>
      <Assistant />
    </Suspense>
  );
}

async function Assistant() {
  return <ChatView state={await stateFor()} />;
}

async function stateFor(): Promise<AssistantState> {
  if (!isSupabaseConfigured()) return "demo";
  if (assistantAvailability() !== "ready") return "off";
  const user = await getCurrentUser();
  if (!user) return "demo";
  const profile = await getProfile(user.id);
  return profile?.plan === "pro" ? "ready" : "pro";
}
