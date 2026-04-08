<template>
  <q-page padding>
    <div class="row items-center q-mb-md">
      <div class="text-h5"><q-icon name="people" class="q-mr-sm" />{{ $t('users.title') }}</div>
      <q-space />
      <q-btn no-caps rounded color="primary" icon="add" :label="$t('users.addUser')" unelevated @click="openCreate" />
    </div>

    <!-- Skeleton -->
    <q-card v-if="loading" flat bordered>
      <q-card-section>
        <q-skeleton type="text" width="25%" class="q-mb-md" />
        <q-item v-for="n in 8" :key="n" class="q-py-sm">
          <q-item-section><q-skeleton type="text" width="45%" /></q-item-section>
          <q-item-section><q-skeleton type="text" width="55%" /></q-item-section>
          <q-item-section><q-skeleton type="QBadge" /></q-item-section>
          <q-item-section side><q-skeleton type="QBtn" /></q-item-section>
        </q-item>
      </q-card-section>
    </q-card>

    <q-card v-else flat bordered>
      <q-table
        :rows="users" :columns="columns" row-key="id"
        flat :pagination="{ rowsPerPage: 15 }"
      >
        <template #body-cell-role="props">
          <q-td :props="props">
            <q-chip dense :color="props.value === 'ADMIN' ? 'orange' : 'teal'" text-color="white" :label="props.value" />
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
            <q-btn no-caps rounded flat dense round icon="edit" color="primary" size="sm" @click="openEdit(props.row)" />
            <q-btn no-caps rounded flat dense round icon="delete" color="negative" size="sm" @click="confirmDelete(props.row)" />
          </q-td>
        </template>
      </q-table>
    </q-card>

    <!-- ── Create / Edit dialog ─────────────────────────────────────────────── -->
    <q-dialog v-model="dialogOpen" persistent>
      <q-card style="min-width: 380px">
        <q-card-section class="row items-center">
          <div class="text-h6">{{ editTarget ? $t('users.editUser') : $t('users.createUser') }}</div>
          <q-space /><q-btn no-caps rounded icon="close" flat round dense v-close-popup />
        </q-card-section>
        <q-separator />
        <q-card-section>
          <q-form ref="formRef" class="q-gutter-sm">
            <q-input v-model="form.fullName" :label="$t('users.fullName')" outlined dense
              :rules="[(v) => !!v || 'Required']" />
            <q-input v-model="form.email" :label="$t('common.email')" type="email" outlined dense
              :rules="[(v) => !!v || 'Required', (v) => /.+@.+/.test(v) || 'Invalid email']"
              :disable="!!editTarget" />
            <q-input v-model="form.password"
              :label="editTarget ? $t('users.leaveBlankPassword') : $t('users.newPassword')"
              type="password" outlined dense
              :rules="editTarget ? [] : [(v) => (v?.length ?? 0) >= 6 || 'Min 6 chars']" />
            <q-select v-model="form.role" :options="roleOptions"
              :label="$t('common.role')" outlined dense emit-value map-options />
            <q-toggle v-if="editTarget" v-model="form.isActive" :label="$t('common.active')" />
          </q-form>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn no-caps rounded flat :label="$t('common.cancel')" v-close-popup />
          <q-btn no-caps rounded unelevated color="primary" :label="editTarget ? $t('common.save') : $t('users.createUser')"
            :loading="saving" @click="saveUser" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { useQuasar, type QTableColumn } from 'quasar';
import { useI18n } from 'vue-i18n';
import { usersApi, type User } from 'src/services/api';
import { useNotify } from 'src/composables/useNotify';

const { t } = useI18n();
const $q = useQuasar();
const notify = useNotify();
const users = ref<User[]>([]);
const loading = ref(false);
const saving = ref(false);
const dialogOpen = ref(false);
const editTarget = ref<User | null>(null);
const formRef = ref();

const form = reactive({ fullName: '', email: '', password: '', role: 'CHECKER' as 'ADMIN' | 'CHECKER', isActive: true });
const roleOptions = [{ label: t('users.roleChecker'), value: 'CHECKER' }, { label: t('users.roleAdmin'), value: 'ADMIN' }];

const columns: QTableColumn[] = [
  { name: 'fullName', label: t('common.name'),   field: 'fullName', sortable: true, align: 'left' },
  { name: 'email',    label: t('common.email'),  field: 'email',    sortable: true, align: 'left' },
  { name: 'role',     label: t('common.role'),   field: 'role',     align: 'center' },
  { name: 'isActive', label: t('common.active'), field: 'isActive', align: 'center' },
  { name: 'actions',  label: '',                 field: 'id',       align: 'center' },
];

async function loadUsers() {
  loading.value = true;
  try { const { data } = await usersApi.list(); users.value = data; }
  catch (e) { notify.error(e, 'Failed to load users'); }
  finally { loading.value = false; }
}

function openCreate() {
  editTarget.value = null;
  Object.assign(form, { fullName: '', email: '', password: '', role: 'CHECKER', isActive: true });
  dialogOpen.value = true;
}

function openEdit(u: User) {
  editTarget.value = u;
  Object.assign(form, { fullName: u.fullName, email: u.email, password: '', role: u.role, isActive: u.isActive });
  dialogOpen.value = true;
}

async function saveUser() {
  const valid = await formRef.value?.validate();
  if (!valid) return;
  saving.value = true;
  try {
    if (editTarget.value) {
      const p: Record<string, unknown> = { fullName: form.fullName, role: form.role, isActive: form.isActive };
      if (form.password) p.password = form.password;
      await usersApi.update(editTarget.value.id, p as Parameters<typeof usersApi.update>[1]);
      notify.success(t('users.userUpdated'));
    } else {
      await usersApi.create({ fullName: form.fullName, email: form.email, password: form.password, role: form.role });
      notify.success(t('users.userCreated'));
    }
    dialogOpen.value = false;
    void loadUsers();
  } catch (e) { notify.error(e); }
  finally { saving.value = false; }
}

function confirmDelete(u: User) {
  $q.dialog({
    title: t('users.deleteUser'), html: true, cancel: true,
    message: `${t('users.confirmDelete')} <strong>${u.fullName}</strong>?`,
    ok: { label: t('common.delete'), color: 'negative', unelevated: true },
  }).onOk(async () => {
    try { await usersApi.remove(u.id); notify.success(t('users.userDeleted')); void loadUsers(); }
    catch (e) { notify.error(e); }
  });
}

onMounted(loadUsers);
</script>
