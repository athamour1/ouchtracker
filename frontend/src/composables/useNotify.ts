import { useQuasar } from 'quasar';

export function useNotify() {
  const $q = useQuasar();

  function success(message: string) {
    $q.notify({ type: 'positive', message, position: 'top-right', timeout: 2500 });
  }

  function error(err: unknown, fallback = 'An error occurred') {
    const raw = (err as { response?: { data?: { message?: string | string[] } } })
      ?.response?.data?.message;
    const message: string = Array.isArray(raw) ? (raw[0] ?? fallback) : (raw ?? fallback);
    $q.notify({ type: 'negative', message, position: 'top-right', timeout: 4000 });
  }

  return { success, error };
}
