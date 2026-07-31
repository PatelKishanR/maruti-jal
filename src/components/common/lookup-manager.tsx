"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { GripVertical, MoreHorizontal, Pencil, Plus, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState, ErrorState } from "@/components/common/empty-state";
import { cn } from "@/lib/utils";

/**
 * Lookup manager — the shared editor for small reference tables.
 *
 * Expense categories, product tags, product filter types, coin denominations:
 * ten-ish rows the owner owns, where the whole job is "rename that one, add
 * three more, switch that one off". A full DataTable is the wrong shape for
 * that — a table asks you to open a form per row, and the owner is doing five
 * edits in one sitting.
 *
 * So the affordances here are deliberately different from §5:
 *
 *  - **the name IS the editor** — click it and it becomes an input. No dialog,
 *    no navigation, no save button
 *  - **the add row is pinned at the bottom and never goes away** — `Enter`
 *    creates and refocuses, so five categories cost one visit, not five
 *  - **every write is optimistic**, with the previous state kept and restored
 *    if the server refuses. The owner's next drag starts before the last one
 *    has finished saving
 *  - **switched-off rows stay visible** at 60% opacity with an `Inactive`
 *    badge. Hiding them makes reactivating one impossible from this screen
 *
 * Rows are 48px, hover-highlighted, and never navigate — this is a settings
 * list, not an index. Spec: design/MODULES/07-expenses.md §6, DESIGN-STANDARDS
 * §5.2, §7.2, §20.
 *
 * Generic over the item shape so a module can carry its own extra fields
 * (colour, code, unit price) through unchanged: handlers take and return `T`.
 */

/** The minimum a row must have. Modules extend this with their own fields. */
export interface LookupItem {
  id: string;
  /** Any script — `Fuel`, `પ્લાન્ટ મેઇન્ટેનન્સ`. */
  name: string;
  isActive: boolean;
}

/**
 * Throw this from `onCreate` / `onRename` to put the message **inline** under
 * the row or the add input, keeping focus where the fix belongs.
 *
 * Anything else thrown is treated as an infrastructure failure: the optimistic
 * change is rolled back and an error toast explains that nothing was saved.
 * The message must already be translated — this component cannot know a
 * caller's catalogue namespace.
 */
export class LookupInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LookupInputError";
  }
}

/** Copy that only the owning module can write. Everything else is `common.lookupManager.*`. */
export interface LookupManagerLabels {
  /** Accessible name for the pinned add input. */
  addLabel: string;
  /** An EXAMPLE, not a repeat of the label — `e.g. Borewell repair`. §6.2 */
  addPlaceholder: string;
  /** `No categories yet` */
  emptyTitle: string;
  /** What these rows are FOR, and what to do next. */
  emptyDescription: string;
  /** `Couldn't load categories` */
  errorTitle?: string;
  errorDescription?: string;
}

export interface LookupManagerProps<T extends LookupItem> {
  /** The server's list. Held as local state so writes can be optimistic. */
  items: T[];
  /** Resolve with the created row. Throw `LookupInputError` for a duplicate name. */
  onCreate: (name: string) => Promise<T>;
  /** Resolve with the saved row. Throw `LookupInputError` for a duplicate name. */
  onRename: (id: string, name: string) => Promise<T>;
  onToggleActive: (id: string, isActive: boolean) => Promise<T>;
  /** The complete list of ids in their new order. Must be transactional server-side. */
  onReorder: (ids: string[]) => Promise<void>;
  labels: LookupManagerLabels;

  /** Skeleton rows instead of the list. */
  loading?: boolean;
  /** Error state instead of the list. Pair with `onRetry`. */
  error?: boolean;
  onRetry?: () => void;

  /** VIEWER and MANAGER get a read-only list: no add row, no menu, no editing. */
  readOnly?: boolean;
  /**
   * Turn dragging off — e.g. while the caller is showing a filtered subset,
   * where a new order would be meaningless.
   */
  reorderable?: boolean;
  /** Client-side guard; the server schema is the real one. */
  maxNameLength?: number;

  /** Module icon for the no-data state — `Receipt`, `Tags`. §17 */
  emptyIcon?: LucideIcon;
  /** Extra CTA for the no-data state, e.g. `Use the standard ten`. */
  emptyAction?: React.ReactNode;
  /** Footer strip — `11 categories · 10 active`. Counts follow optimistic state. */
  renderSummary?: (counts: { total: number; active: number }) => string;
  /**
   * Confirm before switching a row OFF. Reactivating is never confirmed —
   * it takes nothing away.
   */
  confirmDeactivate?: (item: T) => {
    title: string;
    description: string;
    confirmLabel: string;
  };
  className?: string;
}

const ROW = "flex h-12 items-center gap-1 px-2";

export function LookupManager<T extends LookupItem>({
  items,
  onCreate,
  onRename,
  onToggleActive,
  onReorder,
  labels,
  loading = false,
  error = false,
  onRetry,
  readOnly = false,
  reorderable = true,
  maxNameLength = 40,
  emptyIcon,
  emptyAction,
  renderSummary,
  confirmDeactivate,
  className,
}: LookupManagerProps<T>) {
  const t = useTranslations("common.lookupManager");

  const [rows, setRows] = React.useState<T[]>(items);
  /** Mirrors `rows` for handlers that fire outside React's event flow (drag end). */
  const rowsRef = React.useRef(rows);
  rowsRef.current = rows;

  /** Writes in flight. While any is pending, a fresh `items` prop must not clobber them. */
  const inFlight = React.useRef(0);

  React.useEffect(() => {
    if (inFlight.current > 0) return;
    setRows(items);
  }, [items]);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const [rowError, setRowError] = React.useState<{ id: string; message: string } | null>(null);
  const [savingId, setSavingId] = React.useState<string | null>(null);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const editRef = React.useRef<HTMLInputElement | null>(null);
  /** Escape must revert, and Escape blurs — so the blur handler has to know. */
  const skipBlur = React.useRef(false);

  const [addValue, setAddValue] = React.useState("");
  const [addError, setAddError] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const addRef = React.useRef<HTMLInputElement | null>(null);

  const [armedId, setArmedId] = React.useState<string | null>(null);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);
  const dragSource = React.useRef<string | null>(null);
  const dragSnapshot = React.useRef<T[] | null>(null);

  const [confirming, setConfirming] = React.useState<T | null>(null);

  const canDrag = reorderable && !readOnly && rows.length > 1;

  /** One place for "the server said no, and nothing was saved". */
  function failed(retry?: () => void) {
    toast.error(t("saveFailed"), retry ? { action: { label: t("retry"), onClick: retry } } : undefined);
  }

  async function track<R>(run: () => Promise<R>): Promise<R> {
    inFlight.current += 1;
    try {
      return await run();
    } finally {
      inFlight.current -= 1;
    }
  }

  /* ── rename ──────────────────────────────────────────────────────────── */

  function startEdit(item: T) {
    if (readOnly || pendingId === item.id) return;
    // Escape sets this and then unmounts the input, so the blur never arrives
    // to clear it. Reset on the way in, or the NEXT edit's blur is swallowed.
    skipBlur.current = false;
    setEditingId(item.id);
    setDraft(item.name);
    setRowError(null);
  }

  function keepEditing(id: string, message: string) {
    setRowError({ id, message });
    // Focus never leaves the field it belongs to. §6.4
    requestAnimationFrame(() => editRef.current?.select());
  }

  async function commitEdit(item: T) {
    if (editingId !== item.id) return;
    const next = draft.trim();

    if (next === item.name) {
      setEditingId(null);
      setRowError(null);
      return;
    }
    if (next.length === 0) return keepEditing(item.id, t("nameRequired"));
    if (next.length > maxNameLength) {
      return keepEditing(item.id, t("nameTooLong", { max: maxNameLength }));
    }

    setEditingId(null);
    setRowError(null);
    setSavingId(item.id);

    const before = rowsRef.current;
    setRows((rs) => rs.map((r) => (r.id === item.id ? { ...r, name: next } : r)));

    try {
      const saved = await track(() => onRename(item.id, next));
      setRows((rs) => rs.map((r) => (r.id === item.id ? saved : r)));
    } catch (e) {
      setRows(before);
      if (e instanceof LookupInputError) {
        setEditingId(item.id);
        setDraft(next);
        keepEditing(item.id, e.message);
      } else {
        failed(() => startEdit(item));
      }
    } finally {
      setSavingId(null);
    }
  }

  /* ── switch on / off ─────────────────────────────────────────────────── */

  async function toggle(item: T, isActive: boolean) {
    const before = rowsRef.current;
    setRows((rs) => rs.map((r) => (r.id === item.id ? { ...r, isActive } : r)));

    try {
      const saved = await track(() => onToggleActive(item.id, isActive));
      setRows((rs) => rs.map((r) => (r.id === item.id ? saved : r)));
    } catch {
      // The row un-dims. Nothing about the record changed.
      setRows(before);
      failed(() => void toggle(item, isActive));
    }
  }

  function requestToggle(item: T, isActive: boolean) {
    if (!isActive && confirmDeactivate) {
      setConfirming(item);
      return;
    }
    void toggle(item, isActive);
  }

  /* ── reorder ─────────────────────────────────────────────────────────── */

  function reposition(list: T[], fromId: string, toId: string): T[] {
    const from = list.findIndex((r) => r.id === fromId);
    const to = list.findIndex((r) => r.id === toId);
    if (from < 0 || to < 0 || from === to) return list;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  }

  async function commitOrder(before: T[], next: T[]) {
    const beforeIds = before.map((r) => r.id).join("|");
    const nextIds = next.map((r) => r.id);
    if (beforeIds === nextIds.join("|")) return;

    try {
      // ONE call for the whole list — the server rewrites it in a transaction,
      // so a failure leaves the old order rather than half of a new one.
      await track(() => onReorder(nextIds));
    } catch {
      setRows(before);
      toast.error(t("reorderFailed"));
    }
  }

  function moveBy(id: string, delta: number) {
    const before = rowsRef.current;
    const index = before.findIndex((r) => r.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= before.length) return;
    const next = reposition(before, id, before[target].id);
    setRows(next);
    void commitOrder(before, next);
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    if (!canDrag || armedId !== id) {
      e.preventDefault();
      return;
    }
    dragSource.current = id;
    dragSnapshot.current = rowsRef.current;
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    // Firefox refuses to start a drag without payload.
    e.dataTransfer.setData("text/plain", id);
  }

  function handleDragOver(e: React.DragEvent, overId: string) {
    const from = dragSource.current;
    if (!from) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (from === overId) return;
    // Live preview: the list rearranges under the cursor, so the drop is a
    // confirmation rather than a guess.
    setRows((rs) => reposition(rs, from, overId));
  }

  function handleDragEnd() {
    const before = dragSnapshot.current;
    dragSource.current = null;
    dragSnapshot.current = null;
    setArmedId(null);
    setDraggingId(null);
    if (before) void commitOrder(before, rowsRef.current);
  }

  /* ── add ─────────────────────────────────────────────────────────────── */

  async function submitAdd() {
    const name = addValue.trim();
    if (name.length === 0) {
      setAddError(t("nameRequired"));
      return;
    }
    if (name.length > maxNameLength) {
      setAddError(t("nameTooLong", { max: maxNameLength }));
      return;
    }

    setAddError(null);
    setAdding(true);

    const before = rowsRef.current;
    const temporaryId = `pending:${Date.now()}`;
    // The row appears at once and the input clears, so the owner can type the
    // next one while this one is still in flight.
    setRows([...before, { id: temporaryId, name, isActive: true } as unknown as T]);
    setPendingId(temporaryId);
    setAddValue("");

    try {
      const created = await track(() => onCreate(name));
      setRows((rs) => rs.map((r) => (r.id === temporaryId ? created : r)));
    } catch (e) {
      setRows(before);
      setAddValue(name);
      if (e instanceof LookupInputError) setAddError(e.message);
      else failed();
    } finally {
      setPendingId(null);
      setAdding(false);
      addRef.current?.focus();
    }
  }

  /* ── render ──────────────────────────────────────────────────────────── */

  if (error) {
    return (
      <ErrorState
        title={labels.errorTitle}
        description={labels.errorDescription}
        onRetry={onRetry}
        className={className}
      />
    );
  }

  if (loading) {
    return (
      <div className={cn("divide-y divide-border", className)} aria-busy>
        <span className="sr-only">{t("loading")}</span>
        {[70, 45, 60].map((width, i) => (
          <div key={i} className={ROW}>
            <Skeleton className="size-4 shrink-0 rounded-full" />
            <Skeleton className="h-4" style={{ width: `${width}%` }} />
          </div>
        ))}
      </div>
    );
  }

  const activeCount = rows.filter((r) => r.isActive).length;
  const confirmCopy = confirming && confirmDeactivate ? confirmDeactivate(confirming) : null;

  return (
    <div className={className}>
      {rows.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={labels.emptyTitle}
          description={labels.emptyDescription}
          action={emptyAction}
        />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((item) => {
            const editing = editingId === item.id;
            const isPending = pendingId === item.id;
            const message = rowError?.id === item.id ? rowError.message : null;

            return (
              <li
                key={item.id}
                draggable={armedId === item.id}
                onDragStart={(e) => handleDragStart(e, item.id)}
                onDragOver={(e) => handleDragOver(e, item.id)}
                onDrop={(e) => e.preventDefault()}
                onDragEnd={handleDragEnd}
                className={cn(
                  "transition-colors duration-100",
                  // §6.5: switched off is dimmed and badged, never hidden.
                  !item.isActive && "opacity-60",
                  isPending && "opacity-60",
                  draggingId === item.id
                    ? "bg-muted opacity-100 ring-1 ring-primary"
                    : "hover:bg-muted/60",
                )}
              >
                <div className={cn(ROW, "group")}>
                  {canDrag ? (
                    <button
                      type="button"
                      aria-label={t("reorderHandle", { name: item.name })}
                      onPointerDown={() => setArmedId(item.id)}
                      onPointerUp={() => setArmedId(null)}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowUp") {
                          e.preventDefault();
                          moveBy(item.id, -1);
                        }
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          moveBy(item.id, 1);
                        }
                      }}
                      className={cn(
                        "flex size-8 shrink-0 cursor-grab items-center justify-center rounded-sm",
                        "text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                      )}
                    >
                      <GripVertical className="size-4" aria-hidden />
                    </button>
                  ) : (
                    <span className="size-8 shrink-0" aria-hidden />
                  )}

                  <div className="min-w-0 flex-1">
                    {editing ? (
                      <input
                        ref={editRef}
                        autoFocus
                        value={draft}
                        maxLength={maxNameLength + 20}
                        disabled={savingId === item.id}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => {
                          setDraft(e.target.value);
                          // Re-validate live once it has failed once. §6.4
                          if (rowError?.id === item.id) setRowError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void commitEdit(item);
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            skipBlur.current = true;
                            setEditingId(null);
                            setRowError(null);
                          }
                        }}
                        onBlur={() => {
                          if (skipBlur.current) {
                            skipBlur.current = false;
                            return;
                          }
                          void commitEdit(item);
                        }}
                        className={cn(
                          // 32px inside a 48px row — the row height never changes,
                          // so the list doesn't jump as you tab down it. §6.3
                          "h-8 w-full rounded-sm border bg-transparent px-2 text-sm text-foreground",
                          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                          message ? "border-destructive" : "border-primary",
                        )}
                      />
                    ) : (
                      <button
                        type="button"
                        disabled={readOnly || isPending}
                        onClick={() => startEdit(item)}
                        className={cn(
                          "flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-sm",
                          "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                          "disabled:cursor-default",
                          item.isActive ? "font-medium text-foreground" : "text-foreground",
                        )}
                      >
                        <span className="truncate">{item.name}</span>
                        {!readOnly && (
                          <Pencil
                            className="size-3.5 shrink-0 text-muted-foreground/0 transition-colors duration-100 group-hover:text-muted-foreground/70"
                            aria-hidden
                          />
                        )}
                      </button>
                    )}
                  </div>

                  {!item.isActive && (
                    <Badge variant="default" className="shrink-0">
                      {t("inactive")}
                    </Badge>
                  )}

                  <Switch
                    checked={item.isActive}
                    disabled={readOnly || isPending}
                    aria-label={t("toggleActive", { name: item.name })}
                    onCheckedChange={(next) => requestToggle(item, next)}
                    className="ml-2 shrink-0"
                  />

                  {!readOnly && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("rowActions", { name: item.name })}
                          disabled={isPending}
                          className="shrink-0"
                        >
                          <MoreHorizontal className="size-4" aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => startEdit(item)}>
                          <Pencil aria-hidden />
                          {t("rename")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => requestToggle(item, !item.isActive)}
                        >
                          {item.isActive ? t("switchOff") : t("switchOn")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* A 24px expansion strip, so an error never reflows the columns. §6.5 */}
                {message && (
                  <p className="flex h-6 items-center px-11 text-caption text-destructive" role="alert">
                    {message}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!readOnly && (
        <div className="border-t border-border">
          <div className={ROW}>
            <span className="flex size-8 shrink-0 items-center justify-center" aria-hidden>
              <Plus className="size-4 text-muted-foreground/60" />
            </span>
            <input
              ref={addRef}
              value={addValue}
              aria-label={labels.addLabel}
              aria-invalid={addError ? true : undefined}
              placeholder={labels.addPlaceholder}
              maxLength={maxNameLength + 20}
              onChange={(e) => {
                setAddValue(e.target.value);
                if (addError) setAddError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!adding) void submitAdd();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setAddValue("");
                  setAddError(null);
                }
              }}
              className={cn(
                "h-8 w-full rounded-sm border bg-transparent px-2 text-sm text-foreground",
                "placeholder:text-muted-foreground/70",
                "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                addError ? "border-destructive" : "border-transparent hover:border-input focus:border-input",
              )}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={adding || addValue.trim().length === 0}
              loading={adding}
              loadingText={t("adding")}
              onClick={() => void submitAdd()}
              className="shrink-0"
            >
              {t("add")}
            </Button>
          </div>

          {addError && (
            <p className="flex h-6 items-center px-11 text-caption text-destructive" role="alert">
              {addError}
            </p>
          )}
        </div>
      )}

      {renderSummary && rows.length > 0 && (
        <div className="flex h-12 items-center border-t border-border bg-muted px-4 text-caption text-muted-foreground">
          {renderSummary({ total: rows.length, active: activeCount })}
        </div>
      )}

      {confirmCopy && confirming && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirming(null);
          }}
          title={confirmCopy.title}
          description={confirmCopy.description}
          confirmLabel={confirmCopy.confirmLabel}
          // ConfirmDialog closes itself once this resolves, which clears
          // `confirming` through onOpenChange — so the dialog stays mounted
          // (and busy) for the whole write rather than vanishing mid-flight.
          onConfirm={() => toggle(confirming, false)}
        />
      )}
    </div>
  );
}
