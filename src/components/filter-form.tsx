"use client";

import { useEffect, useRef, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const searchDelayMs = 350;

function filterQuery(entries: Iterable<[string, FormDataEntryValue]>) {
  const query = new URLSearchParams();
  for (const [name, value] of entries) {
    if (typeof value !== "string") continue;
    const filter = name === "q" ? value.trim() : value;
    if (filter) query.append(name, filter);
  }
  query.sort();
  return query.toString();
}

export function FilterForm({
  action,
  label,
  className = "filter-bar",
  values,
  page,
  children,
}: {
  action: string;
  label: string;
  className?: string;
  values: Record<string, string>;
  page: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const submittedQuery = useRef<string | null>(null);
  const [pending, startTransition] = useTransition();
  const appliedValues = new URLSearchParams(values).toString();
  const lastApplied = useRef({ values: appliedValues, page });

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (pending) return;
    const submitted = submittedQuery.current;
    const previous = lastApplied.current;
    if (
      submitted === null &&
      previous.values === appliedValues &&
      previous.page === page
    )
      return;

    submittedQuery.current = null;
    lastApplied.current = { values: appliedValues, page };
    const applied = new URLSearchParams(appliedValues);
    // Preserve the input, including typing after this request started.
    if (submitted === filterQuery(applied) && page === 1) return;

    window.clearTimeout(timer.current);
    for (const field of Array.from(form.current?.elements ?? [])) {
      if (
        !(
          field instanceof HTMLInputElement ||
          field instanceof HTMLSelectElement
        ) ||
        !applied.has(field.name)
      )
        continue;
      const value = applied.get(field.name) ?? "";
      if (field instanceof HTMLInputElement && field.type === "checkbox") {
        field.checked = field.value === value;
      } else if (field.value !== value) {
        field.value = value;
      }
    }
  }, [appliedValues, page, pending]);

  function applyFilters() {
    window.clearTimeout(timer.current);
    if (!form.current) return;
    const query = filterQuery(new FormData(form.current));
    submittedQuery.current = query;
    startTransition(() => {
      router.replace(query ? `${action}?${query}` : action, { scroll: false });
    });
  }

  function queueSearch() {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(applyFilters, searchDelayMs);
  }

  return (
    <form
      ref={form}
      className={className}
      action={action}
      method="get"
      aria-label={label}
      onSubmit={(event) => {
        event.preventDefault();
        applyFilters();
      }}
      onChange={(event) => {
        const field = event.target;
        if (field instanceof HTMLInputElement && field.type === "search") {
          if (!(
            event.nativeEvent instanceof InputEvent &&
            event.nativeEvent.isComposing
          ))
            queueSearch();
        } else {
          applyFilters();
        }
      }}
      onCompositionStart={() => window.clearTimeout(timer.current)}
      onCompositionEnd={queueSearch}
    >
      {children}
      <button type="submit" hidden>
        Aplicar filtros
      </button>
    </form>
  );
}
