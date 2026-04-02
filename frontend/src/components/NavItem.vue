<template>
  <q-item
    :to="to"
    exact
    active-class="nav-item--active"
    clickable
    v-ripple
    class="nav-item rounded-borders q-mx-sm q-mb-xs"
  >
    <q-item-section avatar>
      <q-icon :name="icon" />
    </q-item-section>
    <q-item-section>
      <q-item-label>{{ label }}</q-item-label>
    </q-item-section>
  </q-item>
</template>

<script setup lang="ts">
defineProps<{
  icon: string;
  label: string;
  to: string;
}>();
</script>

<style scoped lang="css">
.nav-item {
  transition: background 0.15s;
  border-radius: 8px;
}
.nav-item--active {
  background: rgba(210, 25, 25, 0.12);
  color: #d21919;
  font-weight: 600;
}
.body--dark .nav-item--active {
  background: rgba(210, 25, 25, 0.18);
  color: #d21919;
}
</style>
