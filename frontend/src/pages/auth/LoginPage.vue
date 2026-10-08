<template>
  <div class="login-page row items-center justify-center q-pa-md">
    <!-- Dark mode toggle — top right corner -->
    <q-btn
      flat round dense
      :icon="$q.dark.isActive ? 'light_mode' : 'dark_mode'"
      :aria-label="$q.dark.isActive ? $t('theme.lightMode') : $t('theme.darkMode')"
      class="dark-toggle text-white"
      @click="toggleDark"
    >
      <q-tooltip>{{ $q.dark.isActive ? $t('theme.lightMode') : $t('theme.darkMode') }}</q-tooltip>
    </q-btn>

    <q-card class="login-card q-pa-lg">
      <!-- Logo / branding -->
      <q-card-section class="text-center q-pb-sm">
        <q-icon name="medical_services" size="56px" color="primary" />
        <h1 class="text-h5 text-weight-bold q-mt-sm q-mb-none">{{ $t('app.name') }}</h1>
        <div class="text-caption text-grey-6">{{ $t('app.subtitle') }}</div>
      </q-card-section>

      <!-- Login form -->
      <q-card-section class="q-pt-none">
        <!-- Single sign-on (Σ.Ε.Ο.) — η κύρια είσοδος όταν είναι ρυθμισμένο -->
        <div v-if="oidcEnabled" class="ot-form-stack q-mb-md">
          <q-btn
            no-caps rounded unelevated size="md"
            color="primary"
            class="full-width"
            icon="badge"
            :label="$t('auth.ssoSignIn')"
            :loading="ssoBusy"
            :disable="!isOnline"
            @click="startSso"
          />
          <div class="row items-center text-grey-6 q-mt-xs">
            <q-separator class="col" />
            <span class="q-mx-sm text-caption">{{ $t('auth.or') }}</span>
            <q-separator class="col" />
          </div>
        </div>

        <q-form @submit="handleLogin" class="login-form ot-form-stack">
          <q-input
            v-model="email"
            type="email"
            :label="$t('auth.emailAddress')"
            outlined
            dense
            autocomplete="email"
            :rules="emailRules"
          >
            <template #prepend>
              <q-icon name="email" />
            </template>
          </q-input>

          <q-input
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            :label="$t('auth.password')"
            outlined
            dense
            autocomplete="current-password"
            :rules="passwordRules"
          >
            <template #prepend>
              <q-icon name="lock" />
            </template>
            <template #append>
              <q-icon
                :name="showPassword ? 'visibility_off' : 'visibility'"
                class="cursor-pointer"
                @click="showPassword = !showPassword"
              />
            </template>
          </q-input>

          <!-- Stay logged in -->
          <q-toggle
            v-model="stayLoggedIn"
            :label="$t('auth.stayLoggedIn')"
            color="primary"
            dense
          />

          <!-- Offline notice -->
          <q-banner
            v-if="!isOnline"
            dense
            class="ot-state-banner bg-orange-2 text-orange-9 text-caption"
          >
            <template #avatar><q-icon name="cloud_off" /></template>
            {{ $t('offline.banner') }}
          </q-banner>

          <!-- Error banner -->
          <q-banner
            v-if="loginError"
            dense
            class="ot-state-banner bg-negative text-white text-caption"
          >
            <template #avatar>
              <q-icon name="error_outline" />
            </template>
            {{ loginError }}
          </q-banner>

          <q-btn no-caps rounded
            type="submit"
            :label="$t('auth.signIn')"
            color="primary"
            class="full-width"
            unelevated
            size="md"
            :disable="!isOnline"
            :loading="authStore.loading"
          />
        </q-form>
      </q-card-section>

      <!-- Version footer -->
      <q-card-section class="text-center q-pt-none q-pb-sm">
        <div class="text-caption text-grey-5">v{{ appVersion }}</div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from 'stores/auth.store';
import { useOnline } from 'src/composables/useOnline';
import { useFormValidation } from 'src/composables/useFormValidation';
import { oidcEnabled, login as ssoLogin } from 'src/lib/oidc';

const { t } = useI18n();
const $q = useQuasar();
const { isOnline } = useOnline();
const appVersion = process.env.APP_VERSION;
const validation = useFormValidation(t);

const emailRules = validation.email('auth.emailRequired', 'auth.emailInvalid');
const passwordRules = [validation.required('auth.passwordRequired')];

function toggleDark() {
  $q.dark.toggle();
  localStorage.setItem('darkMode', String($q.dark.isActive));
}

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const stayLoggedIn = ref(false);
const loginError = ref('');
const ssoBusy = ref(false);

/** Ξεκινά τη ροή SSO, θυμούμενη πού ήθελε να πάει ο χρήστης. */
async function startSso() {
  loginError.value = '';
  ssoBusy.value = true;
  try {
    const raw = route.query.redirect as string | undefined;
    const redirect = raw?.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';
    await ssoLogin(redirect);
  } catch {
    ssoBusy.value = false;
    loginError.value = t('auth.loginFailed');
  }
}


async function handleLogin() {
  loginError.value = '';

  const success = await authStore.login(email.value, password.value, stayLoggedIn.value);
  if (!success) {
    loginError.value = authStore.error ?? t('auth.loginFailed');
    return;
  }

  // Redirect to the originally requested page, or dashboard.
  // Sanitise: only allow internal paths (no protocol, no double-slash).
  const raw = route.query.redirect as string | undefined;
  const redirect = raw?.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';
  void router.push(redirect);
}
</script>

<style scoped lang="css">
.login-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 14%, rgba(255, 255, 255, 0.22), transparent 34%),
    linear-gradient(140deg, #c0645e 0%, #8c3e3e 55%, #632424 100%);
  position: relative;
}

.dark-toggle {
  position: absolute;
  top: 16px;
  right: 16px;
}

.login-card {
  width: 100%;
  max-width: 420px;
  border-radius: var(--ot-radius-lg);
  box-shadow: var(--ot-shadow-soft);
  backdrop-filter: blur(2px);
}

.login-form {
  display: flex;
  flex-direction: column;
}

@media (max-width: 599px) {
  .login-card {
    max-width: 100%;
  }
}
</style>
