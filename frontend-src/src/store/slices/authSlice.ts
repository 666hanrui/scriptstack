import { StateCreator } from "zustand";

export interface UserProfile {
  username: string;
  token: string;
  role?: string;
  isAdmin?: boolean;
}

export interface AuthSlice {
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
}

export const createAuthSlice: StateCreator<AuthSlice, [], [], AuthSlice> = (set) => ({
  user: null,
  setUser: (user) => set({ user }),
});
