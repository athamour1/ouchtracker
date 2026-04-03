<template>
  <q-page padding>

    <!-- ── Header ────────────────────────────────────────────────────────────── -->
    <div class="row items-center q-mb-md">
      <q-btn flat round dense icon="arrow_back" :to="authStore.isAdmin ? '/admin/kits' : '/my-kits'" class="q-mr-sm" />
      <div>
        <div class="text-h5" v-if="kit">{{ kit.name }}</div>
        <q-skeleton v-else type="text" width="200px" />
        <div class="text-caption text-grey-6" v-if="kit">
          <q-icon name="location_on" size="14px" />
          {{ kit.location || 'No location set' }}
          &nbsp;·&nbsp;
          <q-icon name="person" size="14px" />
          <span v-if="kit.assignees.length">{{ kit.assignees.map(a => a.fullName).join(', ') }}</span>
          <span v-else>Unassigned</span>
        </div>
      </div>
      <q-space />
      <q-btn
        v-if="authStore.isChecker"
        color="teal" icon="fact_check" label="Start Inspection" unelevated class="q-mr-sm"
        :to="{ name: 'kit-inspect', params: { id: kitId } }"
      />
      <q-btn color="secondary" icon="upload_file" label="Import CSV" unelevated class="q-mr-sm" @click="openImport" />
      <q-btn color="primary" icon="add" label="Add Item" unelevated @click="openAddItem" />
    </div>

    <!-- ── Expiry alert banner ───────────────────────────────────────────────── -->
    <q-banner
      v-if="!loading && alertCount > 0"
      rounded
      :class="expiredCount > 0
        ? ($q.dark.isActive ? 'bg-red-9 text-red-2' : 'bg-red-1 text-red-9')
        : ($q.dark.isActive ? 'bg-orange-9 text-orange-2' : 'bg-orange-1 text-orange-9')"
      class="q-mb-md"
    >
      <template #avatar>
        <q-icon :name="expiredCount > 0 ? 'dangerous' : 'warning'" />
      </template>
      <span v-if="expiredCount > 0">
        <strong>{{ expiredCount }}</strong> item{{ expiredCount > 1 ? 's' : '' }} expired
        <span v-if="expiringSoonCount > 0"> and <strong>{{ expiringSoonCount }}</strong> expiring soon</span>.
      </span>
      <span v-else>
        <strong>{{ expiringSoonCount }}</strong> item{{ expiringSoonCount > 1 ? 's' : '' }} expiring within 30 days.
      </span>
    </q-banner>

    <!-- ── Kit items table ───────────────────────────────────────────────────── -->
    <q-card flat bordered>
      <q-table
        :rows="filteredItems"
        :columns="columns"
        row-key="id"
        :loading="loading"
        flat
        :pagination="{ rowsPerPage: 20 }"
      >
        <template #top>
          <q-input
            v-model="search"
            dense outlined clearable
            placeholder="Search by name, category, unit, quantity, expiry, location, notes…"
            style="width: 100%"
            debounce="150"
          >
            <template #prepend><q-icon name="search" /></template>
          </q-input>
        </template>
        <template #body="props">
          <q-tr
            :props="props"
            :class="{
              'row-expired':       !props.row.isValid,
              'row-expiring-soon': props.row.isValid && isExpiringSoon(props.row.expirationDate),
            }"
          >
            <q-td v-for="col in props.cols" :key="col.name" :props="props">
              <!-- Item name + category -->
              <template v-if="col.name === 'name'">
                <div class="text-weight-medium">{{ props.row.name }}</div>
                <div class="text-caption text-grey-6">{{ props.row.category || '—' }}</div>
              </template>
              <!-- Expiry date -->
              <template v-else-if="col.name === 'expirationDate'">
                <span v-if="col.value">{{ formatDate(col.value as string) }}</span>
                <span v-else class="text-grey-5">—</span>
              </template>
              <!-- Smart expiry badge -->
              <template v-else-if="col.name === 'isValid'">
                <ExpiryBadge
                  :is-valid="props.row.isValid"
                  :expiration-date="props.row.expirationDate"
                />
              </template>
              <!-- Actions -->
              <template v-else-if="col.name === 'actions'">
                <div class="q-gutter-xs">
                  <q-btn flat dense round icon="edit" color="primary" size="sm"
                    @click="openEditItem(props.row)" />
                  <q-btn flat dense round icon="delete" color="negative" size="sm"
                    @click="confirmRemoveItem(props.row)" />
                </div>
              </template>
              <template v-else>{{ col.value }}</template>
            </q-td>
          </q-tr>
        </template>
      </q-table>
    </q-card>

    <!-- ── Add Item dialog ───────────────────────────────────────────────────── -->
    <q-dialog v-model="addDialogOpen" persistent>
      <q-card style="min-width: 420px">
        <q-card-section class="row items-center">
          <div class="text-h6">Add Item to Kit</div>
          <q-space /><q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-separator />
        <q-card-section>
          <q-form ref="addFormRef" class="column q-gutter-sm">
            <q-input v-model="addForm.name" label="Item Name *" outlined dense
              :rules="[(v) => !!v || 'Required']" />
            <q-input v-model="addForm.category" label="Category" outlined dense />
            <q-input v-model="addForm.unit" label="Unit" outlined dense />
            <q-input v-model.number="addForm.quantity" label="Quantity *" type="number"
              outlined dense :rules="[(v) => v >= 0 || 'Must be ≥ 0']" />
            <q-input v-model="addForm.expirationDate" label="Expiration Date"
              outlined dense type="date" stack-label />
            <q-input v-model="addForm.locationInKit" label="Location in Kit" outlined dense />
            <q-input v-model="addForm.notes" label="Notes" outlined dense
              type="textarea" autogrow :rows="2" />
          </q-form>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn unelevated color="primary" label="Add" :loading="saving" @click="saveAddItem" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- ── Edit Item dialog ──────────────────────────────────────────────────── -->
    <q-dialog v-model="editDialogOpen" persistent>
      <q-card style="min-width: 420px">
        <q-card-section class="row items-center">
          <div class="text-h6">Edit: {{ editItemTarget?.name }}</div>
          <q-space /><q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-separator />
        <q-card-section>
          <q-form ref="editFormRef" class="column q-gutter-sm">
            <q-input v-model="editForm.name" label="Item Name *" outlined dense
              :rules="[(v) => !!v || 'Required']" />
            <q-input v-model="editForm.category" label="Category" outlined dense />
            <q-input v-model="editForm.unit" label="Unit" outlined dense />
            <q-input v-model.number="editForm.quantity" label="Quantity" type="number"
              outlined dense :rules="[(v) => v >= 0 || 'Must be ≥ 0']" />
            <q-input v-model="editForm.expirationDate" label="Expiration Date"
              outlined dense type="date" stack-label clearable />
            <q-input v-model="editForm.locationInKit" label="Location in Kit" outlined dense />
            <q-input v-model="editForm.notes" label="Notes" outlined dense
              type="textarea" autogrow :rows="2" />
          </q-form>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn unelevated color="primary" label="Save" :loading="saving" @click="saveEditItem" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- ── Import CSV dialog ────────────────────────────────────────────────── -->
    <q-dialog v-model="importDialogOpen" persistent style="max-width: 800px">
      <q-card style="min-width: min(760px, 95vw)">
        <q-card-section class="row items-center">
          <div class="text-h6">Import Items from CSV / TSV</div>
          <q-space /><q-btn icon="close" flat round dense v-close-popup @click="resetImport" />
        </q-card-section>
        <q-separator />

        <!-- Step 1: paste / upload -->
        <q-card-section v-if="importStep === 1">
          <div class="text-caption text-grey-7 q-mb-sm">
            Paste tab-separated or comma-separated data. Expected columns (in order):<br>
            <strong>Name, Quantity, Location, Category, Expiration Date (M/D/YYYY or YYYY-MM-DD)</strong>
          </div>
          <q-input
            v-model="importRaw"
            type="textarea"
            outlined dense
            label="Paste CSV / TSV rows here"
            :rows="10"
            placeholder="Surgical Mask	50	Cabinet A	PPE	12/31/2026"
          />
          <div class="row items-center q-mt-sm q-gutter-sm">
            <span class="text-caption text-grey-6">or upload a file:</span>
            <input ref="fileInputRef" type="file" accept=".csv,.tsv,.txt" style="display:none"
              @change="onFileSelected" />
            <q-btn flat dense size="sm" icon="attach_file" label="Choose file"
              @click="(fileInputRef as HTMLInputElement)?.click()" />
          </div>
        </q-card-section>

        <!-- Step 2: preview parsed rows -->
        <q-card-section v-if="importStep === 2">
          <div class="text-caption text-grey-7 q-mb-sm">
            {{ importRows.length }} row(s) parsed. Review before importing.
          </div>
          <q-markup-table dense flat bordered separator="cell" style="max-height:360px;overflow:auto">
            <thead>
              <tr :class="$q.dark.isActive ? 'bg-grey-9' : 'bg-grey-2'">
                <th class="text-left">#</th>
                <th class="text-left">Name</th>
                <th>Qty</th>
                <th class="text-left">Location</th>
                <th class="text-left">Category</th>
                <th class="text-left">Expiry</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in importRows" :key="i"
                  :class="row._error ? 'bg-red-1' : ''">
                <td>{{ i + 1 }}</td>
                <td>{{ row.name }}</td>
                <td class="text-center">{{ row.quantity }}</td>
                <td>{{ row.locationInKit || '—' }}</td>
                <td>{{ row.category || '—' }}</td>
                <td>{{ row.expirationDate || '—' }}</td>
                <td>
                  <q-icon v-if="row._error" name="error" color="negative" size="16px">
                    <q-tooltip>{{ row._error }}</q-tooltip>
                  </q-icon>
                </td>
              </tr>
            </tbody>
          </q-markup-table>
          <div v-if="importErrors > 0" class="text-caption text-negative q-mt-xs">
            {{ importErrors }} row(s) have errors and will be skipped.
          </div>
        </q-card-section>

        <!-- Step 3: progress -->
        <q-card-section v-if="importStep === 3">
          <div class="text-subtitle2 q-mb-sm">Importing {{ importProgress }} / {{ importTotal }}…</div>
          <q-linear-progress :value="importTotal ? importProgress / importTotal : 0" color="primary" rounded />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" @click="resetImport" v-close-popup />
          <q-btn v-if="importStep === 1" unelevated color="primary" label="Parse"
            :disable="!importRaw.trim()" @click="parseImport" />
          <q-btn v-if="importStep === 2" flat label="Back" @click="importStep = 1" />
          <q-btn v-if="importStep === 2" unelevated color="primary" label="Import"
            :disable="importRows.filter(r => !r._error).length === 0"
            @click="runImport" />
        </q-card-actions>
      </q-card>
    </q-dialog>

  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useQuasar, date, type QTableColumn } from 'quasar';
import { kitsApi, type Kit, type KitItem } from 'src/services/api';
import { useNotify } from 'src/composables/useNotify';
import { useAuthStore } from 'stores/auth.store';
import ExpiryBadge from 'components/ExpiryBadge.vue';

const authStore = useAuthStore();

const route = useRoute();
const $q = useQuasar();
const notify = useNotify();
const kitId = route.params.id as string;

const kit = ref<Kit | null>(null);
const loading = ref(false);
const saving = ref(false);

// Add dialog
const addDialogOpen = ref(false);
const addFormRef = ref();
const addForm = reactive({ name: '', category: '', unit: 'pcs', quantity: 1, locationInKit: '', expirationDate: '', notes: '' });

// Edit dialog
const editDialogOpen = ref(false);
const editFormRef = ref();
const editItemTarget = ref<KitItem | null>(null);
const editForm = reactive({ name: '', category: '', unit: '', quantity: 0, locationInKit: '', expirationDate: '', notes: '' });

function formatDate(iso: string) {
  return date.formatDate(iso, 'DD MMM YYYY');
}

const columns: QTableColumn[] = [
  { name: 'name',           label: 'Item',     field: 'name',           align: 'left',   sortable: true },
  { name: 'category',       label: 'Category', field: 'category',       align: 'left',   sortable: true },
  { name: 'unit',           label: 'Unit',     field: 'unit',           align: 'left',   sortable: true },
  { name: 'quantity',       label: 'Qty',      field: 'quantity',       align: 'center', sortable: true },
  { name: 'locationInKit',  label: 'Location', field: 'locationInKit',  align: 'left',   sortable: true },
  { name: 'expirationDate', label: 'Expires',  field: 'expirationDate', align: 'left',   sortable: true },
  { name: 'isValid',        label: 'Status',   field: 'isValid',        align: 'center', sortable: true },
  { name: 'notes',          label: 'Notes',    field: 'notes',          align: 'left',   sortable: true },
  { name: 'actions',        label: '',         field: 'id',             align: 'center' },
];

// ── Expiry helpers ────────────────────────────────────────────────────────────
const EXPIRING_SOON_DAYS = 30;

function isExpiringSoon(expirationDate: string | null | undefined): boolean {
  if (!expirationDate) return false;
  const days = Math.ceil((new Date(expirationDate).getTime() - Date.now()) / 86_400_000);
  return days >= 0 && days <= EXPIRING_SOON_DAYS;
}

const search = ref('');

const sortedItems = computed<KitItem[]>(() => {
  if (!kit.value) return [];
  return [...kit.value.kitItems].sort((a, b) => {
    const aExpired = !a.isValid ? 0 : 1;
    const bExpired = !b.isValid ? 0 : 1;
    if (aExpired !== bExpired) return aExpired - bExpired;
    const aSoon = a.isValid && isExpiringSoon(a.expirationDate) ? 0 : 1;
    const bSoon = b.isValid && isExpiringSoon(b.expirationDate) ? 0 : 1;
    return aSoon - bSoon;
  });
});

const filteredItems = computed<KitItem[]>(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return sortedItems.value;
  return sortedItems.value.filter((item) => {
    const expiry = item.expirationDate ? formatDate(item.expirationDate).toLowerCase() : '';
    return (
      item.name.toLowerCase().includes(q) ||
      (item.category ?? '').toLowerCase().includes(q) ||
      (item.unit ?? '').toLowerCase().includes(q) ||
      String(item.quantity).includes(q) ||
      expiry.includes(q) ||
      (item.locationInKit ?? '').toLowerCase().includes(q) ||
      (item.notes ?? '').toLowerCase().includes(q)
    );
  });
});

const expiredCount = computed(() => kit.value?.kitItems.filter((i) => !i.isValid).length ?? 0);
const expiringSoonCount = computed(
  () => kit.value?.kitItems.filter((i) => i.isValid && isExpiringSoon(i.expirationDate)).length ?? 0,
);
const alertCount = computed(() => expiredCount.value + expiringSoonCount.value);

async function loadKit() {
  loading.value = true;
  try {
    kit.value = (await kitsApi.get(kitId)).data;
  } catch (e) { notify.error(e, 'Failed to load kit'); }
  finally { loading.value = false; }
}

function openAddItem() {
  Object.assign(addForm, { name: '', category: '', unit: 'pcs', quantity: 1, locationInKit: '', expirationDate: '', notes: '' });
  addDialogOpen.value = true;
}

async function saveAddItem() {
  const valid = await addFormRef.value?.validate();
  if (!valid) return;
  saving.value = true;
  try {
    await kitsApi.addItem(kitId, {
      name: addForm.name,
      quantity: addForm.quantity,
      ...(addForm.category       && { category:       addForm.category }),
      ...(addForm.unit           && { unit:            addForm.unit }),
      ...(addForm.locationInKit  && { locationInKit:   addForm.locationInKit }),
      ...(addForm.expirationDate && { expirationDate:  addForm.expirationDate }),
      ...(addForm.notes          && { notes:           addForm.notes }),
    });
    notify.success('Item added to kit');
    addDialogOpen.value = false;
    void loadKit();
  } catch (e) { notify.error(e); }
  finally { saving.value = false; }
}

function openEditItem(item: KitItem) {
  editItemTarget.value = item;
  Object.assign(editForm, {
    name: item.name,
    category: item.category ?? '',
    unit: item.unit ?? '',
    quantity: item.quantity,
    locationInKit: item.locationInKit ?? '',
    expirationDate: item.expirationDate ? item.expirationDate.slice(0, 10) : '',
    notes: item.notes ?? '',
  });
  editDialogOpen.value = true;
}

async function saveEditItem() {
  const valid = await editFormRef.value?.validate();
  if (!valid) return;
  if (!editItemTarget.value) return;
  saving.value = true;
  try {
    await kitsApi.updateItem(kitId, editItemTarget.value.id, {
      name: editForm.name,
      quantity: editForm.quantity,
      ...(editForm.expirationDate ? { expirationDate: editForm.expirationDate } : { expirationDate: null }),
      ...(editForm.category      && { category:      editForm.category }),
      ...(editForm.unit          && { unit:          editForm.unit }),
      ...(editForm.locationInKit && { locationInKit: editForm.locationInKit }),
      ...(editForm.notes         && { notes:         editForm.notes }),
    });
    notify.success('Item updated');
    editDialogOpen.value = false;
    void loadKit();
  } catch (e) { notify.error(e); }
  finally { saving.value = false; }
}

function confirmRemoveItem(item: KitItem) {
  $q.dialog({
    title: 'Remove item', html: true, cancel: true,
    message: `Remove <strong>${item.name}</strong> from this kit?`,
    ok: { label: 'Remove', color: 'negative', unelevated: true },
  }).onOk(async () => {
    try { await kitsApi.removeItem(kitId, item.id); notify.success('Item removed'); void loadKit(); }
    catch (e) { notify.error(e); }
  });
}

onMounted(loadKit);

// ── CSV Import ────────────────────────────────────────────────────────────────

interface ImportRow {
  name: string;
  quantity: number;
  locationInKit?: string;
  category?: string;
  expirationDate?: string;
  _error?: string;
}

const importDialogOpen = ref(false);
const importStep = ref(1);
const importRaw = ref('');
const importRows = ref<ImportRow[]>([]);
const importProgress = ref(0);
const importTotal = ref(0);
const fileInputRef = ref<HTMLInputElement | null>(null);

const importErrors = computed(() => importRows.value.filter((r) => r._error).length);

function openImport() {
  resetImport();
  importDialogOpen.value = true;
}

function resetImport() {
  importStep.value = 1;
  importRaw.value = '';
  importRows.value = [];
  importProgress.value = 0;
  importTotal.value = 0;
}

function onFileSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => { importRaw.value = (e.target?.result as string) ?? ''; };
  reader.readAsText(file);
}

function parseDateField(raw: string): string | undefined {
  if (!raw || raw.trim() === '' || raw.trim() === '-') return undefined;
  // M/D/YYYY or MM/DD/YYYY → YYYY-MM-DD
  const slashMatch = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, m, d, y] = slashMatch;
    return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
  }
  // Already ISO-ish YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(raw.trim())) return raw.trim().slice(0, 10);
  return undefined;
}

function parseImport() {
  const lines = importRaw.value.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim());
  const rows: ImportRow[] = [];

  for (const line of lines) {
    // detect delimiter: tab preferred, fall back to comma
    const sep = line.includes('\t') ? '\t' : ',';
    const cells = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''));

    const [nameRaw, qtyRaw, locationRaw, categoryRaw, expiryRaw] = cells;
    const name = nameRaw?.trim() ?? '';
    const quantity = parseFloat(qtyRaw ?? '');
    const locationInKit = locationRaw?.trim() || undefined;
    const category = categoryRaw?.trim() || undefined;
    const expirationDate = parseDateField(expiryRaw ?? '');

    let _error: string | undefined;
    if (!name) _error = 'Name is required';
    else if (isNaN(quantity) || quantity < 0) _error = 'Invalid quantity';

    const row: ImportRow = { name, quantity: isNaN(quantity) ? 0 : quantity };
    if (locationInKit)  row.locationInKit  = locationInKit;
    if (category)       row.category       = category;
    if (expirationDate) row.expirationDate = expirationDate;
    if (_error)         row._error         = _error;
    rows.push(row);
  }

  importRows.value = rows;
  importStep.value = 2;
}

async function runImport() {
  const valid = importRows.value.filter((r) => !r._error);
  importTotal.value = valid.length;
  importProgress.value = 0;
  importStep.value = 3;

  let failed = 0;
  for (const row of valid) {
    try {
      await kitsApi.addItem(kitId, {
        name: row.name,
        quantity: row.quantity,
        ...(row.locationInKit  && { locationInKit:  row.locationInKit }),
        ...(row.category       && { category:       row.category }),
        ...(row.expirationDate && { expirationDate: row.expirationDate }),
      });
    } catch { failed++; }
    importProgress.value++;
  }

  importDialogOpen.value = false;
  resetImport();
  void loadKit();
  if (failed > 0) notify.error(null, `${failed} item(s) failed to import`);
  else notify.success(`${valid.length} item(s) imported successfully`);
}
</script>

<style scoped lang="css">
.row-expired td {
  background: #fff0f0 !important;
}
.row-expiring-soon td {
  background: #fff8e1 !important;
}
.body--dark .row-expired td {
  background: #2d0000 !important;
}
.body--dark .row-expiring-soon td {
  background: #2d1800 !important;
}
</style>
