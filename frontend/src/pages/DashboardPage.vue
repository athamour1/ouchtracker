<template>
  <q-page padding>

    <!-- ── Admin Dashboard ──────────────────────────────────────────────────── -->
    <template v-if="authStore.isAdmin">
      <div class="text-h5 q-mb-lg">
        <q-icon name="dashboard" class="q-mr-sm" />
        {{ $t('dashboard.adminTitle') }}
      </div>

      <!-- Summary widgets -->
      <div class="row q-col-gutter-md q-mb-lg">
        <div class="col-12 col-sm-6 col-md-3">
          <StatCard
            icon="medical_services"
            icon-color="primary"
            :label="$t('dashboard.totalActiveKits')"
            :value="summary?.totalKits ?? 0"
            :loading="loading"
          />
        </div>
        <div class="col-12 col-sm-6 col-md-3">
          <StatCard
            icon="inventory_2"
            icon-color="teal"
            :label="$t('dashboard.totalItems')"
            :value="summary?.totalItems ?? 0"
            :loading="loading"
          />
        </div>
        <div class="col-12 col-sm-6 col-md-3">
          <StatCard
            icon="warning"
            icon-color="warning"
            :label="$t('dashboard.expiringSoon')"
            :value="summary?.expiringSoonCount ?? 0"
            :loading="loading"
            :alert="(summary?.expiringSoonCount ?? 0) > 0"
          />
        </div>
        <div class="col-12 col-sm-6 col-md-3">
          <StatCard
            icon="dangerous"
            icon-color="negative"
            :label="$t('dashboard.alreadyExpired')"
            :value="summary?.expiredCount ?? 0"
            :loading="loading"
            :alert="(summary?.expiredCount ?? 0) > 0"
          />
        </div>
      </div>

      <!-- Items Needing Attention skeleton -->
      <q-card v-if="loading" flat bordered class="q-mb-md">
        <q-card-section>
          <q-skeleton type="text" width="200px" class="q-mb-sm" />
          <q-list separator>
            <q-item v-for="n in 3" :key="n" class="q-py-xs">
              <q-item-section avatar><q-skeleton type="QAvatar" size="24px" /></q-item-section>
              <q-item-section>
                <q-skeleton type="text" width="50%" />
                <q-skeleton type="text" width="30%" class="q-mt-xs" />
              </q-item-section>
              <q-item-section side><q-skeleton type="QBadge" /></q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>

      <!-- Items Needing Attention -->
      <q-card
        v-else-if="attentionItems.length > 0"
        flat bordered class="q-mb-md"
      >
        <q-card-section class="row items-center q-pb-none">
          <div class="text-subtitle1 text-weight-medium text-negative">
            <q-icon name="warning" class="q-mr-xs" />
            {{ $t('dashboard.itemsNeedingAttention') }} ({{ attentionItems.length }})
          </div>
        </q-card-section>
        <q-card-section>
          <q-list separator dense>
            <q-item
              v-for="item in attentionItems"
              :key="item.id"
              clickable
              :to="`/admin/kits/${item.kitId}`"
              class="q-py-xs"
            >
              <q-item-section avatar>
                <q-icon
                  :name="item.isExpired ? 'dangerous' : 'warning'"
                  :color="item.isExpired ? 'negative' : 'warning'"
                  size="20px"
                />
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ item.itemName }}</q-item-label>
                <q-item-label caption>{{ $t('dashboard.kit') }}: {{ item.kitName }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-badge
                  :color="item.isExpired ? 'negative' : 'warning'"
                  :label="item.isExpired ? $t('dashboard.expired') : $t('dashboard.expiringSoonBadge')"
                />
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>

      <!-- Recent Inspections -->
      <q-card flat bordered>
        <q-card-section class="row items-center q-pb-none">
          <div class="text-subtitle1 text-weight-medium">
            <q-icon name="fact_check" class="q-mr-xs" />
            {{ $t('dashboard.recentInspections') }}
          </div>
          <q-space />
          <q-btn no-caps rounded flat dense size="sm" label="View all" icon-right="arrow_forward"
            to="/admin/inspections" color="primary" />
        </q-card-section>

        <q-card-section>
          <!-- Skeleton -->
          <q-list v-if="loading" separator>
            <q-item v-for="n in 4" :key="n" class="q-py-sm">
              <q-item-section avatar>
                <q-skeleton type="QAvatar" size="36px" />
              </q-item-section>
              <q-item-section>
                <q-skeleton type="text" width="40%" />
                <q-skeleton type="text" width="60%" class="q-mt-xs" />
              </q-item-section>
              <q-item-section side>
                <q-skeleton type="text" width="80px" />
              </q-item-section>
            </q-item>
          </q-list>

          <q-list separator v-else-if="summary?.recentInspections?.length">
            <q-item
              v-for="log in summary.recentInspections"
              :key="log.id"
              class="q-py-sm"
            >
              <q-item-section avatar>
                <q-avatar color="primary" text-color="white" size="36px">
                  <q-icon name="person" />
                </q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ log.inspectedBy.fullName }}</q-item-label>
                <q-item-label caption>
                  {{ $t('dashboard.kit') }}: <strong>{{ log.kit.name }}</strong>
                </q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-item-label caption>{{ formatDate(log.createdAt) }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>

          <div v-else class="text-grey-6 text-center q-py-md">
            {{ $t('dashboard.noInspectionsYet') }}
          </div>
        </q-card-section>
      </q-card>
    </template>

    <!-- ── Checker Dashboard ─────────────────────────────────────────────────── -->
    <template v-else>
      <div class="text-h5 q-mb-lg">
        {{ $t('dashboard.welcomeChecker', { name: authStore.user?.fullName }) }}
      </div>

      <!-- Checker summary widgets -->
      <div class="row q-col-gutter-md q-mb-lg">
        <div class="col-12 col-sm-4">
          <StatCard icon="inventory" icon-color="primary"
            :label="$t('dashboard.assignedKits')" :value="myKits.length" :loading="myKitsLoading" />
        </div>
        <div class="col-12 col-sm-4">
          <StatCard icon="dangerous" icon-color="negative"
            :label="$t('dashboard.expiredItems')" :value="totalExpired" :loading="myKitsLoading"
            :alert="totalExpired > 0" />
        </div>
        <div class="col-12 col-sm-4">
          <StatCard icon="warning" icon-color="warning"
            :label="$t('dashboard.expiringSoonItems')" :value="totalExpiringSoon" :loading="myKitsLoading"
            :alert="totalExpiringSoon > 0" />
        </div>
      </div>

      <!-- Quick-access kit cards -->
      <div class="text-subtitle1 text-weight-medium q-mb-sm">
        <q-icon name="bolt" class="q-mr-xs" />{{ $t('dashboard.quickAccess') }}
      </div>

      <div v-if="myKitsLoading" class="row q-col-gutter-md">
        <div v-for="n in 2" :key="n" class="col-12 col-sm-6">
          <q-card flat bordered><q-card-section><q-skeleton type="rect" height="60px" /></q-card-section></q-card>
        </div>
      </div>

      <div v-else-if="!myKits.length" class="text-grey-6 q-py-md">
        {{ $t('dashboard.noKitsAssigned') }}
      </div>

      <div v-else class="row q-col-gutter-md">
        <div v-for="kit in myKits.slice(0, 4)" :key="kit.id" class="col-12 col-sm-6">
          <q-card flat bordered class="cursor-pointer quick-kit-card"
            @click="router.push({ name: 'my-kit-detail', params: { id: kit.id } })">
            <q-card-section class="row items-center q-py-sm">
              <q-icon name="medical_services" color="primary" size="24px" class="q-mr-sm" />
              <div class="col">
                <div class="text-weight-medium">{{ kit.name }}</div>
                <div class="text-caption text-grey-6">{{ kit.location || $t('dashboard.noLocation') }}</div>
              </div>
              <q-badge v-if="kitExpiredCount(kit) > 0" color="negative" :label="`${kitExpiredCount(kit)} expired`" />
              <q-icon name="chevron_right" color="grey-5" />
            </q-card-section>
          </q-card>
        </div>
      </div>

      <q-btn no-caps rounded
        v-if="myKits.length"
        flat color="primary" :label="$t('dashboard.viewAllKits')"
        icon-right="arrow_forward" to="/my-kits"
        class="q-mt-md"
      />
    </template>

  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { alertsApi, kitsApi, type AlertSummary, type Kit } from 'src/services/api';
import { useAuthStore } from 'stores/auth.store';
import StatCard from 'components/StatCard.vue';
import { date } from 'quasar';

const { t: _t } = useI18n();
const authStore = useAuthStore();
const router = useRouter();

// Admin state
const summary = ref<AlertSummary | null>(null);
const loading = ref(false);
const allKits = ref<Kit[]>([]);

const ATTENTION_DAYS = 30;
const attentionItems = computed(() => {
  const threshold = Date.now() + ATTENTION_DAYS * 24 * 60 * 60 * 1000;
  const result: { id: string; kitId: string; kitName: string; itemName: string; isExpired: boolean }[] = [];
  for (const kit of allKits.value) {
    for (const item of kit.kitItems) {
      const isExpired = !item.isValid;
      const isExpiringSoon =
        item.isValid &&
        !!item.expirationDate &&
        new Date(item.expirationDate).getTime() <= threshold;
      if (isExpired || isExpiringSoon) {
        result.push({ id: item.id, kitId: kit.id, kitName: kit.name, itemName: item.name, isExpired });
      }
    }
  }
  return result.sort((a, b) => Number(b.isExpired) - Number(a.isExpired));
});

// Checker state
const myKits = ref<Kit[]>([]);
const myKitsLoading = ref(false);

const EXPIRY_WARNING_DAYS = 30;

const totalExpired = computed(() =>
  myKits.value.reduce((sum, k) => sum + k.kitItems.filter((i) => !i.isValid).length, 0),
);

const totalExpiringSoon = computed(() => {
  const threshold = Date.now() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000;
  return myKits.value.reduce(
    (sum, k) =>
      sum +
      k.kitItems.filter(
        (i) => i.isValid && !!i.expirationDate && new Date(i.expirationDate).getTime() <= threshold,
      ).length,
    0,
  );
});

function kitExpiredCount(kit: Kit) {
  return kit.kitItems.filter((i) => !i.isValid).length;
}

function formatDate(iso: string) {
  return date.formatDate(iso, 'DD MMM YYYY, HH:mm');
}

onMounted(async () => {
  if (authStore.isAdmin) {
    loading.value = true;
    try {
      const [summaryRes, kitsRes] = await Promise.all([alertsApi.summary(), kitsApi.list()]);
      summary.value = summaryRes.data;
      allKits.value = kitsRes.data;
    } finally {
      loading.value = false;
    }
  } else {
    myKitsLoading.value = true;
    try {
      const { data } = await kitsApi.myKits();
      myKits.value = data;
    } finally {
      myKitsLoading.value = false;
    }
  }
});
</script>
