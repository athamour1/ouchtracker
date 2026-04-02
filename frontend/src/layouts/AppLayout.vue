<template>
  <q-layout view="hHh lpR fFf">

    <!-- ── Top header ───────────────────────────────────────────────────────── -->
    <q-header elevated class="bg-primary text-white">
      <q-toolbar>
        <q-btn flat dense round icon="menu" aria-label="Menu" @click="toggleDrawer" />
        <q-toolbar-title class="row items-center gap-sm">
          <q-icon name="medical_services" size="22px" class="q-mr-xs" />
          FAK CRM
        </q-toolbar-title>
        <q-btn
          flat dense round
          :icon="$q.dark.isActive ? 'light_mode' : 'dark_mode'"
          @click="toggleDark"
        >
          <q-tooltip>{{ $q.dark.isActive ? 'Light mode' : 'Dark mode' }}</q-tooltip>
        </q-btn>
      </q-toolbar>
    </q-header>

    <!-- ── Left drawer / sidebar ─────────────────────────────────────────────── -->
    <q-drawer
      v-model="drawerOpen"
      show-if-above
      :width="240"
      :breakpoint="700"
      bordered
      :class="[$q.dark.isActive ? 'bg-grey-10' : 'bg-grey-1', 'column']"
    >
      <!-- Branding strip -->
      <!-- <div class="drawer-brand bg-primary text-white q-pa-md row items-center q-gutter-sm">
        <q-icon name="medical_services" size="28px" />
        <div>
          <div class="text-subtitle2 text-weight-bold">FAK CRM</div>
          <div class="text-caption opacity-70">First Aid Kit Management</div>
        </div>
      </div> -->

      <!-- Nav links — scrollable -->
      <q-scroll-area class="col" style="width: 100%;">
        <q-list padding>

          <q-item-label header class="text-grey-7 text-caption text-uppercase">
            General
          </q-item-label>
          <NavItem icon="dashboard" label="Dashboard" to="/dashboard" />

          <!-- Admin links -->
          <template v-if="authStore.isAdmin">
            <q-separator class="q-my-sm" />
            <q-item-label header class="text-grey-7 text-caption text-uppercase">
              Administration
            </q-item-label>
            <NavItem icon="people"           label="Users"        to="/admin/users" />
            <NavItem icon="medical_services" label="Kits"         to="/admin/kits" />
            <NavItem icon="fact_check"       label="Inspections"  to="/admin/inspections" />
            <NavItem icon="warning"          label="Incidents"    to="/admin/incidents" />
          </template>

          <!-- Checker links -->
          <template v-if="authStore.isChecker">
            <q-separator class="q-my-sm" />
            <q-item-label header class="text-grey-7 text-caption text-uppercase">
              My Work
            </q-item-label>
            <NavItem icon="inventory"  label="My Kits"        to="/my-kits" />
            <NavItem icon="fact_check" label="My Inspections" to="/my-inspections" />
            <NavItem icon="warning"    label="My Incidents"   to="/my-incidents" />
          </template>

        </q-list>
      </q-scroll-area>

      <!-- ── User + Logout — pinned to bottom ──────────────────────────────── -->
      <div :class="['drawer-footer q-pa-md', $q.dark.isActive ? 'bg-grey-9' : 'bg-grey-2']">
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
              :label="authStore.isAdmin ? 'Admin' : 'Checker'"
              class="q-ma-none"
            />
          </div>
        </div>
        <q-btn
          unelevated color="primary" icon="logout" label="Sign Out"
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
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import { useAuthStore } from 'stores/auth.store';
import NavItem from 'components/NavItem.vue';

const $q = useQuasar();
const authStore = useAuthStore();
const router = useRouter();
const drawerOpen = ref(true);

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
  authStore.logout();
  await router.push({ name: 'login' });
}
</script>

<style scoped lang="css">
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
