<template>
  <!-- Χωρίς UI: τρέχει μέσα σε κρυφό iframe του Authentik. -->
  <div />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

/**
 * Front-channel Single Logout.
 *
 * Το Authentik (2025.10+) φορτώνει αυτή τη διαδρομή σε κρυφό iframe όταν ο
 * χρήστης αποσυνδέεται από οποιαδήποτε εφαρμογή του ίδιου SSO (`?iss=&sid=`).
 * Το session του OuchTracker ζει στο `localStorage`, που είναι κοινό σε όλες
 * τις καρτέλες ίδιας προέλευσης — άρα το καθαρίζουμε εδώ και σηκώνουμε σήμα· οι
 * ανοιχτές καρτέλες το ακούν (storage event) κι αποσυνδέονται (βλ.
 * `boot/sso-sync.ts`).
 */
onMounted(() => {
  try {
    ['access_token', 'user', 'refresh_token', 'refresh_user_id', 'ouchtracker:sso'].forEach((k) =>
      localStorage.removeItem(k),
    );
    localStorage.setItem('ouchtracker:slo', String(Date.now()));
  } catch {
    // Ιδιωτική περιήγηση: δεν μπορούμε να στείλουμε σήμα.
  }
});
</script>
