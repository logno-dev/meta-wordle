"use client";

import { useEffect } from "react";

const THEME_KEY = "theme";

export default function ThemeClient() {
  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextTheme = stored === "dark" || stored === "light" ? stored : prefersDark ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  return null;
}
