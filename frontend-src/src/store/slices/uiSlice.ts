import { StateCreator } from "zustand";

export type RealmType = "cloudcity" | "valley" | "samurai";

export type ToastPayload =
  | string
  | {
      message: string;
      type?: "success" | "error" | "info";
    };

export interface GlobalError {
  title: string;
  details: string;
  action: string;
  suggestion: string;
}

export interface UISlice {
  currentRealm: RealmType;
  setRealm: (realm: RealmType) => void;

  toast: ToastPayload | null;
  showToast: (toast: ToastPayload) => void;

  language: "zh" | "en";
  setLanguage: (lang: "zh" | "en") => void;

  themeMode: "dark" | "light";
  setThemeMode: (mode: "dark" | "light") => void;

  accentColor: string;
  setAccentColor: (color: string) => void;

  globalError: GlobalError | null;
  setGlobalError: (error: GlobalError | null) => void;
  clearError: () => void;
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  currentRealm: "cloudcity",
  setRealm: (currentRealm) => set({ currentRealm }),

  toast: null,
  showToast: (toast) => set({ toast }),

  language: "zh",
  setLanguage: (language) => set({ language }),

  themeMode: "dark",
  setThemeMode: (mode) => set({ themeMode: mode }),

  accentColor: "#6366f1",
  setAccentColor: (color) => set({ accentColor: color }),

  globalError: null,
  setGlobalError: (globalError) => set({ globalError }),
  clearError: () => set({ globalError: null }),
});
