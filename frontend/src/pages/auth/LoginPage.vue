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

      <!-- SSO error (from the ?sso_error= redirect) -->
      <q-card-section v-if="ssoError" class="q-pt-none">
        <q-banner dense class="ot-state-banner bg-negative text-white text-caption">
          <template #avatar>
            <q-icon name="error_outline" />
          </template>
          {{ ssoError }}
        </q-banner>
      </q-card-section>

      <!-- Login form -->
      <q-card-section v-if="authConfig.localLoginEnabled" class="q-pt-none">
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

      <!-- Single sign-on (e.g. authentik) — shown when OIDC_ENABLED=true on the backend -->
      <q-card-section v-if="authConfig.sso.enabled" class="q-pt-none sso-section">
        <div v-if="authConfig.localLoginEnabled" class="sso-divider text-caption text-grey-6">
          {{ $t('auth.orDivider') }}
        </div>
        <q-toggle
          v-else
          v-model="stayLoggedIn"
          :label="$t('auth.stayLoggedIn')"
          color="primary"
          dense
        />
        <q-btn no-caps rounded
          :label="$t('auth.signInWith', { provider: authConfig.sso.providerName })"
          icon="key"
          color="primary"
          class="full-width sso-btn"
          :outline="authConfig.localLoginEnabled"
          :unelevated="!authConfig.localLoginEnabled"
          size="md"
          :disable="!isOnline"
          @click="handleSsoLogin"
        />
      </q-card-section>

      <!-- Version footer -->
      <q-card-section class="text-center q-pt-none q-pb-sm">
        <div class="text-caption text-grey-5">v{{ appVersion }}</div>
      </q-card-section>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useQuasar } from 'quasar';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from 'stores/auth.store';
import { useOnline } from 'src/composables/useOnline';
import { useFormValidation } from 'src/composables/useFormValidation';
import { authApi, type AuthConfig } from 'src/services/api';

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

// Which sign-in methods the backend allows. Until it answers (or when offline),
// show the password form only.
const authConfig = ref<AuthConfig>({
  localLoginEnabled: true,
  sso: { enabled: false, providerName: 'SSO' },
});

onMounted(async () => {
  try {
    const { data } = await authApi.config();
    authConfig.value = data;
  } catch { /* keep defaults */ }
});

const SSO_ERROR_CODES = [
  'provider_error', 'invalid_state', 'missing_email',
  'not_registered', 'account_conflict', 'inactive', 'exchange_failed',
];

const ssoError = computed(() => {
  const code = route.query.sso_error as string | undefined;
  if (!code) return '';
  return t(`auth.ssoErrors.${SSO_ERROR_CODES.includes(code) ? code : 'provider_error'}`);
});

// Only allow internal paths (no protocol, no double-slash).
function redirectTarget(): string {
  const raw = route.query.redirect as string | undefined;
  return raw?.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';
}

function handleSsoLogin() {
  // Full-page navigation: the backend redirects to the SSO provider
  window.location.href = authApi.ssoLoginUrl(stayLoggedIn.value, redirectTarget());
}

async function handleLogin() {
  loginError.value = '';

  const success = await authStore.login(email.value, password.value, stayLoggedIn.value);
  if (!success) {
    loginError.value = authStore.error ?? t('auth.loginFailed');
    return;
  }

  // Redirect to the originally requested page, or dashboard.
  void router.push(redirectTarget());
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

.sso-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sso-divider {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sso-divider::before,
.sso-divider::after {
  content: '';
  flex: 1;
  border-top: 1px solid rgba(128, 128, 128, 0.3);
}

@media (max-width: 599px) {
  .login-card {
    max-width: 100%;
  }
}
</style>
