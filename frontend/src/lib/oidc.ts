import { Log, type User, UserManager, WebStorageStateStore } from 'oidc-client-ts';

/**
 * Σύνδεση με το Authentik (OpenID Connect) — το ίδιο single sign-on με το
 * Trifylli. Ένας χρήστης που έχει ήδη συνεδρία στο Authentik μπαίνει στο
 * OuchTracker χωρίς δεύτερη σύνδεση.
 *
 * Authorization Code + PKCE, χωρίς client secret (η PWA είναι δημόσιος client).
 * Το access token του Authentik δεν γίνεται το session του OuchTracker: το
 * ανταλλάσσουμε στο `POST /api/auth/oidc` με κανονικό OuchTracker JWT (βλ.
 * `auth.store.ts`). Έτσι όλη η υπόλοιπη εφαρμογή δεν αλλάζει.
 *
 * Η ρύθμιση έρχεται από το `window.__APP_CONFIG__` (runtime, από τον
 * entrypoint του container) — όχι build-time — γιατί το frontend διανέμεται ως
 * έτοιμο image.
 */

interface RuntimeConfig {
  apiUrl?: string;
  oidcAuthority?: string;
  oidcClientId?: string;
  oidcLogoutFlow?: string;
}

function runtimeConfig(): RuntimeConfig {
  return (window as unknown as { __APP_CONFIG__?: RuntimeConfig }).__APP_CONFIG__ ?? {};
}

export const OIDC_AUTHORITY = runtimeConfig().oidcAuthority ?? '';
export const OIDC_CLIENT_ID = runtimeConfig().oidcClientId ?? '';

/** `false` ⇒ μόνο τοπική σύνδεση με email/κωδικό (break-glass). */
export const oidcEnabled = Boolean(OIDC_AUTHORITY && OIDC_CLIENT_ID);

const REDIRECT_PATH = '/auth/callback';
const SILENT_PATH = '/auth/silent';

/** Πού βρισκόταν ο χρήστης πριν τον στείλουμε για login. */
const RETURN_TO_KEY = 'ouchtracker:returnTo';

function origin(): string {
  return window.location.origin;
}

let manager: UserManager | null = null;

export function userManager(): UserManager {
  if (!oidcEnabled) {
    throw new Error('Το OIDC δεν έχει ρυθμιστεί (oidcAuthority / oidcClientId στο config.js).');
  }
  if (manager) return manager;

  if (process.env.DEV) Log.setLevel(Log.INFO);
  Log.setLogger(console);

  manager = new UserManager({
    authority: OIDC_AUTHORITY,
    client_id: OIDC_CLIENT_ID,
    redirect_uri: `${origin()}${REDIRECT_PATH}`,
    silent_redirect_uri: `${origin()}${SILENT_PATH}`,
    response_type: 'code',
    // Το `email` είναι υποχρεωτικό: είναι το κλειδί που δένει την ταυτότητα του
    // Authentik με τον λογαριασμό του OuchTracker. Χωρίς `offline_access`
    // σκοπίμως (η ανανέωση γίνεται σιωπηλά με iframe, χωρίς consent stage).
    scope: 'openid profile email',
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
    automaticSilentRenew: false,
    monitorSession: false,
    loadUserInfo: false,
  });

  return manager;
}

/** Ξεκινά τη ροή σύνδεσης, θυμούμενη πού ήθελε να πάει ο χρήστης. */
export async function login(returnTo?: string): Promise<void> {
  if (returnTo) {
    try {
      window.sessionStorage.setItem(RETURN_TO_KEY, returnTo);
    } catch {
      // Ιδιωτική περιήγηση: χάνουμε μόνο την επιστροφή στη σελίδα, όχι το login.
    }
  }
  await userManager().signinRedirect();
}

export async function completeLogin(): Promise<{ user: User; returnTo: string }> {
  const user = await userManager().signinRedirectCallback();
  let returnTo = '/';
  try {
    returnTo = window.sessionStorage.getItem(RETURN_TO_KEY) ?? '/';
    window.sessionStorage.removeItem(RETURN_TO_KEY);
  } catch {
    // βλ. παραπάνω
  }
  return { user, returnTo };
}

export async function completeSilentRenew(): Promise<void> {
  await userManager().signinSilentCallback();
}

/**
 * Προσπάθεια σιωπηλής σύνδεσης (`prompt=none`) πάνω στη συνεδρία του Authentik.
 * Επιστρέφει το access token αν υπάρχει ενεργή συνεδρία, αλλιώς `null` — χωρίς
 * να πετάξει, ώστε η σελίδα σύνδεσης να δείξει κανονικά τη φόρμα.
 */
export async function trySilentAccessToken(): Promise<string | null> {
  if (!oidcEnabled) return null;
  try {
    const user = await userManager().signinSilent();
    return user?.access_token ?? null;
  } catch {
    return null;
  }
}

/** Η ροή αποσύνδεσης του Authentik (βλ. `infra/authentik/ouchtracker-oidc.yaml`). */
const LOGOUT_FLOW = runtimeConfig().oidcLogoutFlow ?? 'ouchtracker-invalidation';

/**
 * Αποσύνδεση και από το Authentik, όχι μόνο τοπικά — αλλιώς ο επόμενος χρήστης
 * σε κοινόχρηστο υπολογιστή θα έμπαινε αυτόματα ως ο προηγούμενος.
 */
export async function ssoLogout(): Promise<void> {
  try {
    await userManager().removeUser();
  } catch {
    // ακόμη κι αν αποτύχει, συνεχίζουμε στη ροή αποσύνδεσης του IdP.
  }
  const authentik = new URL(OIDC_AUTHORITY).origin;
  window.location.assign(`${authentik}/if/flow/${LOGOUT_FLOW}/`);
}
