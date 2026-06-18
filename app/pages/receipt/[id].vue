<script setup lang="ts">
import type { ReceiptResponse } from "~/types/receipt";

const route = useRoute();
const id = computed(() => route.params.id as string);

const { data: receipt, status, error } = useClientFetch<ReceiptResponse>(
  () => `/api/receipt/${id.value}`,
);

const formatPrice = (cents: number) => `${(cents / 100).toFixed(2)} грн`;

const statusLabel = computed(() => {
  switch (receipt.value?.status) {
    case "UNPAID": return "В процесі";
    case "AWAITING_PAYMENT": return "Очікується оплата";
    case "PAID": return "Оплачено";
    case "CANCELLED": return "Скасовано";
    default: return "";
  }
});

const statusColor = computed(() => {
  switch (receipt.value?.status) {
    case "PAID": return "text-success";
    case "CANCELLED": return "text-error";
    case "AWAITING_PAYMENT": return "text-warning";
    default: return "text-annotation";
  }
});
</script>

<template>
  <div class="flex flex-col gap-4 p-4 w-full max-w-md mx-auto">
    <div
      v-if="status === 'idle' || status === 'pending'"
      class="text-sm text-annotation text-center mt-8"
    >
      Завантаження...
    </div>

    <div
      v-else-if="error"
      class="rounded-xl border border-error bg-error/10 p-4 text-sm text-error"
    >
      {{ error.message }}
    </div>

    <template v-else-if="receipt">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h1 class="font-bold text-lg">Замовлення #{{ receipt.id }}</h1>
            <span :class="['text-sm font-medium', statusColor]">{{ statusLabel }}</span>
          </div>
        </template>

        <div class="flex flex-col gap-1 mb-3">
          <p class="text-sm text-annotation">Гість: {{ receipt.guestName }}</p>
          <p v-if="receipt.paymentMethod" class="text-sm text-annotation">
            Оплата: {{ receipt.paymentMethod === "CASH" ? "Готівка" : "Картка" }}
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <div class="grid grid-cols-4 text-xs text-annotation font-medium uppercase tracking-wide pb-1 border-b border-gray-200 dark:border-neutral-700">
            <span class="col-span-2">Позиція</span>
            <span class="text-right">К-сть</span>
            <span class="text-right">Сума</span>
          </div>

          <div
            v-for="entry in receipt.entries"
            :key="entry.productId"
            class="grid grid-cols-4 text-sm"
          >
            <div class="col-span-2">
              <p>{{ entry.productName }}</p>
              <p class="text-xs text-annotation">{{ formatPrice(entry.unitPrice) }} / {{ entry.unit }}</p>
            </div>
            <span class="text-right self-center">× {{ entry.unitCount }}</span>
            <span class="text-right self-center font-medium">{{ formatPrice(entry.subtotal) }}</span>
          </div>

          <div
            v-if="receipt.entries.length === 0"
            class="text-sm text-annotation text-center py-2"
          >
            Позицій немає
          </div>

          <div class="border-t border-gray-200 dark:border-neutral-700 pt-2 flex justify-between font-bold">
            <span>Разом</span>
            <span>{{ formatPrice(receipt.total) }}</span>
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>
