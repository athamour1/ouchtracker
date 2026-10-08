import { defineRouter } from '#q-app/wrappers';
import {
  createMemoryHistory,
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from 'vue-router';
import routes from './routes';
import { useAuthStore } from 'stores/auth.store';
import { oidcEnabled, trySilentAccessToken } from 'src/lib/oidc';

export default defineRouter(function () {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : process.env.VUE_ROUTER_MODE === 'history'
      ? createWebHistory
      : createWebHashHistory;

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    history: createHistory(process.env.VUE_ROUTER_BASE),
  });

  // Σιωπηλό SSO μία φορά ανά φόρτωση: αν υπάρχει ενεργή συνεδρία Authentik, την
  // «τσιμπάμε» μέσα στον guard ΠΡΙΝ δείξουμε login — μηδενική ενδιάμεση οθόνη.
  let silentTried = false;

  // ── Navigation guard ─────────────────────────────────────────────────────────
  Router.beforeEach(async (to) => {
    // Lazy-init: store must be called inside the guard (after Pinia is ready)
    const auth = useAuthStore();

    const requiresAuth = to.matched.some((r) => r.meta.requiresAuth);
    const requiresAdmin = to.matched.some((r) => r.meta.requiresAdmin);

    // 0. Χωρίς συνεδρία αλλά με ζωντανή συνεδρία Authentik → login χωρίς flash.
    if (requiresAuth && !auth.isAuthenticated && oidcEnabled && !silentTried && !to.query.local) {
      silentTried = true;
      const token = await trySilentAccessToken();
      if (token) await auth.loginWithOidc(token);
    }

    // 1. Not logged in → redirect to /login (unless already going there)
    if (requiresAuth && !auth.isAuthenticated) {
      return { name: 'login', query: { redirect: to.fullPath } };
    }

    // 2. Logged in but tries to visit /login → go to dashboard
    if (to.name === 'login' && auth.isAuthenticated) {
      return { name: 'dashboard' };
    }

    // 3. Admin-only route but user is not admin
    if (requiresAdmin && !auth.isAdmin) {
      return { name: 'dashboard' };
    }

    // All checks passed — allow navigation
  });

  return Router;
});
