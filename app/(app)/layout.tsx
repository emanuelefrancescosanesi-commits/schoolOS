import { AppShell } from "@/components/shell/app-shell";
import { DATA_MODE } from "@/lib/data/school-data";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return <AppShell isDemo={DATA_MODE === "demo"}>{children}</AppShell>;
}
