"use client";

import { useEffect, type RefObject } from "react";

export function useOverlayFocus(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  focusDialog = true,
) {
  useEffect(() => {
    const scope = ref.current;
    if (!open || !scope) return;

    const previousFocus = document.activeElement;
    const disabled: HTMLElement[] = [];
    for (
      let branch = scope;
      branch !== document.body && branch.parentElement;
      branch = branch.parentElement
    ) {
      for (const sibling of branch.parentElement.children) {
        if (
          sibling !== branch &&
          sibling instanceof HTMLElement &&
          !sibling.inert
        ) {
          sibling.setAttribute("inert", "");
          disabled.push(sibling);
        }
      }
    }

    const dialog = scope.querySelector<HTMLElement>('[role="dialog"]');
    if (focusDialog) dialog?.focus({ preventScroll: true });
    function trapTab(event: KeyboardEvent) {
      if (event.key !== "Tab" || event.defaultPrevented || !scope) return;
      const controls = [
        ...scope.querySelectorAll<HTMLElement>(
          "a[href], button, input, select, textarea, [tabindex]",
        ),
      ].filter(
        (control) =>
          control.tabIndex >= 0 &&
          !control.matches(":disabled") &&
          control.getClientRects().length,
      );
      const first = controls[0];
      const last = controls.at(-1);
      const focused = document.activeElement;
      if (
        !scope.contains(focused) ||
        (event.shiftKey
          ? focused === first || focused === dialog
          : focused === last)
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    }
    scope.addEventListener("keydown", trapTab);
    return () => {
      scope.removeEventListener("keydown", trapTab);
      for (const element of disabled) element.removeAttribute("inert");
      if (
        focusDialog &&
        previousFocus instanceof HTMLElement &&
        previousFocus.isConnected
      )
        previousFocus.focus({ preventScroll: true });
    };
  }, [ref, open, focusDialog]);
}
