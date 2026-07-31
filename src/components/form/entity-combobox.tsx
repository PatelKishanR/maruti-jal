"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";

export interface ComboboxOption {
  id: string;
  /** Primary line — the name. */
  label: string;
  /** Secondary line — phone, code, price. Disambiguates two same-named rows. */
  hint?: string;
  disabled?: boolean;
}

/**
 * Searchable async picker. Spec: COMPONENT-INVENTORY §3
 *
 * Two-line options are deliberate: two staff members genuinely can share a
 * name, and the phone number is what tells them apart. A single-line picker
 * makes that ambiguity invisible until the wrong person is charged.
 *
 * Fetches through `lib/api/client` — never a service or repository.
 */
export function EntityCombobox({
  value,
  onValueChange,
  endpoint,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  onCreateNew,
  createNewLabel,
  invalid,
  disabled,
  id,
  className,
}: {
  value: string | null;
  onValueChange: (id: string | null, option: ComboboxOption | null) => void;
  /** Returns `ComboboxOption[]`. `?q=` is appended. */
  endpoint: string;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  onCreateNew?: (query: string) => void;
  createNewLabel?: string;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [selected, setSelected] = useState<ComboboxOption | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [highlight, setHighlight] = useState(0);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!open) return;
    clearTimeout(debounce.current);
    setState("loading");
    debounce.current = setTimeout(async () => {
      try {
        const url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}q=${encodeURIComponent(query)}`;
        setOptions(await api.get<ComboboxOption[]>(url));
        setState("idle");
        setHighlight(0);
      } catch {
        setState("error");
      }
    }, 250);
    return () => clearTimeout(debounce.current);
  }, [open, query, endpoint]);

  function choose(option: ComboboxOption) {
    if (option.disabled) return;
    setSelected(option);
    onValueChange(option.id, option);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-expanded={open}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-sm border bg-transparent px-3",
            "text-left text-sm transition-colors duration-100",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
            "disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-muted",
            invalid ? "border-destructive" : "border-input hover:border-muted-foreground/50",
            className,
          )}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground/60")}>
            {selected?.label ?? (value ? "…" : placeholder)}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        <div className="relative border-b border-border">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => Math.min(h + 1, options.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => Math.max(h - 1, 0));
              }
              if (e.key === "Enter" && options[highlight]) {
                e.preventDefault();
                choose(options[highlight]);
              }
            }}
            className="h-10 w-full bg-transparent pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
        </div>

        {/* 8 × 36px before scrolling — enough to choose from, short enough
            not to cover the form behind it. */}
        <ul className="max-h-72 overflow-y-auto p-1" role="listbox">
          {state === "loading" && (
            <li className="space-y-1 p-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-8 rounded-sm" />
              ))}
            </li>
          )}

          {state === "error" && (
            <li className="p-3 text-center text-sm text-destructive">
              {t("somethingWentWrong")}
            </li>
          )}

          {state === "idle" && options.length === 0 && (
            <li className="p-3 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </li>
          )}

          {state === "idle" &&
            options.map((option, i) => (
              <li key={option.id} role="option" aria-selected={option.id === value}>
                <button
                  type="button"
                  disabled={option.disabled}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => choose(option)}
                  className={cn(
                    "flex min-h-9 w-full items-center justify-between gap-2 rounded-sm px-3 py-1.5 text-left",
                    "disabled:opacity-40",
                    i === highlight && "bg-muted",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-foreground">
                      {option.label}
                    </span>
                    {option.hint && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.hint}
                      </span>
                    )}
                  </span>
                  {option.id === value && (
                    <Check className="size-4 shrink-0 text-primary" aria-hidden />
                  )}
                </button>
              </li>
            ))}
        </ul>

        {onCreateNew && (
          <div className="border-t border-border p-1">
            <button
              type="button"
              onClick={() => {
                onCreateNew(query);
                setOpen(false);
              }}
              className="flex min-h-9 w-full items-center gap-2 rounded-sm px-3 text-left text-sm text-primary hover:bg-muted"
            >
              <Plus className="size-4" aria-hidden />
              {createNewLabel ?? t("addNew")}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
