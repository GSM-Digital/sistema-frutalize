export const themeStorageKey = "frutalize-theme";
export const themeChangeEvent = "frutalize-theme-change";

export const initializeTheme = `
  (() => {
    const key = ${JSON.stringify(themeStorageKey)};
    const apply = (value) => {
      document.documentElement.dataset.theme = value === "dark" ? "dark" : "light";
    };
    try { apply(localStorage.getItem(key)); } catch {}
    window.addEventListener("storage", (event) => {
      if (event.key === key || event.key === null) apply(event.newValue);
    });
  })();
`;
