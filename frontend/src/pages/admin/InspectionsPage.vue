<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h5"><q-icon name="fact_check" class="q-mr-sm" />Inspection Logs</div>
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

    <q-card flat bordered>
      <q-table
        :rows="logs" :columns="columns" row-key="id"
        :loading="loading" flat :pagination="{ rowsPerPage: 20 }"
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
              <q-btn flat dense round
                :icon="props.expand ? 'expand_less' : 'expand_more'"
                size="sm"
                @click="props.expand = !props.expand"
              />
            </q-td>
            <q-td v-for="col in props.cols" :key="col.name" :props="props">
              <template v-if="col.name === 'createdAt'">{{ formatDate(col.value as string) }}</template>
              <template v-else-if="col.name === 'inspector'">{{ props.row.inspectedBy.fullName }}</template>
              <template v-else-if="col.name === 'kit'">{{ props.row.kit.name }}</template>
              <template v-else-if="col.name === 'itemCount'">
                <q-badge color="primary" :label="props.row.items.length" />
              </template>
              <template v-else>{{ col.value }}</template>
            </q-td>
          </q-tr>

          <!-- Expanded items sub-table -->
          <q-tr v-show="props.expand" :props="props" :class="$q.dark.isActive ? 'bg-grey-9' : 'bg-grey-1'">
            <q-td colspan="100%" style="padding: 0;">
              <div class="q-pa-sm" style="overflow-x: auto;">
                <div class="text-subtitle2 q-mb-sm text-grey-7">
                  Items inspected — {{ props.row.items.length }} item(s)
                </div>
                <q-markup-table dense flat bordered separator="cell" style="min-width: 480px;">
                  <thead>
                    <tr :class="$q.dark.isActive ? 'bg-grey-9' : 'bg-grey-2'">
                      <th class="text-left">Item</th>
                      <th>Qty Found</th>
                      <th>Expiry Found</th>
                      <th class="text-left">Notes</th>
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
                <div v-if="props.row.notes" class="q-mt-sm text-caption text-grey-7">
                  <strong>Inspector notes:</strong> {{ props.row.notes }}
                </div>
              </div>
            </q-td>
          </q-tr>
        </template>
      </q-table>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useQuasar, date, type QTableColumn } from 'quasar';

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
  { name: 'createdAt', label: 'Date',      field: 'createdAt',  sortable: true, align: 'left' },
  { name: 'kit',       label: 'Kit',       field: 'kit',        align: 'left' },
  { name: 'inspector', label: 'Inspector', field: 'inspectedBy', align: 'left' },
  { name: 'itemCount', label: 'Items',     field: 'items',      align: 'center' },
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
