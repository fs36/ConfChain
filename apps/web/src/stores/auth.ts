import { defineStore } from "pinia";
import { api } from "../services/api";

export type UserRole = "ADMIN" | "AUTHOR" | "REVIEWER";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  walletAddr?: string;
}

const TOKEN_KEY = "cc_token";
const USER_KEY = "cc_user";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) ?? "",
    profile: (() => {
      try {
        const raw = localStorage.getItem(USER_KEY);
        return raw ? (JSON.parse(raw) as UserProfile) : null;
      } catch {
        return null;
      }
    })(),
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    isAdmin: (state) => state.profile?.role === "ADMIN",
    isAuthor: (state) => state.profile?.role === "AUTHOR",
    isReviewer: (state) => state.profile?.role === "REVIEWER",
  },

  actions: {
    _persist(token: string, profile: UserProfile) {
      this.token = token;
      this.profile = profile;
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(profile));
    },

    async login(email: string, password: string) {
      const { data } = await api.post<{
        accessToken: string;
        user: UserProfile;
      }>("/auth/login", { email, password });
      this._persist(data.accessToken, data.user);
      return data;
    },

    async register(payload: {
      name: string;
      email: string;
      password: string;
      role?: UserRole;
    }) {
      return api.post("/auth/register", payload);
    },

    async fetchMe() {
      const { data } = await api.get<UserProfile>("/auth/me");
      this.profile = data;
      localStorage.setItem(USER_KEY, JSON.stringify(data));
      return data;
    },

    logout() {
      this.token = "";
      this.profile = null;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
  },
});
