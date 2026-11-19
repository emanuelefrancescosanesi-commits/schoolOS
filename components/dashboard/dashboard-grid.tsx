"use client";

import { ArrowDownIcon, ArrowUpIcon, EyeIcon, EyeOffIcon, RotateCcwIcon, SlidersHorizontalIcon } from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_LAYOUT,
  type DashboardLayout,
  LAYOUT_COOKIE,
  type WidgetId,
  moveWidget,
  serializeLayout,
  setHidden,
} from "@/lib/dashboard/layout";
import { getMessages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Quante colonne occupa ogni widget nella griglia (md: 2 colonne, xl: 3). */
const SIZE: Record<WidgetId, string> = {
  performance: "md:col-span-2 xl:row-span-2",
  upcoming: "",
  tasks: "",
  week: "md:col-span-2",
  inbox: "md:col-span-2 xl:col-span-1",
};

const TRANSITION = { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const };

function persist(layout: DashboardLayout) {
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${LAYOUT_COOKIE}=${encodeURIComponent(serializeLayout(layout))}; path=/; max-age=${oneYear}; samesite=lax`;
}

export function DashboardGrid({
  initialLayout,
  header,
  widgets,
}: {
  initialLayout: DashboardLayout;
  header: React.ReactNode;
  widgets: Record<WidgetId, React.ReactNode>;
}) {
  const m = getMessages();
  const t = m.dashboard;
  const [layout, setLayout] = useState(initialLayout);
  const [editing, setEditing] = useState(false);

  const update = (next: DashboardLayout) => {
    setLayout(next);
    persist(next);
  };

  const visible = layout.order.filter((id) => !layout.hidden.includes(id));
  const hidden = layout.order.filter((id) => layout.hidden.includes(id));

  return (
    <MotionConfig reducedMotion="user" transition={TRANSITION}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        {header}
        <Button
          variant={editing ? "primary" : "secondary"}
          size="sm"
          onClick={() => setEditing((v) => !v)}
          aria-pressed={editing}
        >
          <SlidersHorizontalIcon strokeWidth={1.5} />
          {editing ? t.doneCustomizing : t.customize}
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {editing && (
          <motion.div
            key="toolbar"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-card border border-dashed border-border bg-surface px-4 py-3 text-sm">
              <p className="min-w-0 flex-1 text-muted">{t.customizeHint}</p>
              {hidden.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted">{t.hidden}:</span>
                  {hidden.map((id) => (
                    <Button key={id} size="sm" onClick={() => update(setHidden(layout, id, false))}>
                      <EyeIcon strokeWidth={1.5} />
                      <span className="sr-only">{t.show(t.widgets[id])}</span>
                      <span aria-hidden>{t.widgets[id]}</span>
                    </Button>
                  ))}
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={() => update(DEFAULT_LAYOUT)}>
                <RotateCcwIcon strokeWidth={1.5} />
                {t.reset}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-flow-row-dense grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map((id, index) => (
            <motion.div
              key={id}
              layout
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className={cn("relative min-w-0", SIZE[id])}
            >
              {widgets[id]}
              {editing && (
                <div className="pointer-events-none absolute inset-0 rounded-card ring-2 ring-accent/40 ring-offset-0">
                  <div className="pointer-events-auto absolute top-2.5 right-2.5 flex items-center gap-0.5 rounded-control border border-border bg-surface p-0.5 shadow-sm">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === 0}
                      onClick={() => update(moveWidget(layout, id, -1))}
                      aria-label={t.moveUp(t.widgets[id])}
                    >
                      <ArrowUpIcon strokeWidth={1.5} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === visible.length - 1}
                      onClick={() => update(moveWidget(layout, id, 1))}
                      aria-label={t.moveDown(t.widgets[id])}
                    >
                      <ArrowDownIcon strokeWidth={1.5} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => update(setHidden(layout, id, true))}
                      aria-label={t.hide(t.widgets[id])}
                    >
                      <EyeOffIcon strokeWidth={1.5} />
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
