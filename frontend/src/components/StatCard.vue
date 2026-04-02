<template>
  <q-card flat bordered :class="['stat-card', `stat-card--${resolvedColor}`]">
    <q-card-section class="row items-center q-py-md">
      <q-avatar
        :color="resolvedColor"
        text-color="white"
        size="52px"
        class="q-mr-md stat-avatar"
      >
        <q-icon :name="icon" size="26px" />
      </q-avatar>
      <div>
        <div class="text-caption text-grey-6 text-uppercase letter-spacing">{{ label }}</div>
        <div v-if="!loading" class="text-h4 text-weight-bold">
          {{ value }}
        </div>
        <q-skeleton v-else type="text" width="60px" />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  icon: string;
  iconColor: string;
  label: string;
  value: number;
  loading?: boolean;
  alert?: boolean;
}>();

// Keep warning as warning (amber), only escalate to negative if alert + was already negative
const resolvedColor = computed(() => props.iconColor);
</script>

<style scoped lang="css">
.stat-card {
  border-radius: 14px;
  transition: box-shadow 0.2s, transform 0.15s;
  overflow: hidden;
}
.stat-card:hover {
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}
.letter-spacing {
  letter-spacing: 0.05em;
}

/* Colored left accent bar + subtle bg tint per color */
.stat-card--primary  { border-left: 4px solid var(--q-primary);  background: color-mix(in srgb, var(--q-primary)  8%, transparent); }
.stat-card--teal     { border-left: 4px solid #009688;           background: color-mix(in srgb, #009688          8%, transparent); }
.stat-card--warning  { border-left: 4px solid var(--q-warning);  background: color-mix(in srgb, var(--q-warning)  8%, transparent); }
.stat-card--negative { border-left: 4px solid var(--q-negative); background: color-mix(in srgb, var(--q-negative) 8%, transparent); }

.body--dark .stat-card--primary  { background: color-mix(in srgb, var(--q-primary)  15%, transparent); }
.body--dark .stat-card--teal     { background: color-mix(in srgb, #009688          15%, transparent); }
.body--dark .stat-card--warning  { background: color-mix(in srgb, var(--q-warning)  15%, transparent); }
.body--dark .stat-card--negative { background: color-mix(in srgb, var(--q-negative) 15%, transparent); }
</style>
