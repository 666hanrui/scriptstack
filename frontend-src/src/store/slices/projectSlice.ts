import { StateCreator } from "zustand";

export interface ProjectSlice {
  scriptSeed: string;
  setScriptSeed: (seed: string) => void;

  currentProjectId: string | null;
  setCurrentProjectId: (id: string | null) => void;

  currentWorkflowProjectId: string | null;
  setCurrentWorkflowProjectId: (id: string | null) => void;

  currentTaskId: string | null;
  setCurrentTaskId: (id: string | null) => void;

  currentStep: number;
  setCurrentStep: (step: number) => void;

  isDoctorPanelOpen: boolean;
  setDoctorPanelOpen: (isOpen: boolean) => void;
}

export const createProjectSlice: StateCreator<ProjectSlice, [], [], ProjectSlice> = (set) => ({
  scriptSeed: "",
  setScriptSeed: (scriptSeed) => set({ scriptSeed }),

  currentProjectId: null,
  setCurrentProjectId: (currentProjectId) =>
    set({ currentProjectId }),

  currentWorkflowProjectId: null,
  setCurrentWorkflowProjectId: (currentWorkflowProjectId) =>
    set({ currentWorkflowProjectId }),

  currentTaskId: null,
  setCurrentTaskId: (currentTaskId) =>
    set({ currentTaskId }),

  currentStep: 0,
  setCurrentStep: (currentStep) =>
    set({ currentStep }),

  isDoctorPanelOpen: false,
  setDoctorPanelOpen: (isDoctorPanelOpen) => set({ isDoctorPanelOpen }),
});
