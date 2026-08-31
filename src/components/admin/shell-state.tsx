"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ShellContextValue = {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellStateProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("rh-sidebar") === "collapsed";
  });

  const toggleSidebar = useCallback(() => {
    if (window.matchMedia("(min-width: 1280px)").matches) {
      setSidebarCollapsed((value) => {
        const next = !value;
        window.localStorage.setItem("rh-sidebar", next ? "collapsed" : "expanded");
        return next;
      });
    } else {
      setSidebarOpen((value) => !value);
    }
  }, []);

  const value = useMemo(
    () => ({
      sidebarOpen,
      setSidebarOpen,
      sidebarCollapsed,
      toggleSidebar,
    }),
    [sidebarOpen, sidebarCollapsed, toggleSidebar],
  );
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export const ShellProvider = ShellStateProvider;

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used within ShellStateProvider");
  return ctx;
}
