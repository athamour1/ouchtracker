<template>
  <q-page padding>
    <div class="text-h5 q-mb-lg">
      <q-icon name="inventory" class="q-mr-sm" />My Kits
    </div>

    <!-- Loading skeletons -->
    <div v-if="loading" class="row q-col-gutter-md">
      <div v-for="n in 3" :key="n" class="col-12 col-sm-6 col-md-4">
        <q-card flat bordered>
          <q-card-section>
            <q-skeleton type="text" width="60%" class="q-mb-sm" />
            <q-skeleton type="text" width="40%" />
          </q-card-section>
          <q-card-section><q-skeleton type="rect" height="60px" /></q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="!kits.length" class="column items-center q-py-xl text-grey-5">
      <q-icon name="inventory_2" size="64px" class="q-mb-md" />
      <div class="text-h6">No kits assigned yet</div>
      <div class="text-caption">Contact your admin to get a kit assigned to you.</div>
    </div>

    <!-- Kit cards grid -->
    <div v-else class="row q-col-gutter-md">
      <div
        v-for="kit in kits"
        :key="kit.id"
        class="col-12 col-sm-6 col-md-4"
      >
        <q-card flat bordered class="kit-card cursor-pointer full-height"
          @click="goInspect(kit.id)"
        >
          <!-- Card header -->
          <q-card-section class="q-pb-sm">
            <div class="row items-start no-wrap">
              <div class="col">
                <div class="text-subtitle1 text-weight-bold ellipsis">{{ kit.name }}</div>
                <div class="text-caption text-grey-6 row items-center">
                  <q-icon name="location_on" size="14px" class="q-mr-xs" />
                  {{ kit.location || 'No location set' }}
                </div>
              </div>
              <!-- Alert badge -->
              <q-badge
                v-if="expiredCount(kit) > 0"
                color="negative"
                floating
                :label="expiredCount(kit)"
              >
                <q-tooltip>{{ expiredCount(kit) }} expired item(s)</q-tooltip>
              </q-badge>
              <q-badge
                v-else-if="expiringSoonCount(kit) > 0"
                color="orange"
                floating
                :label="expiringSoonCount(kit)"
              >
                <q-tooltip>{{ expiringSoonCount(kit) }} item(s) expiring soon</q-tooltip>
              </q-badge>
            </div>
          </q-card-section>

          <q-separator />

          <!-- Item summary chips -->
          <q-card-section class="q-py-sm">
            <div class="row q-gutter-xs q-mb-sm">
              <q-chip dense icon="inventory_2" color="grey-3" text-color="grey-8" size="sm">
                {{ kit.kitItems.length }} items
              </q-chip>
              <q-chip v-if="expiredCount(kit) > 0" dense icon="dangerous"
                color="negative" text-color="white" size="sm">
                {{ expiredCount(kit) }} expired
              </q-chip>
              <q-chip v-if="expiringSoonCount(kit) > 0" dense icon="warning"
                color="orange" text-color="white" size="sm">
                {{ expiringSoonCount(kit) }} expiring
              </q-chip>
              <q-chip v-if="expiredCount(kit) === 0 && expiringSoonCount(kit) === 0 && kit.kitItems.length"
                dense icon="check_circle" color="positive" text-color="white" size="sm">
                All valid
              </q-chip>
            </div>
          </q-card-section>

          <!-- Item preview list (up to 4) -->
          <q-card-section class="q-pt-none q-pb-sm" v-if="kit.kitItems.length">
            <q-list dense>
              <q-item
                v-for="item in kit.kitItems.slice(0, 4)"
                :key="item.id"
                class="q-px-none"
                style="min-height: 28px"
              >
                <q-item-section>
                  <q-item-label class="text-caption">
                    {{ item.name }}
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  <div class="row items-center q-gutter-xs">
                    <span class="text-caption text-grey-6">×{{ item.quantity }}</span>
                    <q-icon
                      :name="item.isValid ? 'check_circle' : 'cancel'"
                      :color="item.isValid ? 'positive' : 'negative'"
                      size="14px"
                    />
                  </div>
                </q-item-section>
              </q-item>
              <q-item v-if="kit.kitItems.length > 4" class="q-px-none" style="min-height: 24px">
                <q-item-section>
                  <q-item-label class="text-caption text-grey-5">
                    + {{ kit.kitItems.length - 4 }} more…
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </q-card-section>

          <q-separator />

          <!-- Actions -->
          <q-card-actions class="q-gutter-xs">
            <q-btn
              flat color="grey-7" icon="open_in_new" label="Details"
              @click.stop="router.push({ name: 'my-kit-detail', params: { id: kit.id } })"
            />
            <q-space />
            <q-btn
              flat color="primary" icon="fact_check" label="Inspect"
              @click.stop="goInspect(kit.id)"
            />
          </q-card-actions>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { kitsApi, type Kit } from 'src/services/api';
import { useNotify } from 'src/composables/useNotify';

const router = useRouter();
const notify = useNotify();
const kits = ref<Kit[]>([]);
const loading = ref(false);

const EXPIRY_WARNING_DAYS = 30;

function expiredCount(kit: Kit): number {
  return kit.kitItems.filter((i) => !i.isValid).length;
}

function expiringSoonCount(kit: Kit): number {
  const threshold = Date.now() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000;
  return kit.kitItems.filter((i) => {
    if (!i.isValid) return false; // already counted as expired
    if (!i.expirationDate) return false;
    return new Date(i.expirationDate).getTime() <= threshold;
  }).length;
}

function goInspect(kitId: string) {
  void router.push({ name: 'kit-inspect', params: { id: kitId } });
}

onMounted(async () => {
  loading.value = true;
  try {
    const { data } = await kitsApi.myKits();
    kits.value = data;
  } catch (e) {
    notify.error(e, 'Failed to load your kits');
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped lang="css">
.kit-card {
  border-radius: 12px;
  transition: box-shadow 0.2s, transform 0.15s;
}
.kit-card:hover {
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}
</style>
