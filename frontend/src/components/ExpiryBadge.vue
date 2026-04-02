<template>
  <q-badge :color="state.color" :label="state.label">
    <q-tooltip v-if="expirationDate">
      Expires: {{ formatDate(expirationDate) }}
      <span v-if="state.days !== null">
        ({{ state.days < 0 ? `${Math.abs(state.days)}d ago` : `in ${state.days}d` }})
      </span>
    </q-tooltip>
  </q-badge>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { date } from 'quasar';

const props = defineProps<{
  /** ISO date string from the backend */
  expirationDate?: string | null;
  /** Pre-computed isValid from backend (avoids clock skew) */
  isValid: boolean;
}>();

const WARNING_DAYS = 30;
const CRITICAL_DAYS = 7;

function formatDate(iso: string) {
  return date.formatDate(iso, 'DD MMM YYYY');
}

const state = computed(() => {
  if (!props.isValid) {
    const days = props.expirationDate
      ? Math.ceil((new Date(props.expirationDate).getTime() - Date.now()) / 86_400_000)
      : null;
    return { color: 'negative', label: 'Expired', days };
  }

  if (!props.expirationDate) {
    return { color: 'grey-5', label: 'No expiry', days: null };
  }

  const days = Math.ceil(
    (new Date(props.expirationDate).getTime() - Date.now()) / 86_400_000,
  );

  if (days <= CRITICAL_DAYS) {
    return { color: 'deep-orange', label: `${days}d left`, days };
  }
  if (days <= WARNING_DAYS) {
    return { color: 'orange', label: `${days}d left`, days };
  }
  return { color: 'positive', label: 'Valid', days };
});
</script>
