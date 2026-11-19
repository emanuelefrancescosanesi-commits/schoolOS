/**
 * Disposizione dei widget della Dashboard: ordine e visibilità.
 * Oggi è salvata in un cookie per dispositivo; con Supabase andrà nel profilo.
 */

export const WIDGET_IDS = ["performance", "upcoming", "tasks", "week", "inbox"] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

export interface DashboardLayout {
  order: WidgetId[];
  hidden: WidgetId[];
}

export const LAYOUT_COOKIE = "schoolos-dashboard";

export const DEFAULT_LAYOUT: DashboardLayout = { order: [...WIDGET_IDS], hidden: [] };

function isWidgetId(value: unknown): value is WidgetId {
  return typeof value === "string" && (WIDGET_IDS as readonly string[]).includes(value);
}

/**
 * Legge una disposizione salvata in modo tollerante: scarta id sconosciuti e
 * duplicati, e aggiunge in coda i widget nuovi, così un rilascio che introduce
 * un widget non rompe le disposizioni già salvate.
 */
export function parseLayout(raw: string | undefined | null): DashboardLayout {
  if (!raw) return DEFAULT_LAYOUT;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return DEFAULT_LAYOUT;
  }
  if (typeof data !== "object" || data === null) return DEFAULT_LAYOUT;
  const { order, hidden } = data as { order?: unknown; hidden?: unknown };

  const seen = new Set<WidgetId>();
  const cleanOrder: WidgetId[] = [];
  for (const id of Array.isArray(order) ? order : []) {
    if (isWidgetId(id) && !seen.has(id)) {
      seen.add(id);
      cleanOrder.push(id);
    }
  }
  for (const id of WIDGET_IDS) if (!seen.has(id)) cleanOrder.push(id);

  const cleanHidden = [...new Set((Array.isArray(hidden) ? hidden : []).filter(isWidgetId))];
  return { order: cleanOrder, hidden: cleanHidden };
}

export function serializeLayout(layout: DashboardLayout): string {
  return JSON.stringify(layout);
}

/** Sposta un widget di una posizione tra quelli visibili, saltando i nascosti. */
export function moveWidget(layout: DashboardLayout, id: WidgetId, direction: -1 | 1): DashboardLayout {
  const visible = layout.order.filter((w) => !layout.hidden.includes(w));
  const index = visible.indexOf(id);
  const target = visible[index + direction];
  if (index === -1 || target === undefined) return layout;
  const order = [...layout.order];
  const a = order.indexOf(id);
  const b = order.indexOf(target);
  [order[a], order[b]] = [order[b], order[a]];
  return { ...layout, order };
}

export function setHidden(layout: DashboardLayout, id: WidgetId, hidden: boolean): DashboardLayout {
  const set = new Set(layout.hidden);
  if (hidden) set.add(id);
  else set.delete(id);
  return { ...layout, hidden: layout.order.filter((w) => set.has(w)) };
}
