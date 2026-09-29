<template>
  <div class="sso-callback-page column items-center justify-center q-pa-md">
    <q-spinner color="white" size="48px" />
    <div class="text-white q-mt-md">{{ $t('auth.ssoSigningIn') }}</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from 'stores/auth.store';

const router = useRouter();
const authStore = useAuthStore();

/**
 * Landing page after an SSO login. The backend redirects here with
 * #ticket=…&redirect=… (a fragment, so the ticket never hits server logs)
 * and we swap the one-time ticket for a normal session.
 */
onMounted(async () => {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const ticket = params.get('ticket');
  const raw = params.get('redirect');
  const redirect = raw?.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard';

  // Drop the ticket from the address bar / history
  window.history.replaceState(null, '', window.location.pathname);

  if (ticket && (await authStore.loginWithSsoTicket(ticket))) {
    await router.replace(redirect);
  } else {
    await router.replace({ name: 'login', query: { sso_error: 'exchange_failed' } });
  }
});
</script>

<style scoped lang="css">
.sso-callback-page {
  min-height: 100vh;
  background: linear-gradient(140deg, #c0645e 0%, #8c3e3e 55%, #632424 100%);
}
</style>
