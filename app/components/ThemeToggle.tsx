"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<string>(() => {
    if (typeof window === "undefined") return "system";
    return localStorage.getItem("theme") || "system";
  });

  useEffect(() => {
    const apply = (t: string) => {
      if (t === "dark") {
        document.documentElement.dataset.theme = "dark";
      } else if (t === "light") {
        document.documentElement.dataset.theme = "light";
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
    };

    apply(theme);
    try {
      if (theme === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", theme);
    } catch {}
  }, [theme]);

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button
        onClick={() => setTheme(theme === "light" ? "system" : "light")}
        aria-pressed={theme === "light"}
        style={{ padding: "6px 10px", borderRadius: 8 }}
      >
        ☀️
      </button>
      <button
        onClick={() => setTheme(theme === "dark" ? "system" : "dark")}
        aria-pressed={theme === "dark"}
        style={{ padding: "6px 10px", borderRadius: 8 }}
      >
        🌙
      </button>
    </div>
  );
}
