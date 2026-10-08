<template>
  <div class="column items-center justify-center window-height q-pa-md text-center">
    <q-spinner-dots v-if="!errorMsg" color="primary" size="48px" />
    <div v-if="!errorMsg" class="text-subtitle1 q-mt-md text-grey-7">
      {{ $t('auth.signingIn') }}
    </div>

    <template v-else>
      <q-icon name="error_outline" color="negative" size="48px" />
      <div class="text-subtitle1 q-mt-md">{{ errorMsg }}</div>
      <q-btn
        no-caps rounded unelevated color="primary" class="q-mt-md"
        :label="$t('auth.backToLogin')"
        @click="goLogin"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { completeLogin } from 'src/lib/oidc';
import { useAuthStore } from 'stores/auth.store';

const { t } = useI18n();
const router = useRouter();
const auth = useAuthStore();
const errorMsg = ref('');

function goLogin() {
  void router.replace({ name: 'login' });
}

onMounted(async () => {
  try {
    const { user, returnTo } = await completeLogin();
    const ok = await auth.loginWithOidc(user.access_token);
    if (!ok) {
      errorMsg.value = auth.error ?? t('auth.loginFailed');
      return;
    }
    const safe = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/dashboard';
    void router.replace(safe);
  } catch {
    errorMsg.value = t('auth.loginFailed');
  }
});
</script>
