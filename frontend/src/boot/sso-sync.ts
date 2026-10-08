import { defineBoot } from '#q-app/wrappers';
import { oidcEnabled, trySilentAccessToken } from 'src/lib/oidc';
import { useAuthStore } from 'stores/auth.store';

/** Διαβάζει το email από ένα JWT χωρίς επικύρωση — μόνο για σύγκριση ταυτότητας. */
function emailFromJwt(token: string): string | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = JSON.parse(
      decodeURIComponent(
        atob(part.replace(/-/g, '+').replace(/_/g, '/'))
          .split('')
          .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
          .join(''),
      ),
    ) as { email?: unknown };
    return typeof json.email === 'string' ? json.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * Κρατά τη συνεδρία του OuchTracker σε συμφωνία με το Authentik.
 *
 * Χωρίς αυτό, ένα αποθηκευμένο JWT (localStorage) θα κρατούσε τον χρήστη
 * συνδεδεμένο ως ο ΠΡΟΗΓΟΥΜΕΝΟΣ (π.χ. Τοπικός διαχειριστής), ακόμη κι αν στο
 * Authentik έχει πλέον συνδεθεί άλλος (π.χ. διαχειριστής Οδηγών) — και θα έβλεπε
 * kit που δεν του ανήκουν. Στην εκκίνηση κάνουμε σιωπηλό SSO· αν η ταυτότητα του
 * Authentik διαφέρει από την τρέχουσα συνεδρία (ή δεν υπάρχει συνεδρία),
 * ξανα-ανταλλάσσουμε. Αν δεν υπάρχει συνεδρία Authentik, κρατάμε ό,τι υπάρχει
 * (break-glass / offline).
 */
export default defineBoot(async ({ store, router }) => {
  if (!oidcEnabled) return;

  const auth = useAuthStore(store);

  // Front-channel Single Logout: όταν ο χρήστης αποσυνδεθεί από άλλη εφαρμογή/
  // καρτέλα του ίδιου SSO, το κρυφό iframe του Authentik καθαρίζει το (κοινό)
  // localStorage και σηκώνει το σήμα `ouchtracker:slo`. Το `storage` event σκάει
  // μόνο στις ΑΛΛΕΣ καρτέλες ίδιας προέλευσης — άρα εδώ, στην κύρια: κλείνουμε
  // τη συνεδρία κι εμείς και πάμε σε καθαρή οθόνη σύνδεσης.
  window.addEventListener('storage', (event) => {
    if (event.key === 'ouchtracker:slo' && event.newValue) {
      void auth.logout().finally(() => {
        void router.push({ name: 'login' });
      });
    }
  });

  // Οι σελίδες callback/silent/frontchannel-logout χειρίζονται μόνες τους τη ροή.
  if (window.location.pathname.startsWith('/auth/')) return;

  // Ρόλος αυτού του boot είναι να **διορθώνει** μια υπάρχουσα συνεδρία (π.χ. είχε
  // μείνει κολλημένος άλλος χρήστης στο localStorage). Το ΑΡΧΙΚΟ login (όταν δεν
  // υπάρχει καθόλου session) το κάνει η LoginPage με το δικό της auto-silent —
  // αν τρέχαμε κι εδώ, θα γίνονταν δύο ταυτόχρονες silent ροές (race).
  if (!auth.isAuthenticated) return;

  // Μη μπλοκάρεις την εκκίνηση πάνω από λίγα δευτερόλεπτα (π.χ. αργό iframe).
  const token = await Promise.race<string | null>([
    trySilentAccessToken().catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
  ]);
  // Δεν υπάρχει (πια) συνεδρία Authentik: κρατάμε ό,τι υπάρχει τοπικά (break-glass
  // / offline). Το synced logout το αναλαμβάνει πλέον το native front-channel SLO
  // του Authentik, όχι αυτό το boot.
  if (!token) return;

  const ssoEmail = emailFromJwt(token);
  const currentEmail = auth.user?.email?.toLowerCase() ?? null;
  if (ssoEmail !== null && ssoEmail !== currentEmail) {
    await auth.loginWithOidc(token);
  }
});
