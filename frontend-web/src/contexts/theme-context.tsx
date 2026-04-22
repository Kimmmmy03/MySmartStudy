"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // Load theme: try Firebase first (for logged-in user), then localStorage, then default to light
  useEffect(() => {
    async function loadTheme() {
      const localTheme = localStorage.getItem("mss-theme") as Theme | null;

      const user = auth.currentUser;
      if (user) {
        try {
          const snap = await getDoc(doc(db, "user_preferences", user.uid));
          if (snap.exists() && snap.data().theme) {
            const fbTheme = snap.data().theme as Theme;
            setTheme(fbTheme);
            localStorage.setItem("mss-theme", fbTheme);
            setMounted(true);
            return;
          }
        } catch {
          // Firestore unavailable — fall back to localStorage
        }
      }

      setTheme(localTheme || "light");
      setMounted(true);
    }

    loadTheme();

    // Re-load when auth state changes (user logs in/out)
    const unsubscribe = auth.onAuthStateChanged(() => {
      loadTheme();
    });
    return unsubscribe;
  }, []);

  // Apply theme to DOM and persist
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
    root.setAttribute("data-theme", theme);
    localStorage.setItem("mss-theme", theme);
  }, [theme, mounted]);

  // Save theme to Firebase when user toggles
  const saveThemeToFirebase = useCallback(async (newTheme: Theme) => {
    const user = auth.currentUser;
    if (user) {
      try {
        await setDoc(doc(db, "user_preferences", user.uid), { theme: newTheme }, { merge: true });
      } catch {
        // Silently fail — localStorage is the fallback
      }
    }
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      saveThemeToFirebase(next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
