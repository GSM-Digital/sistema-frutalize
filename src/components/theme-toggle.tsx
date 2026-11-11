"use client";

import { useSyncExternalStore } from "react";
import { Icon } from "@/components/inventory/icon";
import { themeChangeEvent, themeStorageKey } from "@/lib/theme";

function subscribe(onChange: () => void) {
  window.addEventListener(themeChangeEvent, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(themeChangeEvent, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function isDark() {
  return document.documentElement.dataset.theme === "dark";
}

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  const label = dark ? "Ativar tema claro" : "Ativar tema escuro";

  function toggle() {
    const theme = isDark() ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(themeStorageKey, theme);
    } catch {
      // The theme still works for this page when browser storage is disabled.
    }
    window.dispatchEvent(new Event(themeChangeEvent));
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      <Icon name={dark ? "sun" : "moon"} size={22} />
    </button>
  );
}
