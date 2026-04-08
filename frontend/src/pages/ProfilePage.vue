<template>
  <q-page padding class="profile-page">

    <div class="text-h5 q-mb-lg row items-center">
      <q-icon name="manage_accounts" class="q-mr-sm" />
      {{ $t('profile.title') }}
    </div>

    <div class="row q-col-gutter-lg">

      <!-- ── Personal Info ─────────────────────────────────────────────────── -->
      <div class="col-12 col-md-6">
        <q-card flat bordered class="q-pa-md">
          <div class="text-subtitle1 text-weight-medium q-mb-md row items-center">
            <q-icon name="person" class="q-mr-sm" color="primary" />
            {{ $t('profile.personalInfo') }}
          </div>

          <q-form @submit.prevent="saveInfo" class="q-gutter-sm">
            <q-input
              v-model="infoForm.fullName"
              :label="$t('profile.fullName')"
              outlined dense
              :rules="[(v) => !!v || $t('profile.nameRequired')]"
            >
              <template #prepend><q-icon name="badge" /></template>
            </q-input>

            <q-input
              v-model="infoForm.email"
              :label="$t('profile.emailAddress')"
              type="email"
              outlined dense
              :rules="[(v) => !!v || $t('profile.emailRequired'), (v) => /.+@.+\..+/.test(v) || $t('auth.emailInvalid')]"
            >
              <template #prepend><q-icon name="email" /></template>
            </q-input>

            <div class="row justify-end q-mt-sm">
              <q-btn no-caps rounded
                unelevated color="primary"
                :label="$t('profile.saveInfo')"
                icon="save"
                type="submit"
                :loading="savingInfo"
              />
            </div>
          </q-form>
        </q-card>
      </div>

      <!-- ── Change Password ───────────────────────────────────────────────── -->
      <div class="col-12 col-md-6">
        <q-card flat bordered class="q-pa-md">
          <div class="text-subtitle1 text-weight-medium q-mb-md row items-center">
            <q-icon name="lock" class="q-mr-sm" color="primary" />
            {{ $t('profile.changePassword') }}
          </div>

          <q-form @submit.prevent="savePassword" class="q-gutter-sm">
            <q-input
              v-model="pwForm.currentPassword"
              :label="$t('profile.currentPassword')"
              :type="showCurrent ? 'text' : 'password'"
              outlined dense
              :rules="[(v) => !!v || $t('profile.currentPasswordRequired')]"
            >
              <template #prepend><q-icon name="lock_open" /></template>
              <template #append>
                <q-icon
                  :name="showCurrent ? 'visibility_off' : 'visibility'"
                  class="cursor-pointer"
                  @click="showCurrent = !showCurrent"
                />
              </template>
            </q-input>

            <q-input
              v-model="pwForm.newPassword"
              :label="$t('profile.newPassword')"
              :type="showNew ? 'text' : 'password'"
              outlined dense
              :rules="[(v) => !!v || $t('profile.newPasswordRequired'), (v) => v.length >= 6 || 'Min 6 characters']"
            >
              <template #prepend><q-icon name="lock" /></template>
              <template #append>
                <q-icon
                  :name="showNew ? 'visibility_off' : 'visibility'"
                  class="cursor-pointer"
                  @click="showNew = !showNew"
                />
              </template>
            </q-input>

            <q-input
              v-model="pwForm.confirmPassword"
              :label="$t('profile.confirmPassword')"
              :type="showConfirm ? 'text' : 'password'"
              outlined dense
              :rules="[
                (v) => !!v || $t('profile.newPasswordRequired'),
                (v) => v === pwForm.newPassword || $t('profile.passwordMismatch'),
              ]"
            >
              <template #prepend><q-icon name="lock" /></template>
              <template #append>
                <q-icon
                  :name="showConfirm ? 'visibility_off' : 'visibility'"
                  class="cursor-pointer"
                  @click="showConfirm = !showConfirm"
                />
              </template>
            </q-input>

            <div class="row justify-end q-mt-sm">
              <q-btn no-caps rounded
                unelevated color="primary"
                :label="$t('profile.changePasswordBtn')"
                icon="key"
                type="submit"
                :loading="savingPw"
              />
            </div>
          </q-form>
        </q-card>
      </div>

      <!-- ── Language ──────────────────────────────────────────────────────── -->
      <div class="col-12 col-md-6">
        <q-card flat bordered class="q-pa-md">
          <div class="text-subtitle1 text-weight-medium q-mb-md row items-center">
            <q-icon name="translate" class="q-mr-sm" color="primary" />
            {{ $t('profile.language') }}
          </div>

          <q-select
            v-model="selectedLocale"
            :options="localeOptions"
            :label="$t('profile.languageLabel')"
            outlined dense emit-value map-options
            @update:model-value="saveLocale"
          >
            <template #prepend><q-icon name="language" /></template>
            <template #option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section avatar>
                  <span style="font-size: 1.4em">{{ scope.opt.flag }}</span>
                </q-item-section>
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
            <template #selected-item="scope">
              <span class="q-mr-sm">{{ localeOptions.find(o => o.value === scope.opt)?.flag }}</span>
              {{ scope.opt }}
            </template>
          </q-select>
        </q-card>
      </div>

    </div>
  </q-page>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { usersApi } from 'src/services/api';
import { useAuthStore } from 'stores/auth.store';
import { useNotify } from 'src/composables/useNotify';
import { LOCALES, type Locale } from 'src/i18n';
import { i18n } from 'src/boot/i18n';

const { t } = useI18n();
const authStore = useAuthStore();
const notify = useNotify();

const localeOptions = LOCALES.map((l) => ({ label: `${l.flag} ${l.label}`, value: l.value, flag: l.flag }));

// ── Personal info form ─────────────────────────────────────────────────────
const infoForm = reactive({ fullName: '', email: '' });
const savingInfo = ref(false);

// ── Language ───────────────────────────────────────────────────────────────
const selectedLocale = ref<Locale>((localStorage.getItem('locale') as Locale) ?? 'en');

onMounted(() => {
  infoForm.fullName = authStore.user?.fullName ?? '';
  infoForm.email = authStore.user?.email ?? '';
  selectedLocale.value = ((authStore.user as (typeof authStore.user & { locale?: string }))?.locale as Locale) ?? (localStorage.getItem('locale') as Locale) ?? 'en';
});

async function saveInfo() {
  savingInfo.value = true;
  try {
    const { data } = await usersApi.updateProfile({
      fullName: infoForm.fullName,
      email: infoForm.email,
    });
    authStore.setUser(data);
    notify.success(t('profile.infoSaved'));
  } catch (e) {
    notify.error(e, 'Failed to update profile');
  } finally {
    savingInfo.value = false;
  }
}

async function saveLocale(locale: Locale) {
  try {
    const { data } = await usersApi.updateProfile({ locale });
    authStore.setUser(data);
    i18n.global.locale.value = locale;
    localStorage.setItem('locale', locale);
    notify.success(t('profile.languageSaved'));
  } catch (e) {
    notify.error(e, 'Failed to save language preference');
  }
}

// ── Password form ──────────────────────────────────────────────────────────
const pwForm = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' });
const savingPw = ref(false);
const showCurrent = ref(false);
const showNew = ref(false);
const showConfirm = ref(false);

async function savePassword() {
  savingPw.value = true;
  try {
    await usersApi.updateProfile({
      currentPassword: pwForm.currentPassword,
      newPassword: pwForm.newPassword,
    });
    pwForm.currentPassword = '';
    pwForm.newPassword = '';
    pwForm.confirmPassword = '';
    notify.success(t('profile.passwordChanged'));
  } catch (e) {
    notify.error(e, 'Failed to update password');
  } finally {
    savingPw.value = false;
  }
}
</script>

<style scoped lang="css">
.profile-page {
  max-width: 900px;
  margin: 0 auto;
}
</style>
