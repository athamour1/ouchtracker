<template>
  <q-layout view="hHh lpR fFf">

    <!-- ── Top header ───────────────────────────────────────────────────────── -->
    <q-header class="bg-primary text-white">
      <q-toolbar>
        <q-btn no-caps rounded flat dense round icon="menu" :aria-label="$t('nav.menu')" @click="toggleDrawer" />
        <q-toolbar-title class="row items-center gap-sm">
          <q-icon name="medical_services" size="22px" class="q-mr-xs" />
          {{ $t('app.name') }}
        </q-toolbar-title>
        <q-btn no-caps rounded
          flat dense round
          :icon="$q.dark.isActive ? 'light_mode' : 'dark_mode'"
          :aria-label="$q.dark.isActive ? $t('theme.lightMode') : $t('theme.darkMode')"
          @click="toggleDark"
        >
          <q-tooltip>{{ $q.dark.isActive ? $t('theme.lightMode') : $t('theme.darkMode') }}</q-tooltip>
        </q-btn>

        <!-- Offline badge -->
        <q-badge v-if="!isOnline" color="grey-7" class="q-mr-sm">
          <q-icon name="cloud_off" size="12px" class="q-mr-xs" />
          {{ $t('offline.offlineShort') }}
          <q-badge v-if="syncQueue.pendingCount > 0" floating color="warning" :label="syncQueue.pendingCount" />
        </q-badge>

        <!-- PWA install button — only shown when installable -->
        <q-btn no-caps rounded
          v-if="isInstallable"
          flat dense round
          icon="install_mobile"
          :aria-label="$t('pwa.installApp')"
          @click="handleInstall"
        >
          <q-tooltip>{{ $t('pwa.installApp') }}</q-tooltip>
        </q-btn>
      </q-toolbar>

      <!-- PWA install banner -->
      <transition name="slide-down">
        <div v-if="isInstallable && showBanner" class="install-banner row items-center q-px-md q-py-sm">
          <q-icon name="install_mobile" size="20px" class="q-mr-sm" />
          <div class="col text-body2">{{ $t('pwa.installPrompt') }}</div>
          <q-btn no-caps rounded flat dense :label="$t('pwa.install')" color="white" class="q-mr-xs" @click="handleInstall" />
          <q-btn no-caps rounded flat dense round icon="close" color="white" :aria-label="$t('pwa.dismissInstallBanner')" @click="dismissBanner" />
        </div>
      </transition>
    </q-header>

    <!-- ── Left drawer / sidebar ─────────────────────────────────────────────── -->
    <q-drawer
      v-model="drawerOpen"
      show-if-above
      :width="240"
      :breakpoint="700"
      bordered
      :class="[$q.dark.isActive ? 'bg-grey-10' : 'bg-grey-1', 'column']"
      style="overflow: hidden; height: calc(100vh - 50px); max-height: calc(100vh - 50px);"
    >
      <!-- Branding strip -->
      <!-- <div class="drawer-brand bg-primary text-white q-pa-md row items-center q-gutter-sm">
        <q-icon name="medical_services" size="28px" />
        <div>
          <div class="text-subtitle2 text-weight-bold">OuchTracker</div>
          <div class="text-caption opacity-70">Injury & Kit Tracker</div>
        </div>
      </div> -->

      <!-- Nav links — scrollable -->
      <q-scroll-area class="col" style="width: 100%; min-height: 0;">
        <q-list padding>

          <q-item-label header class="text-grey-7 text-caption text-uppercase">
            {{ $t('nav.general') }}
          </q-item-label>
          <NavItem icon="dashboard" :label="$t('nav.dashboard')" to="/dashboard" />

          <!-- Admin links -->
          <template v-if="authStore.isAdmin">
            <q-separator class="q-my-sm" />
            <q-item-label header class="text-grey-7 text-caption text-uppercase">
              {{ $t('nav.administration') }}
            </q-item-label>
            <NavItem icon="people"           :label="$t('nav.users')"       to="/admin/users" />
            <NavItem icon="medical_services" :label="$t('nav.kits')"        to="/admin/kits" />
            <NavItem icon="fact_check"       :label="$t('nav.inspections')" to="/admin/inspections" />
            <NavItem icon="warning"          :label="$t('nav.incidents')"   to="/admin/incidents" />
          </template>

          <!-- Checker links -->
          <template v-if="authStore.isChecker">
            <q-separator class="q-my-sm" />
            <q-item-label header class="text-grey-7 text-caption text-uppercase">
              {{ $t('nav.myWork') }}
            </q-item-label>
            <NavItem icon="inventory"  :label="$t('nav.myKits')"         to="/my-kits" />
            <NavItem icon="fact_check" :label="$t('nav.myInspections')"  to="/my-inspections" />
            <NavItem icon="warning"    :label="$t('nav.myIncidents')"    to="/my-incidents" />
          </template>

        </q-list>
      </q-scroll-area>

      <!-- ── User + Logout — pinned to bottom ──────────────────────────────── -->
      <div :class="['drawer-footer q-pa-md', $q.dark.isActive ? 'bg-grey-9' : 'bg-grey-2']">
        <NavItem icon="manage_accounts" :label="$t('nav.profileSettings')" to="/profile" class="q-mx-none" />
        <q-separator class="q-mb-sm" />
        <div class="row items-center q-mb-sm q-gutter-sm">
          <q-avatar color="primary" text-color="white" size="36px">
            <q-icon name="account_circle" size="22px" />
          </q-avatar>
          <div class="col ellipsis">
            <div class="text-body2 text-weight-medium ellipsis">
              {{ authStore.user?.fullName ?? authStore.user?.email }}
            </div>
            <q-chip
              dense size="sm"
              :color="authStore.isAdmin ? 'orange' : 'teal'"
              text-color="white"
              :label="authStore.isAdmin ? $t('users.roleAdmin') : $t('users.roleChecker')"
              class="q-ma-none"
            />
          </div>
        </div>
        <q-btn no-caps rounded
          unelevated color="primary" icon="logout" :label="$t('nav.signOut')"
          class="full-width" size="sm"
          @click="handleLogout"
        />
      </div>

    </q-drawer>

    <!-- ── Page content ──────────────────────────────────────────────────────── -->
    <q-page-container>
      <router-view />
    </q-page-container>

  </q-layout>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from 'stores/auth.store';
import { oidcEnabled, ssoLogout } from 'src/lib/oidc';
import { usePwaInstall } from 'src/composables/usePwaInstall';
import { useOnline } from 'src/composables/useOnline';
import { useSyncQueue } from 'src/stores/sync-queue.store';
import { useNotify } from 'src/composables/useNotify';
import { prewarmCache } from 'src/composables/useDataPrewarm';
import NavItem from 'components/NavItem.vue';

const { t } = useI18n();
const $q = useQuasar();
const authStore = useAuthStore();
const router = useRouter();
const drawerOpen = ref($q.screen.gt.sm);
const { isOnline } = useOnline();
const syncQueue = useSyncQueue();
const notify = useNotify();

// Auto-flush queued submissions and refresh cache when connectivity returns
watch(isOnline, async (online) => {
  if (!online) return;
  if (syncQueue.hasPending) {
    const { submitted, failed } = await syncQueue.flush();
    if (submitted > 0 && failed === 0) {
      notify.success(t('offline.syncSuccess', { n: submitted }));
    } else if (submitted > 0 && failed > 0) {
      notify.success(t('offline.syncPartial', { n: submitted, f: failed }));
    } else if (failed > 0) {
      notify.error(null, t('offline.syncPartial', { n: 0, f: failed }));
    }
  }
  void prewarmCache(authStore.isAdmin);
});

// Pre-warm on mount and whenever the tab becomes visible again
function onVisibilityChange() {
  if (document.visibilityState === 'visible' && isOnline.value) {
    void prewarmCache(authStore.isAdmin);
  }
}

onMounted(() => {
  if (isOnline.value) void prewarmCache(authStore.isAdmin);
  document.addEventListener('visibilitychange', onVisibilityChange);
});

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange);
});

const { isInstallable, install } = usePwaInstall();
const showBanner = ref(localStorage.getItem('pwa-banner-dismissed') !== 'true');

function dismissBanner() {
  showBanner.value = false;
  localStorage.setItem('pwa-banner-dismissed', 'true');
}

async function handleInstall() {
  showBanner.value = false;
  await install();
}

function toggleDrawer() {
  drawerOpen.value = !drawerOpen.value;
}

function toggleDark() {
  $q.dark.toggle();
  localStorage.setItem('darkMode', String($q.dark.isActive));
}

// Restore preference on load
const saved = localStorage.getItem('darkMode');
if (saved !== null) $q.dark.set(saved === 'true');

async function handleLogout() {
  await authStore.logout();
  // Single Logout: τερματίζουμε και τη συνεδρία του Authentik, ώστε να βγει ο
  // χρήστης από ΟΛΕΣ τις εφαρμογές του SSO (ένα account → ένα logout). Σε
  // κοινόχρηστο υπολογιστή μια «αποσύνδεση» που αφήνει ζωντανό το IdP είναι
  // ψεύτικη. Το νέο login μετά είναι ένα κλικ και ξαναμπαίνει παντού.
  if (oidcEnabled) {
    await ssoLogout();
    return;
  }
  await router.push({ name: 'login' });
}
</script>

<style scoped lang="css">
.install-banner {
  background: rgba(0, 0, 0, 0.25);
  border-top: 1px solid rgba(255, 255, 255, 0.15);
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.25s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.drawer-brand {
  height: 72px;
  flex-shrink: 0;
}
.drawer-footer {
  flex-shrink: 0;
  border-top: 1px solid #e0e0e0;
}
.body--dark .drawer-footer {
  border-top: 1px solid #444;
}
</style>
