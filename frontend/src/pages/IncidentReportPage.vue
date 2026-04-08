<template>
  <q-page padding class="incident-page">

    <!-- Header -->
    <div class="row items-center q-mb-md">
      <q-btn no-caps rounded flat round dense icon="arrow_back" class="q-mr-sm"
        :to="backRoute" />
      <div class="col">
        <div class="text-h5 text-negative row items-center">
          <q-icon name="warning" class="q-mr-sm" />{{ $t('incidents.fileIncident') }}
        </div>
        <div class="text-caption text-grey-6" v-if="kit">Kit: <strong>{{ kit.name }}</strong></div>
      </div>
    </div>

    <div v-if="loading" class="q-py-xl text-center text-grey-6">
      <q-spinner color="primary" size="48px" />
    </div>

    <template v-else-if="kit">

      <!-- Description -->
      <q-input
        v-model="description"
        :label="$t('incidents.description')"
        outlined dense type="textarea" autogrow :rows="2"
        class="q-mb-md"
      >
        <template #prepend><q-icon name="edit_note" /></template>
      </q-input>

      <!-- Search bar -->
      <q-input
        v-model="search"
        outlined dense clearable
        :placeholder="$t('incidents.selectItem')"
        class="q-mb-sm"
        @focus="showResults = true"
        @blur="onSearchBlur"
      >
        <template #prepend><q-icon name="search" /></template>
      </q-input>

      <!-- Search results dropdown -->
      <q-card
        v-if="showResults && search && searchResults.length"
        flat bordered class="q-mb-md search-results"
      >
        <q-list dense separator>
          <q-item
            v-for="item in searchResults"
            :key="item.id"
            clickable
            @mousedown.prevent="addItem(item)"
          >
            <q-item-section>
              <q-item-label>{{ item.name }}</q-item-label>
              <q-item-label caption>
                {{ item.category || '' }}{{ item.unit ? ` · ${item.unit}` : '' }}
                · Available: {{ item.quantity }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-icon name="add_circle" color="primary" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>

      <div
        v-if="showResults && search && !searchResults.length"
        class="text-caption text-grey-5 q-mb-md q-pl-sm"
      >
        No matching items found.
      </div>

      <!-- Incident items list -->
      <div v-if="incidentItems.length" class="q-mb-xl">
        <div class="text-subtitle2 text-grey-7 q-mb-sm">
          {{ $t('incidents.addItem') }} ({{ incidentItems.length }})
        </div>

        <q-card
          v-for="(item, idx) in incidentItems"
          :key="item.id"
          flat bordered class="q-mb-sm incident-item"
        >
          <q-card-section class="q-py-sm">
            <!-- Row 1: name + qty + remove -->
            <div class="row items-center no-wrap q-gutter-sm q-mb-xs">
              <div class="col text-weight-medium">{{ item.name }}</div>
              <q-input
                v-model.number="item.quantityUsed"
                type="number" outlined dense :label="$t('incidents.quantityUsed')"
                min="0" :max="item.quantity"
                style="width: 90px"
                :rules="[(v) => v >= 0 || '≥0']"
                hide-bottom-space
              />
              <q-btn no-caps rounded flat round dense icon="close" color="negative" size="sm"
                @click="incidentItems.splice(idx, 1)" />
            </div>
            <!-- Row 2: notes paragraph -->
            <q-input
              v-model="item.notes"
              outlined dense :label="$t('incidents.itemNotes')" clearable
              type="textarea" autogrow :rows="2"
            />
          </q-card-section>
        </q-card>
      </div>

      <div v-else class="text-grey-5 text-center q-py-lg q-mb-xl">
        Search for items above and add them to the report.
      </div>

    </template>

    <!-- ── Sticky submit bar ──────────────────────────────────────────────────── -->
    <div class="submit-bar" v-if="kit && !loading">
      <q-btn no-caps rounded flat :label="$t('common.cancel')" :to="backRoute" />
      <q-btn no-caps rounded
        unelevated color="negative" icon="send" :label="$t('incidents.submitReport')"
        :loading="submitting"
        :disable="incidentItems.length === 0"
        @click="submit"
      />
    </div>

    <!-- Success -->
    <q-dialog v-model="successDialog" persistent>
      <q-card class="text-center q-pa-lg" style="min-width: 300px">
        <q-icon name="check_circle" color="positive" size="64px" class="q-mb-md" />
        <div class="text-h6 q-mb-xs">{{ $t('incidents.reportSubmitted') }}</div>
        <div class="text-body2 text-grey-7 q-mb-lg">
          Quantities have been updated for <strong>{{ kit?.name }}</strong>.
        </div>
        <q-btn no-caps rounded unelevated color="primary" :label="$t('common.backToDashboard')"
          :to="backRoute" />
      </q-card>
    </q-dialog>

  </q-page>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, type RouteLocationRaw } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { kitsApi, incidentsApi, type Kit } from 'src/services/api';
import { useNotify } from 'src/composables/useNotify';

const { t } = useI18n();
const route = useRoute();
const notify = useNotify();
const kitId = route.params.id as string;
const backRoute: RouteLocationRaw = route.query['from'] === 'qr'
  ? { name: 'dashboard' }
  : { name: 'kit-landing', params: { id: kitId } };

const kit = ref<Kit | null>(null);
const loading = ref(false);
const submitting = ref(false);
const successDialog = ref(false);
const description = ref('');
const search = ref('');
const showResults = ref(false);

interface IncidentItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  quantityUsed: number;
  notes: string;
}

const incidentItems = ref<IncidentItem[]>([]);

const allItems = computed(() => kit.value?.kitItems ?? []);

const searchResults = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return [];
  const alreadyAdded = new Set(incidentItems.value.map((i) => i.id));
  return allItems.value.filter(
    (i) =>
      !alreadyAdded.has(i.id) &&
      i.quantity > 0 &&
      (i.name.toLowerCase().includes(q) ||
        (i.category ?? '').toLowerCase().includes(q) ||
        (i.locationInKit ?? '').toLowerCase().includes(q)),
  );
});

function addItem(item: (typeof allItems.value)[number]) {
  incidentItems.value.push({
    id: item.id,
    name: item.name,
    category: item.category ?? '',
    unit: item.unit ?? '',
    quantity: item.quantity,
    quantityUsed: 0,
    notes: '',
  });
  search.value = '';
  showResults.value = false;
}

function onSearchBlur() {
  // small delay so mousedown on result fires first
  setTimeout(() => { showResults.value = false; }, 150);
}

async function submit() {
  submitting.value = true;
  try {
    await incidentsApi.submit({
      kitId,
      ...(description.value && { description: description.value }),
      items: incidentItems.value.map((i) => ({
        kitItemId: i.id,
        quantityUsed: i.quantityUsed,
        ...(i.notes && { notes: i.notes }),
      })),
    });
    successDialog.value = true;
  } catch (e) {
    notify.error(e, t('incidents.submitReport'));
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  loading.value = true;
  try {
    kit.value = (await kitsApi.get(kitId)).data;
  } catch (e) {
    notify.error(e, 'Failed to load kit');
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped lang="css">
.incident-page {
  max-width: 760px;
  margin: 0 auto;
  padding-bottom: 80px;
}

.search-results {
  position: relative;
  z-index: 10;
}

.incident-item {
  border-left: 3px solid #c10015;
}

.submit-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background: white;
  border-top: 1px solid #e0e0e0;
  box-shadow: 0 -2px 12px rgba(0,0,0,0.08);
}
.body--dark .submit-bar {
  background: #1d1d1d;
  border-top: 1px solid #444;
  box-shadow: 0 -2px 12px rgba(0,0,0,0.4);
}
</style>
