<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h5"><q-icon name="medical_services" class="q-mr-sm" />{{ $t('kits.title') }}</div>
      <q-space />
      <q-btn no-caps rounded color="primary" icon="add" :label="$t('kits.newKit')" unelevated @click="openCreate" />
    </div>

    <!-- Skeleton -->
    <q-card v-if="loading" flat bordered>
      <q-card-section>
        <q-skeleton type="text" width="30%" class="q-mb-md" />
        <q-skeleton type="QInput" class="q-mb-sm" />
        <q-item v-for="n in 8" :key="n" class="q-py-sm">
          <q-item-section><q-skeleton type="text" width="40%" /></q-item-section>
          <q-item-section><q-skeleton type="text" width="30%" /></q-item-section>
          <q-item-section><q-skeleton type="text" width="50%" /></q-item-section>
          <q-item-section side><q-skeleton type="QBtn" /></q-item-section>
        </q-item>
      </q-card-section>
    </q-card>

    <q-card v-else flat bordered>
      <q-table
        :rows="kits" :columns="columns" row-key="id"
        flat :pagination="{ rowsPerPage: 15 }"
        :filter="filter"
      >
        <template #top-right>
          <q-input v-model="filter" dense outlined :placeholder="$t('common.search')" debounce="300">
            <template #append><q-icon name="search" /></template>
          </q-input>
        </template>

        <template #body-cell-assignedTo="props">
          <q-td :props="props">
            <div v-if="props.row.assignees.length" class="row items-center q-gutter-xs">
              <q-chip
                v-for="a in props.row.assignees" :key="a.id"
                dense color="primary" text-color="white" icon="person" size="sm"
              >{{ a.fullName }}</q-chip>
            </div>
            <q-chip v-else dense color="grey-3" :label="$t('common.unassigned')" />
          </q-td>
        </template>

        <template #body-cell-isActive="props">
          <q-td :props="props">
            <q-icon :name="props.value ? 'check_circle' : 'cancel'"
              :color="props.value ? 'positive' : 'negative'" />
          </q-td>
        </template>

        <template #body-cell-actions="props">
          <q-td :props="props" class="q-gutter-xs">
            <q-btn no-caps rounded flat dense round icon="open_in_new" color="primary" size="sm"
              :to="`/admin/kits/${props.row.id}`">
              <q-tooltip>View Details</q-tooltip>
            </q-btn>
            <q-btn no-caps rounded flat dense round icon="qr_code" color="purple" size="sm"
              @click="openQr(props.row)">
              <q-tooltip>Show QR Code</q-tooltip>
            </q-btn>
            <q-btn no-caps rounded flat dense round icon="person_add" color="teal" size="sm"
              @click="openAssign(props.row)">
              <q-tooltip>Assign to User</q-tooltip>
            </q-btn>
            <q-btn no-caps rounded flat dense round icon="edit" color="grey-7" size="sm"
              @click="openEdit(props.row)" />
            <q-btn no-caps rounded flat dense round icon="delete" color="negative" size="sm"
              @click="confirmDelete(props.row)" />
          </q-td>
        </template>
      </q-table>
    </q-card>

    <!-- ── Create / Edit Kit dialog ─────────────────────────────────────────── -->
    <q-dialog v-model="kitDialogOpen" persistent>
      <q-card style="min-width: 400px">
        <q-card-section class="row items-center">
          <div class="text-h6">{{ editTarget ? $t('kits.editKit') : $t('kits.createKit') }}</div>
          <q-space /><q-btn no-caps rounded icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-separator />
        <q-card-section>
          <q-form ref="kitFormRef" class="q-gutter-sm">
            <q-input v-model="kitForm.name" :label="$t('kits.kitName')" outlined dense
              :rules="[(v) => !!v || 'Required']" />
            <q-input v-model="kitForm.description" :label="$t('kits.description')" outlined dense type="textarea" autogrow />
            <q-input v-model="kitForm.location" :label="$t('common.location')" outlined dense
              hint="e.g. Building A – Floor 2, Reception Desk" />
            <q-toggle v-if="editTarget" v-model="kitForm.isActive" :label="$t('common.active')" />
          </q-form>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn no-caps rounded flat :label="$t('common.cancel')" v-close-popup />
          <q-btn no-caps rounded unelevated color="primary" :label="editTarget ? $t('common.save') : $t('kits.createKit')"
            :loading="saving" @click="saveKit" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- ── QR Code dialog ───────────────────────────────────────────────────── -->
    <KitQrDialog v-model="qrDialogOpen" :kit-id="qrKit?.id ?? ''" :kit-name="qrKit?.name ?? ''" />

    <!-- ── Assign Kit dialog ─────────────────────────────────────────────────── -->
    <q-dialog v-model="assignDialogOpen" persistent>
      <q-card style="min-width: 380px">
        <q-card-section class="row items-center">
          <div class="text-h6">{{ $t('kits.assignCheckers') }}</div>
          <q-space /><q-btn no-caps rounded icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-separator />
        <q-card-section class="q-gutter-sm">
          <div class="text-body2 text-grey-7 q-mb-sm">
            {{ $t('kits.kitName') }}: <strong>{{ assignTarget?.name }}</strong>
          </div>
          <q-select
            v-model="assignUserIds"
            :options="userOptions"
            :label="$t('kits.assignedTo')"
            outlined dense
            emit-value map-options
            multiple use-chips
            hint="Select one or more users. Clear all to unassign."
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn no-caps rounded flat :label="$t('common.cancel')" v-close-popup />
          <q-btn no-caps rounded unelevated color="teal" :label="$t('kits.saveAssign')" :loading="saving" @click="saveAssign" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { kitsApi, usersApi, type Kit, type User } from 'src/services/api';
import { useNotify } from 'src/composables/useNotify';
import KitQrDialog from 'components/KitQrDialog.vue';

const { t } = useI18n();
const $q = useQuasar();
const notify = useNotify();
const kits = ref<Kit[]>([]);
const users = ref<User[]>([]);
const loading = ref(false);
const saving = ref(false);
const filter = ref('');

// Kit form state
const kitDialogOpen = ref(false);
const editTarget = ref<Kit | null>(null);
const kitFormRef = ref();
const kitForm = reactive({ name: '', description: '', location: '', isActive: true });

// QR state
const qrDialogOpen = ref(false);
const qrKit = ref<Kit | null>(null);

function openQr(kit: Kit) {
  qrKit.value = kit;
  qrDialogOpen.value = true;
}

// Assign state
const assignDialogOpen = ref(false);
const assignTarget = ref<Kit | null>(null);
const assignUserIds = ref<string[]>([]);

const userOptions = ref<{ label: string; value: string }[]>([]);

const columns: QTableColumn[] = [
  { name: 'name',       label: t('kits.kitName'),    field: 'name',       sortable: true, align: 'left' },
  { name: 'location',   label: t('common.location'), field: 'location',   align: 'left' },
  { name: 'assignedTo', label: t('kits.assignedTo'), field: 'assignedTo', align: 'left' },
  { name: 'isActive',   label: t('common.active'),   field: 'isActive',   align: 'center' },
  { name: 'actions',    label: '',                   field: 'id',         align: 'center' },
];

async function loadData() {
  loading.value = true;
  try {
    const [kitsRes, usersRes] = await Promise.all([kitsApi.list(), usersApi.list()]);
    kits.value = kitsRes.data;
    users.value = usersRes.data;
    userOptions.value = usersRes.data
      .filter((u) => u.isActive)
      .map((u) => ({ label: `${u.fullName} (${u.email})`, value: u.id }));
  } catch (e) { notify.error(e, 'Failed to load data'); }
  finally { loading.value = false; }
}

function openCreate() {
  editTarget.value = null;
  Object.assign(kitForm, { name: '', description: '', location: '', isActive: true });
  kitDialogOpen.value = true;
}

function openEdit(kit: Kit) {
  editTarget.value = kit;
  Object.assign(kitForm, { name: kit.name, description: kit.description ?? '', location: kit.location ?? '', isActive: kit.isActive });
  kitDialogOpen.value = true;
}

async function saveKit() {
  const valid = await kitFormRef.value?.validate();
  if (!valid) return;
  saving.value = true;
  try {
    if (editTarget.value) {
      await kitsApi.update(editTarget.value.id, { ...kitForm });
      notify.success(t('kits.kitUpdated'));
    } else {
      await kitsApi.create({ name: kitForm.name, description: kitForm.description, location: kitForm.location });
      notify.success(t('kits.kitCreated'));
    }
    kitDialogOpen.value = false;
    void loadData();
  } catch (e) { notify.error(e); }
  finally { saving.value = false; }
}

function openAssign(kit: Kit) {
  assignTarget.value = kit;
  assignUserIds.value = kit.assignees.map((a) => a.id);
  assignDialogOpen.value = true;
}

async function saveAssign() {
  if (!assignTarget.value) return;
  saving.value = true;
  try {
    await kitsApi.assign(assignTarget.value.id, assignUserIds.value);
    notify.success(t('kits.kitUpdated'));
    assignDialogOpen.value = false;
    void loadData();
  } catch (e) { notify.error(e); }
  finally { saving.value = false; }
}

function confirmDelete(kit: Kit) {
  $q.dialog({
    title: t('kits.deleteKit'), html: true, cancel: true,
    message: `${t('kits.confirmDelete')} <strong>${kit.name}</strong>?`,
    ok: { label: t('common.delete'), color: 'negative', unelevated: true },
  }).onOk(async () => {
    try { await kitsApi.remove(kit.id); notify.success(t('kits.kitDeleted')); void loadData(); }
    catch (e) { notify.error(e); }
  });
}

onMounted(loadData);
</script>
