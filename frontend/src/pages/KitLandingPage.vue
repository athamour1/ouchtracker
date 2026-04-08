<template>
  <q-page class="column items-center justify-center" :class="$q.dark.isActive ? 'bg-dark' : 'bg-grey-1'">

    <div v-if="loading" class="column items-center q-gutter-md">
      <q-spinner-medical color="primary" size="64px" />
      <div class="text-grey-6">Loading kit…</div>
    </div>

    <template v-else-if="kit">
      <!-- Kit identity -->
      <div class="column items-center q-mb-xl">
        <q-avatar color="primary" text-color="white" size="72px" class="q-mb-md">
          <q-icon name="medical_services" size="40px" />
        </q-avatar>
        <div class="text-h5 text-weight-bold text-center">{{ kit.name }}</div>
        <div v-if="kit.location" class="text-caption text-grey-6 row items-center q-mt-xs">
          <q-icon name="location_on" size="14px" class="q-mr-xs" />{{ kit.location }}
        </div>
      </div>

      <!-- 3 big action buttons -->
      <div class="column q-gutter-md" style="width: min(400px, 92vw)">

        <!-- Incident Report -->
        <q-btn no-caps rounded
          unelevated color="negative" size="xl"
          icon="warning" :label="$t('incidents.fileIncident')"
          class="landing-btn"
          :to="{ name: 'kit-incident', params: { id: kit.id }, query: { from: 'qr' } }"
        >
          <q-tooltip>Record items used in an incident</q-tooltip>
        </q-btn>

        <!-- Kit Contents -->
        <q-btn no-caps rounded
          unelevated color="primary" size="xl"
          icon="inventory_2" label="Kit Contents"
          class="landing-btn"
          :to="authStore.isAdmin
            ? { name: 'admin-kit-detail', params: { id: kit.id } }
            : { name: 'my-kit-detail', params: { id: kit.id } }"
        />

        <!-- Start Inspection -->
        <q-btn no-caps rounded
          unelevated color="teal" size="xl"
          icon="fact_check" :label="$t('kits.startInspection')"
          class="landing-btn"
          :to="{ name: 'kit-inspect', params: { id: kit.id }, query: { from: 'qr' } }"
        />

      </div>
    </template>

    <div v-else class="text-grey-6 text-h6">{{ $t('errors.notFound') }}</div>

  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { kitsApi, type Kit } from 'src/services/api';
import { useAuthStore } from 'stores/auth.store';

const { t: _t } = useI18n();
const $q = useQuasar();

const route = useRoute();
const authStore = useAuthStore();
const kitId = route.params.id as string;

const kit = ref<Kit | null>(null);
const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  try {
    kit.value = (await kitsApi.get(kitId)).data;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped lang="css">
.landing-btn {
  border-radius: 16px;
  font-size: 1.1rem;
  padding: 20px 24px;
}
</style>
