<script setup lang="ts">
import { retrieveRawInitData } from "@tma.js/sdk-vue";
import type { Product, ReceiptResponse } from "~/types/receipt";

const {
  data: receipt,
  status: receiptStatus,
  error: receiptError,
  refresh: refreshReceipt,
} = useClientFetch<ReceiptResponse>("/api/receipt/my", { method: "POST" });

const { data: products } = useClientFetch<Product[]>("/api/products");

const counts = reactive<Record<number, number>>({});

watch(receipt, (r) => {
  if (!r) return;
  if (r.status === "AWAITING_PAYMENT") {
    navigateTo(`/receipt/${r.id}`);
    return;
  }
  for (const entry of r.entries) {
    counts[entry.productId] = entry.unitCount;
  }
});

const increment = (productId: number) => {
  counts[productId] = (counts[productId] ?? 0) + 1;
};

const decrement = (productId: number) => {
  const current = counts[productId] ?? 0;
  if (current > 0) counts[productId] = current - 1;
};

const runningTotal = computed(() => {
  if (!products.value) return 0;
  return products.value.reduce((sum, p) => {
    return sum + (counts[p.id] ?? 0) * p.price;
  }, 0);
});

const hasItems = computed(() => runningTotal.value > 0);

const formatPrice = (cents: number) => `${(cents / 100).toFixed(2)} грн`;

const getHeaders = () => {
  const Authorization = retrieveRawInitData();
  if (!Authorization) return;
  return { Authorization };
};

const saving = ref(false);
const saveError = ref<string | null>(null);

const saveEntries = async () => {
  if (!receipt.value) return;
  saving.value = true;
  saveError.value = null;
  try {
    const entries = Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([productId, unit_count]) => ({
        product_id: Number(productId),
        unit_count,
      }));
    await $fetch(`/api/receipt/${receipt.value.id}/entries`, {
      method: "PUT",
      body: { entries },
      headers: getHeaders(),
    });
    await refreshReceipt();
  } catch (err) {
    saveError.value = err?.data?.message ?? "Помилка збереження";
  } finally {
    saving.value = false;
  }
};

const paying = ref(false);
const payError = ref<string | null>(null);

const pay = async () => {
  if (!receipt.value || !hasItems.value) return;
  paying.value = true;
  payError.value = null;
  try {
    const entries = Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([productId, unit_count]) => ({
        product_id: Number(productId),
        unit_count,
      }));
    await $fetch(`/api/receipt/${receipt.value.id}/entries`, {
      method: "PUT",
      body: { entries },
      headers: getHeaders(),
    });
    await $fetch(`/api/receipt/${receipt.value.id}/pay`, {
      method: "POST",
      headers: getHeaders(),
    });
    await navigateTo(`/receipt/${receipt.value.id}`);
  } catch (err) {
    payError.value = err?.data?.message ?? "Помилка оплати";
  } finally {
    paying.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col gap-4 p-4 w-full max-w-md mx-auto pb-32">
    <div
      v-if="receiptStatus === 'idle' || receiptStatus === 'pending'"
      class="text-annotation text-sm text-center mt-8"
    >
      Завантаження...
    </div>

    <div
      v-else-if="receiptError"
      class="rounded-xl border border-error bg-error/10 p-4 text-sm text-error"
    >
      {{ receiptError.message }}
    </div>

    <template v-else-if="receipt">
      <UCard>
        <div>
          <p class="font-semibold text-lg">
            Барне замовлення #{{ receipt.id }}
          </p>
          <p class="text-sm text-annotation">
            {{
              receipt.status === "UNPAID"
                ? "В процесі"
                : receipt.status === "AWAITING_PAYMENT"
                  ? "Очікується оплата"
                  : receipt.status === "PAID"
                    ? "Оплачено"
                    : "Скасовано"
            }}
          </p>
        </div>
      </UCard>

      <!-- UNPAID: editable product catalog -->
      <template v-if="receipt.status === 'UNPAID'">
        <UCard v-for="product in products" :key="product.id">
          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <p class="font-medium truncate">{{ product.name }}</p>
              <p class="text-sm text-annotation">
                {{ formatPrice(product.price) }} / {{ product.unit }}
              </p>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <UButton size="sm" variant="ghost" @click="decrement(product.id)">
                −
              </UButton>
              <span class="w-6 text-center font-mono">
                {{ counts[product.id] ?? 0 }}
              </span>
              <UButton size="sm" variant="ghost" @click="increment(product.id)">
                +
              </UButton>
            </div>
          </div>
        </UCard>

        <p v-if="saveError" class="text-sm text-error">{{ saveError }}</p>
        <p v-if="payError" class="text-sm text-error">{{ payError }}</p>

        <div
          class="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-gray-200 dark:border-neutral-700"
        >
          <div class="max-w-md mx-auto flex flex-col gap-2">
            <p class="text-center font-semibold">
              Разом: {{ formatPrice(runningTotal) }}
            </p>
            <div class="flex gap-2">
              <UButton variant="outline" :loading="saving" @click="saveEntries">
                <UIcon name="i-heroicons-check" class="size-5" aria-hidden="true" />
                <span class="sr-only">Зберегти</span>
              </UButton>
              <UButton :disabled="!hasItems" :loading="paying" @click="pay">
                <UIcon name="i-heroicons-credit-card" class="size-5 mr-1" aria-hidden="true" />
                Сплатити
              </UButton>
            </div>
          </div>
        </div>
      </template>

      <!-- AWAITING_PAYMENT: read-only + screenshot instruction -->
      <template v-else-if="receipt.status === 'AWAITING_PAYMENT'">
        <UCard>
          <template #header>
            <h2 class="font-semibold">Замовлення</h2>
          </template>
          <div class="flex flex-col gap-2">
            <div
              v-for="entry in receipt.entries"
              :key="entry.productId"
              class="flex justify-between text-sm"
            >
              <span>{{ entry.productName }} × {{ entry.unitCount }}</span>
              <span>{{ formatPrice(entry.subtotal) }}</span>
            </div>
            <div
              class="border-t border-gray-200 dark:border-neutral-700 pt-2 flex justify-between font-semibold"
            >
              <span>Разом</span>
              <span>{{ formatPrice(receipt.total) }}</span>
            </div>
          </div>
        </UCard>

        <UCard>
          <p class="text-sm text-annotation">
            Посилання на оплату надіслано у Telegram. Після оплати надішліть
            скріншот боту — бармен підтвердить.
          </p>
        </UCard>
      </template>

      <!-- PAID: final state -->
      <template v-else-if="receipt.status === 'PAID'">
        <UCard>
          <template #header>
            <h2 class="font-semibold">Замовлення оплачено ✓</h2>
          </template>
          <div class="flex flex-col gap-2">
            <div
              v-for="entry in receipt.entries"
              :key="entry.productId"
              class="flex justify-between text-sm"
            >
              <span>{{ entry.productName }} × {{ entry.unitCount }}</span>
              <span>{{ formatPrice(entry.subtotal) }}</span>
            </div>
            <div
              class="border-t border-gray-200 dark:border-neutral-700 pt-2 flex justify-between font-semibold"
            >
              <span>Разом</span>
              <span>{{ formatPrice(receipt.total) }}</span>
            </div>
          </div>
        </UCard>
      </template>

      <!-- CANCELLED: terminal state -->
      <template v-else-if="receipt.status === 'CANCELLED'">
        <UCard>
          <template #header>
            <h2 class="font-semibold">Замовлення скасовано</h2>
          </template>
          <div class="flex flex-col gap-2">
            <div
              v-for="entry in receipt.entries"
              :key="entry.productId"
              class="flex justify-between text-sm text-annotation"
            >
              <span>{{ entry.productName }} × {{ entry.unitCount }}</span>
              <span>{{ formatPrice(entry.subtotal) }}</span>
            </div>
            <div
              v-if="receipt.entries.length > 0"
              class="border-t border-gray-200 dark:border-neutral-700 pt-2 flex justify-between font-semibold text-annotation"
            >
              <span>Разом</span>
              <span>{{ formatPrice(receipt.total) }}</span>
            </div>
          </div>
        </UCard>
        <p class="text-sm text-annotation text-center">
          Зверніться до бармена, щоб відкрити нове замовлення.
        </p>
      </template>
    </template>
  </div>
</template>
