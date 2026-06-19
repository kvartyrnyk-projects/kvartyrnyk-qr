<script setup lang="ts">
import { retrieveRawInitData } from "@tma.js/sdk-vue";
import type { ReceiptStatus, PaymentMethod } from "~/types/receipt";

interface ReceiptSummary {
  id: number;
  status: ReceiptStatus;
  paymentMethod: PaymentMethod | null;
  total: number;
  guestName: string;
  username: string | null;
  phone: string | null;
  qr: string;
}

const { isBartender } = useAuth();

const {
  data: receipts,
  status: fetchStatus,
  refresh,
} = useClientFetch<ReceiptSummary[]>("/api/receipts");

const formatPrice = (cents: number) => `${(cents / 100).toFixed(2)} грн`;

const unpaid = computed(
  () => receipts.value?.filter((r) => r.status === "UNPAID") ?? [],
);
const awaiting = computed(
  () => receipts.value?.filter((r) => r.status === "AWAITING_PAYMENT") ?? [],
);
const paid = computed(
  () => receipts.value?.filter((r) => r.status === "PAID") ?? [],
);
const finished = computed(
  () => receipts.value?.filter((r) => r.status === "FINISHED") ?? [],
);
const cancelled = computed(
  () => receipts.value?.filter((r) => r.status === "CANCELLED") ?? [],
);

const unpaidLabel = computed(() =>
  isBartender.value ? "В процесі" : "Збережено, не надіслано",
);

const getHeaders = () => {
  const Authorization = retrieveRawInitData();
  if (!Authorization) return;
  return { Authorization };
};

const finishing = ref<number | null>(null);
const finishError = ref<string | null>(null);

const finishReceipt = async (id: number) => {
  finishing.value = id;
  finishError.value = null;
  try {
    await $fetch(`/api/receipt/${id}/finish`, {
      method: "POST",
      headers: getHeaders(),
    });
    await refresh();
  } catch (err) {
    finishError.value = err?.data?.message ?? "Помилка";
  } finally {
    finishing.value = null;
  }
};
</script>

<template>
  <div class="flex flex-col gap-6 p-4 w-full max-w-md mx-auto">
    <div class="flex flex-row justify-between">
      <h1 class="text-xl font-bold">Замовлення</h1>
      <UButton size="sm" @click="navigateTo('/bartender')">
        <UIcon name="i-heroicons-plus" class="size-5" aria-hidden="true" />
        Створити
      </UButton>
    </div>

    <div
      v-if="fetchStatus === 'idle' || fetchStatus === 'pending'"
      class="text-sm text-annotation text-center mt-8"
    >
      Завантаження...
    </div>

    <template v-else>
      <p v-if="finishError" class="text-sm text-error">{{ finishError }}</p>

      <!-- In progress / Saved -->
      <section v-if="unpaid.length > 0">
        <h2
          class="text-sm font-semibold text-annotation uppercase tracking-wide mb-2"
        >
          {{ unpaidLabel }}
        </h2>
        <div class="flex flex-col gap-2">
          <UCard v-for="receipt in unpaid" :key="receipt.id">
            <div class="flex items-center justify-between">
              <div class="min-w-0">
                <p class="font-medium truncate">{{ receipt.guestName }}</p>
                <template v-if="isBartender">
                  <p v-if="receipt.username" class="text-xs text-annotation">
                    @{{ receipt.username }}
                  </p>
                  <p v-if="receipt.phone" class="text-xs text-annotation">
                    {{ receipt.phone }}
                  </p>
                </template>
                <p class="text-sm text-annotation">
                  {{ formatPrice(receipt.total) }}
                </p>
              </div>
              <UButton
                variant="ghost"
                size="sm"
                @click="navigateTo(`/receipt/${receipt.id}`)"
              >
                <UIcon name="i-heroicons-eye" class="size-5" aria-hidden="true" />
                <span class="sr-only">Переглянути</span>
              </UButton>
            </div>
          </UCard>
        </div>
      </section>

      <!-- Awaiting payment -->
      <section v-if="awaiting.length > 0">
        <h2
          class="text-sm font-semibold text-annotation uppercase tracking-wide mb-2"
        >
          Очікується оплата
        </h2>
        <div class="flex flex-col gap-2">
          <UCard v-for="receipt in awaiting" :key="receipt.id">
            <div class="flex items-center justify-between">
              <div class="min-w-0">
                <p class="font-medium truncate">{{ receipt.guestName }}</p>
                <template v-if="isBartender">
                  <p v-if="receipt.username" class="text-xs text-annotation">
                    @{{ receipt.username }}
                  </p>
                  <p v-if="receipt.phone" class="text-xs text-annotation">
                    {{ receipt.phone }}
                  </p>
                </template>
                <p class="text-sm text-annotation">
                  {{ formatPrice(receipt.total) }}
                  <span v-if="receipt.paymentMethod" class="ml-1">
                    ·
                    {{
                      receipt.paymentMethod === "CASH" ? "готівка" : "картка"
                    }}
                  </span>
                </p>
              </div>
              <UButton
                variant="ghost"
                size="sm"
                @click="navigateTo(`/receipt/${receipt.id}`)"
              >
                <UIcon name="i-heroicons-eye" class="size-5" aria-hidden="true" />
                <span class="sr-only">Переглянути</span>
              </UButton>
            </div>
          </UCard>
        </div>
      </section>

      <!-- Done (PAID) -->
      <section v-if="paid.length > 0">
        <h2
          class="text-sm font-semibold text-annotation uppercase tracking-wide mb-2"
        >
          Оплачено
        </h2>
        <div class="flex flex-col gap-2">
          <UCard v-for="receipt in paid" :key="receipt.id">
            <div class="flex items-center justify-between">
              <div class="min-w-0">
                <p class="font-medium truncate">{{ receipt.guestName }}</p>
                <template v-if="isBartender">
                  <p v-if="receipt.username" class="text-xs text-annotation">
                    @{{ receipt.username }}
                  </p>
                  <p v-if="receipt.phone" class="text-xs text-annotation">
                    {{ receipt.phone }}
                  </p>
                </template>
                <p class="text-sm text-annotation">
                  {{ formatPrice(receipt.total) }}
                </p>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <UButton
                  v-if="isBartender"
                  variant="ghost"
                  size="sm"
                  :loading="finishing === receipt.id"
                  @click="finishReceipt(receipt.id)"
                >
                  <UIcon name="i-heroicons-check-circle" class="size-5" aria-hidden="true" />
                  <span class="sr-only">Оброблено</span>
                </UButton>
                <UButton
                  variant="ghost"
                  size="sm"
                  @click="navigateTo(`/receipt/${receipt.id}`)"
                >
                  <UIcon name="i-heroicons-eye" class="size-5" aria-hidden="true" />
                  <span class="sr-only">Переглянути</span>
                </UButton>
              </div>
            </div>
          </UCard>
        </div>
      </section>

      <!-- Finished / Processed -->
      <section v-if="finished.length > 0">
        <h2
          class="text-sm font-semibold text-annotation uppercase tracking-wide mb-2"
        >
          Оброблено
        </h2>
        <div class="flex flex-col gap-2">
          <UCard
            v-for="receipt in finished"
            :key="receipt.id"
            class="opacity-60"
          >
            <div class="flex items-center justify-between">
              <div class="min-w-0">
                <p class="font-medium truncate">{{ receipt.guestName }}</p>
                <template v-if="isBartender">
                  <p v-if="receipt.username" class="text-xs text-annotation">
                    @{{ receipt.username }}
                  </p>
                  <p v-if="receipt.phone" class="text-xs text-annotation">
                    {{ receipt.phone }}
                  </p>
                </template>
                <p class="text-sm text-annotation">
                  {{ formatPrice(receipt.total) }}
                </p>
              </div>
              <UButton
                variant="ghost"
                size="sm"
                @click="navigateTo(`/receipt/${receipt.id}`)"
              >
                <UIcon name="i-heroicons-eye" class="size-5" aria-hidden="true" />
                <span class="sr-only">Переглянути</span>
              </UButton>
            </div>
          </UCard>
        </div>
      </section>

      <!-- Cancelled -->
      <section v-if="cancelled.length > 0">
        <h2
          class="text-sm font-semibold text-annotation uppercase tracking-wide mb-2"
        >
          Скасовано
        </h2>
        <div class="flex flex-col gap-2">
          <UCard
            v-for="receipt in cancelled"
            :key="receipt.id"
            class="opacity-60"
          >
            <div class="flex items-center justify-between">
              <div class="min-w-0">
                <p class="font-medium truncate">{{ receipt.guestName }}</p>
                <template v-if="isBartender">
                  <p v-if="receipt.username" class="text-xs text-annotation">
                    @{{ receipt.username }}
                  </p>
                  <p v-if="receipt.phone" class="text-xs text-annotation">
                    {{ receipt.phone }}
                  </p>
                </template>
                <p class="text-sm text-annotation">
                  {{ formatPrice(receipt.total) }}
                </p>
              </div>
              <UButton
                variant="ghost"
                size="sm"
                @click="navigateTo(`/receipt/${receipt.id}`)"
              >
                <UIcon name="i-heroicons-eye" class="size-5" aria-hidden="true" />
                <span class="sr-only">Переглянути</span>
              </UButton>
            </div>
          </UCard>
        </div>
      </section>

      <p
        v-if="receipts && receipts.length === 0"
        class="text-sm text-annotation text-center mt-8"
      >
        Замовлень немає
      </p>
    </template>
  </div>
</template>
