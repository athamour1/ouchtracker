import { ref, computed } from 'vue';
import { defineStore } from 'pinia';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface QueuedInspection {
  type: 'inspection';
  id: string;
  createdAt: string;
  kitId: string;
  notes?: string;
  items: {
    kitItemId: string;
    quantityFound: number;
    expirationDateFound: string | null;
    notes?: string;
  }[];
}

export interface QueuedIncident {
  type: 'incident';
  id: string;
  createdAt: string;
  kitId: string;
  description?: string;
  items: {
    kitItemId: string;
    quantityUsed: number;
    notes?: string;
  }[];
}

export type QueuedItem = QueuedInspection | QueuedIncident;

// ── Store ──────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'ouchtracker_sync_queue';

export const useSyncQueue = defineStore('syncQueue', () => {
  const queue    = ref<QueuedItem[]>([]);
  const flushing = ref(false);

  const pendingCount = computed(() => queue.value.length);
  const hasPending   = computed(() => queue.value.length > 0);

  // ── Persistence ──────────────────────────────────────────────────────────────

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.value));
  }

  function hydrate() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      queue.value = raw ? (JSON.parse(raw) as QueuedItem[]) : [];
    } catch {
      queue.value = [];
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────────

  function enqueue(item: QueuedItem) {
    queue.value.push(item);
    persist();
  }

  function discard(id: string) {
    queue.value = queue.value.filter((i) => i.id !== id);
    persist();
  }

  async function flush(): Promise<{ submitted: number; failed: number }> {
    if (flushing.value || queue.value.length === 0) return { submitted: 0, failed: 0 };
    flushing.value = true;

    // Dynamic import to avoid circular dependency (same pattern as auth.store.ts)
    const { inspectionsApi, incidentsApi } = await import('src/services/api');

    let submitted = 0;
    let failed    = 0;
    const remaining: QueuedItem[] = [];

    for (const item of queue.value) {
      try {
        if (item.type === 'inspection') {
          await inspectionsApi.submit({
            kitId: item.kitId,
            ...(item.notes && { notes: item.notes }),
            items: item.items,
          });
        } else {
          await incidentsApi.submit({
            kitId: item.kitId,
            ...(item.description && { description: item.description }),
            items: item.items,
          });
        }
        submitted++;
      } catch (e) {
        // Treat "already exists" or validation errors as success (remove from queue)
        const status = (e as { response?: { status?: number } }).response?.status;
        if (status === 409 || status === 422) {
          submitted++;
        } else {
          remaining.push(item);
          failed++;
        }
      }
    }

    queue.value = remaining;
    persist();
    flushing.value = false;
    return { submitted, failed };
  }

  hydrate();

  return { queue, flushing, pendingCount, hasPending, enqueue, discard, flush };
});
