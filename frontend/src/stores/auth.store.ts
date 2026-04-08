import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi, type User } from 'src/services/api';
import { i18n } from 'src/boot/i18n';

export const useAuthStore = defineStore('auth', () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const user = ref<User | null>(null);
  const token = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // ── Getters ────────────────────────────────────────────────────────────────
  const isAuthenticated = computed(() => !!token.value && !!user.value);
  const isAdmin = computed(() => user.value?.role === 'ADMIN');
  const isChecker = computed(() => user.value?.role === 'CHECKER');

  // ── Storage helpers ────────────────────────────────────────────────────────
  function applyLocale(locale?: string) {
    const l = (locale ?? 'en') as 'en' | 'el';
    i18n.global.locale.value = l;
    localStorage.setItem('locale', l);
  }

  function saveSession(accessToken: string, userData: User, refreshToken: string | null) {
    token.value = accessToken;
    user.value = userData;
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('user', JSON.stringify(userData));
    applyLocale((userData as User & { locale?: string }).locale);
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
      localStorage.setItem('refresh_user_id', userData.id);
    } else {
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('refresh_user_id');
    }
  }

  function clearSession() {
    token.value = null;
    user.value = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('refresh_user_id');
  }

  // ── Hydrate from localStorage on store creation ────────────────────────────
  function hydrateFromStorage() {
    const storedToken = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');
    if (storedToken && storedUser) {
      token.value = storedToken;
      try {
        user.value = JSON.parse(storedUser) as User;
      } catch {
        clearSession();
      }
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function login(email: string, password: string, stayLoggedIn: boolean): Promise<boolean> {
    loading.value = true;
    error.value = null;
    try {
      const { data } = await authApi.login(email, password, stayLoggedIn);
      saveSession(data.accessToken, data.user, data.refreshToken);
      return true;
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Login failed. Please check your credentials.';
      error.value = Array.isArray(msg) ? msg[0] : msg;
      return false;
    } finally {
      loading.value = false;
    }
  }

  async function tryRefresh(): Promise<boolean> {
    const refreshToken = localStorage.getItem('refresh_token');
    const userId = localStorage.getItem('refresh_user_id');
    if (!refreshToken || !userId) return false;

    try {
      const { data } = await authApi.refresh(userId, refreshToken);
      saveSession(data.accessToken, data.user, data.refreshToken);
      return true;
    } catch {
      clearSession();
      return false;
    }
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch { /* ignore — clear locally regardless */ }
    clearSession();
  }

  /** Re-fetch the current user profile (e.g. after role change). */
  async function refreshUser() {
    try {
      const { data } = await authApi.me();
      user.value = data;
      localStorage.setItem('user', JSON.stringify(data));
    } catch {
      await logout();
    }
  }

  function setUser(updated: User) {
    user.value = updated;
    localStorage.setItem('user', JSON.stringify(updated));
  }

  // Hydrate immediately when the store is first used
  hydrateFromStorage();

  return {
    user,
    token,
    loading,
    error,
    isAuthenticated,
    isAdmin,
    isChecker,
    login,
    logout,
    tryRefresh,
    refreshUser,
    setUser,
  };
});
