<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h5"><q-icon name="warning" class="q-mr-sm" color="negative" />Incident Reports</div>
      <q-space />
      <q-select
        v-model="filterKitId"
        :options="kitOptions"
        label="Filter by Kit"
        dense outlined clearable
        emit-value map-options
        style="min-width: 220px"
        @update:model-value="loadReports"
      />
    </div>

    <q-card flat bordered style="overflow: hidden;">
      <q-table
        :rows="reports" :columns="columns" row-key="id"
        :loading="loading" flat :pagination="{ rowsPerPage: 20 }"
      >
        <template #body="props">
          <q-tr :props="props">
            <q-td auto-width>
              <q-btn flat dense round size="sm"
                :icon="props.expand ? 'expand_less' : 'expand_more'"
                @click="props.expand = !props.expand"
              />
            </q-td>
            <q-td key="createdAt" :props="props">{{ formatDate(props.row.createdAt) }}</q-td>
            <q-td key="kit" :props="props">{{ props.row.kit.name }}</q-td>
            <q-td key="reporter" :props="props">{{ props.row.reportedBy.fullName }}</q-td>
            <q-td key="itemCount" :props="props">
              <q-badge color="negative" :label="props.row.items.length" />
            </q-td>
          </q-tr>

          <q-tr v-show="props.expand" :props="props" :class="$q.dark.isActive ? 'bg-red-10' : 'bg-red-1'">
            <q-td colspan="100%" style="padding: 0;">
              <div class="q-pa-sm" style="max-height: 260px; overflow-y: auto;">
                <div v-if="props.row.description" class="q-mb-sm text-caption text-grey-8">
                  <strong>Description:</strong> {{ props.row.description }}
                </div>
                <q-markup-table dense flat bordered separator="cell">
                  <thead>
                    <tr :class="$q.dark.isActive ? 'bg-grey-9' : 'bg-grey-2'">
                      <th class="text-left">Item</th>
                      <th>Qty Used</th>
                      <th class="text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="li in props.row.items" :key="li.id">
                      <td>{{ li.kitItem.name }}</td>
                      <td class="text-center text-negative text-weight-bold">{{ li.quantityUsed }}</td>
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
            <q-icon name="warning" size="48px" class="q-mb-sm" />
            No incident reports yet.
          </div>
        </template>
      </q-table>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useQuasar, date, type QTableColumn } from 'quasar';

const $q = useQuasar();
import { incidentsApi, kitsApi, type IncidentReport, type Kit } from 'src/services/api';
import { useNotify } from 'src/composables/useNotify';

const notify = useNotify();
const reports = ref<IncidentReport[]>([]);
const loading = ref(false);
const filterKitId = ref<string | undefined>(undefined);
const kitOptions = ref<{ label: string; value: string }[]>([]);

function formatDate(iso: string) {
  return date.formatDate(iso, 'DD MMM YYYY, HH:mm');
}

const columns: QTableColumn[] = [
  { name: 'expand',    label: '',          field: () => '',     align: 'center', style: 'width: 48px' },
  { name: 'createdAt', label: 'Date',      field: 'createdAt',  sortable: true, align: 'left' },
  { name: 'kit',       label: 'Kit',       field: 'kit',        align: 'left' },
  { name: 'reporter',  label: 'Reported By', field: 'reportedBy', align: 'left' },
  { name: 'itemCount', label: 'Items',     field: 'items',      align: 'center' },
];

async function loadReports() {
  loading.value = true;
  try {
    const { data } = await incidentsApi.list(filterKitId.value);
    reports.value = data;
  } catch (e) { notify.error(e, 'Failed to load incident reports'); }
  finally { loading.value = false; }
}

onMounted(async () => {
  try {
    const { data: kits } = await kitsApi.list();
    kitOptions.value = (kits as Kit[]).map((k) => ({ label: k.name, value: k.id }));
  } catch { /* non-critical */ }
  void loadReports();
});
</script>
