<template>
  <div />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { completeSilentRenew } from 'src/lib/oidc';

// Τρέχει μέσα σε κρυφό iframe· το oidc-client-ts στέλνει το αποτέλεσμα στον
// γονέα. Καμία ανακατεύθυνση εδώ.
onMounted(() => {
  void completeSilentRenew().catch(() => {
    /* ο γονέας χειρίζεται την αποτυχία */
  });
});
</script>
