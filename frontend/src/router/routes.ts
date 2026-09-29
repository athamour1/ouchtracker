import type { RouteRecordRaw } from 'vue-router';

/**
 * Route meta convention:
 *   requiresAuth  — user must be logged in
 *   requiresAdmin — user must have role ADMIN (implies requiresAuth)
 */
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    requiresAdmin?: boolean;
  }
}

const routes: RouteRecordRaw[] = [
  // ── Public ───────────────────────────────────────────────────────────────────
  {
    path: '/login',
    name: 'login',
    component: () => import('pages/auth/LoginPage.vue'),
  },
  {
    // SSO (OIDC) login lands here with a one-time ticket
    path: '/auth/callback',
    name: 'sso-callback',
    component: () => import('pages/auth/SsoCallbackPage.vue'),
  },

  // ── Kit QR landing page (uses AppLayout, requires auth) ──────────────────────
  {
    path: '/kit/:id',
    component: () => import('layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'kit-landing',
        component: () => import('pages/KitLandingPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'incident',
        name: 'kit-incident',
        component: () => import('pages/IncidentReportPage.vue'),
        meta: { requiresAuth: true },
      },
    ],
  },

  // ── Authenticated app shell ───────────────────────────────────────────────────
  {
    path: '/',
    component: () => import('layouts/AppLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/dashboard' },

      // Shared dashboard (content adapts by role inside the component)
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('pages/DashboardPage.vue'),
        meta: { requiresAuth: true },
      },

      // Profile settings (any authenticated user)
      {
        path: 'profile',
        name: 'profile',
        component: () => import('pages/ProfilePage.vue'),
        meta: { requiresAuth: true },
      },

      // ── Admin section ─────────────────────────────────────────────────────────
      {
        path: 'admin',
        meta: { requiresAdmin: true },
        children: [
          {
            path: 'users',
            name: 'admin-users',
            component: () => import('pages/admin/UsersPage.vue'),
          },
          {
            path: 'kits',
            name: 'admin-kits',
            component: () => import('pages/admin/KitsPage.vue'),
          },
          {
            path: 'kits/:id',
            name: 'admin-kit-detail',
            component: () => import('pages/admin/KitDetailPage.vue'),
          },
          {
            path: 'inspections',
            name: 'admin-inspections',
            component: () => import('pages/admin/InspectionsPage.vue'),
          },
          {
            path: 'incidents',
            name: 'admin-incidents',
            component: () => import('pages/admin/IncidentReportsPage.vue'),
          },
        ],
      },

      // ── Checker section ───────────────────────────────────────────────────────
      {
        path: 'my-kits',
        name: 'my-kits',
        component: () => import('pages/checker/MyKitsPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'my-kits/:id',
        name: 'my-kit-detail',
        component: () => import('pages/admin/KitDetailPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'my-kits/:id/inspect',
        name: 'kit-inspect',
        component: () => import('pages/checker/KitInspectionPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'my-inspections',
        name: 'my-inspections',
        component: () => import('pages/checker/InspectionHistoryPage.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'my-incidents',
        name: 'my-incidents',
        component: () => import('pages/checker/MyIncidentsPage.vue'),
        meta: { requiresAuth: true },
      },
    ],
  },

  // ── 404 ──────────────────────────────────────────────────────────────────────
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
];

export default routes;
