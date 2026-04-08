<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h5"><q-icon name="fact_check" class="q-mr-sm" />{{ $t('inspections.title') }}</div>
      <q-space />
      <q-select
        v-model="filterKitId"
        :options="kitOptions"
        label="Filter by Kit"
        dense outlined clearable
        emit-value map-options
        style="min-width: 220px"
        @update:model-value="loadLogs"
      />
    </div>

    <!-- Skeleton -->
    <q-card v-if="loading" flat bordered>
      <q-card-section>
        <q-item v-for="n in 8" :key="n" class="q-py-sm">
          <q-item-section><q-skeleton type="text" width="20%" /></q-item-section>
          <q-item-section><q-skeleton type="text" width="35%" /></q-item-section>
          <q-item-section><q-skeleton type="text" width="30%" /></q-item-section>
          <q-item-section side><q-skeleton type="QBadge" /></q-item-section>
        </q-item>
      </q-card-section>
    </q-card>

    <q-card v-else flat bordered style="overflow: hidden;">
      <q-table
        :rows="logs" :columns="columns" row-key="id"
        flat :pagination="{ rowsPerPage: 20 }"
      >
        <template #body-cell-createdAt="props">
          <q-td :props="props">{{ formatDate(props.value) }}</q-td>
        </template>

        <template #body-cell-inspector="props">
          <q-td :props="props">{{ props.row.inspectedBy.fullName }}</q-td>
        </template>

        <template #body-cell-kit="props">
          <q-td :props="props">{{ props.row.kit.name }}</q-td>
        </template>

        <template #body-cell-itemCount="props">
          <q-td :props="props">
            <q-badge color="primary" :label="props.row.items.length" />
          </q-td>
        </template>

        <!-- Expandable row: inline items -->
        <template #body="props">
          <q-tr :props="props">
            <q-td auto-width>
              <q-btn no-caps rounded flat dense round
                :icon="props.expand ? 'expand_less' : 'expand_more'"
                size="sm"
                @click="props.expand = !props.expand"
              />
            </q-td>
            <q-td key="createdAt" :props="props">{{ formatDate(props.row.createdAt) }}</q-td>
            <q-td key="kit" :props="props">{{ props.row.kit.name }}</q-td>
            <q-td key="inspector" :props="props">{{ props.row.inspectedBy.fullName }}</q-td>
            <q-td key="itemCount" :props="props">
              <q-badge color="primary" :label="props.row.items.length" />
            </q-td>
          </q-tr>

          <!-- Expanded items sub-table -->
          <q-tr v-show="props.expand" :props="props" :class="$q.dark.isActive ? 'bg-grey-9' : 'bg-grey-1'">
            <q-td colspan="100%" style="padding: 0;">
              <div class="q-pa-sm" style="max-height: 260px; overflow-y: auto;">
                <div v-if="props.row.notes" class="q-mb-sm text-caption text-grey-7">
                  <strong>Inspector notes:</strong> {{ props.row.notes }}
                </div>
                <div class="text-subtitle2 q-mb-sm text-grey-7">
                  Items inspected — {{ props.row.items.length }} item(s)
                </div>
                <q-markup-table dense flat bordered separator="cell">
                  <thead>
                    <tr :class="$q.dark.isActive ? 'bg-grey-9' : 'bg-grey-2'">
                      <th class="text-left">{{ $t('kitDetail.itemName') }}</th>
                      <th>{{ $t('inspections.quantityFound') }}</th>
                      <th>{{ $t('inspections.expirationDate') }}</th>
                      <th class="text-left">{{ $t('inspections.itemNotes') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="li in props.row.items" :key="li.id">
                      <td>{{ li.kitItem.name }}</td>
                      <td class="text-center">{{ li.quantityFound }}</td>
                      <td class="text-center">
                        {{ li.expirationDateFound ? formatDate(li.expirationDateFound) : '—' }}
                      </td>
                      <td>{{ li.notes ?? '—' }}</td>
                    </tr>
                  </tbody>
                </q-markup-table>
              </div>
            </q-td>
          </q-tr>
        </template>

        <template #no-data>
          <div class="full-width column flex-center q-pa-xl text-grey-5">
            <q-icon name="fact_check" size="48px" class="q-mb-sm" />
            {{ $t('inspections.noLogs') }}
          </div>
        </template>
      </q-table>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useQuasar, date, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const $q = useQuasar();
import { inspectionsApi, kitsApi, type InspectionLog, type Kit } from 'src/services/api';
import { useNotify } from 'src/composables/useNotify';

const notify = useNotify();
const logs = ref<InspectionLog[]>([]);
const loading = ref(false);
const filterKitId = ref<string | undefined>(undefined);
const kitOptions = ref<{ label: string; value: string }[]>([]);

function formatDate(iso: string) {
  return date.formatDate(iso, 'DD MMM YYYY, HH:mm');
}

const columns: QTableColumn[] = [
  { name: 'expand',    label: '',                        field: () => '',     align: 'center', style: 'width: 48px' },
  { name: 'createdAt', label: t('common.date'),          field: 'createdAt',  sortable: true, align: 'left' },
  { name: 'kit',       label: t('dashboard.kit'),        field: 'kit',        align: 'left' },
  { name: 'inspector', label: t('inspections.inspector'),field: 'inspectedBy', align: 'left' },
  { name: 'itemCount', label: t('inspections.itemCount'),field: 'items',      align: 'center' },
];

async function loadLogs() {
  loading.value = true;
  try {
    const { data } = await inspectionsApi.list(filterKitId.value);
    logs.value = data;
  } catch (e) { notify.error(e, 'Failed to load inspections'); }
  finally { loading.value = false; }
}

onMounted(async () => {
  try {
    const { data: kits } = await kitsApi.list();
    kitOptions.value = (kits as Kit[]).map((k) => ({ label: k.name, value: k.id }));
  } catch { /* non-critical */ }
  void loadLogs();
});
</script>
