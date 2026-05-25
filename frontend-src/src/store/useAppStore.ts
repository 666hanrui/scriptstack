import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";

import { AuthSlice, createAuthSlice } from "./slices/authSlice";
import { UISlice, createUISlice } from "./slices/uiSlice";
import { ProjectSlice, createProjectSlice } from "./slices/projectSlice";

export * from "./slices/authSlice";
export * from "./slices/uiSlice";
export * from "./slices/projectSlice";

export type AppState = AuthSlice & UISlice & ProjectSlice;

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (...a) => ({
        ...createAuthSlice(...a),
        ...createUISlice(...a),
        ...createProjectSlice(...a),
      }),
      {
        name: "scriptstack-core-storage",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          language: state.language,
          themeMode: state.themeMode,
          accentColor: state.accentColor,
          currentRealm: state.currentRealm,
          scriptSeed: state.scriptSeed,
          currentProjectId: state.currentProjectId,
          currentWorkflowProjectId: state.currentWorkflowProjectId,
          currentTaskId: state.currentTaskId,
          currentStep: state.currentStep,
          sidebarPinned: state.sidebarPinned,
        }),
      }
    ),
    { name: "ScriptStack_Store" }
  )
);
