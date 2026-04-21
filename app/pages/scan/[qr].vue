<script setup lang="ts">
import { retrieveRawInitData } from "@tma.js/sdk-vue";
import type { Product, ReceiptResponse } from "~/types/receipt";

const { isBartender, status: authStatus } = useAuth();
watch(authStatus, (s) => {
  if (s === "success" && !isBartender.value) navigateTo("/unauthenticated");
});

const route = useRoute();
const qr = computed(() => route.params.qr as string);

const {
  data: receipt,
  status: receiptStatus,
  error: receiptError,
  refresh: refreshReceipt,
} = useClientFetch<ReceiptResponse>(
  () => `/api/receipt/upsert-for/${qr.value}`,
  { method: "POST" },
);

const { data: products } = useClientFetch<Product[]>("/api/products");

const counts = reactive<Record<number, number>>({});

watch(receipt, (r) => {
  if (!r) return;
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

const formatPrice = (cents: number) => `${(cents / 100).toFixed(2)} грн`;

const getHeaders = () => ({ Authorization: retrieveRawInitData() });

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
  } catch (err: any) {
    saveError.value = err?.data?.message ?? "Помилка збереження";
  } finally {
    saving.value = false;
  }
};

const requestingPayment = ref(false);
const requestError = ref<string | null>(null);

const requestPayment = async () => {
  if (!receipt.value) return;
  requestingPayment.value = true;
  requestError.value = null;
  try {
    await $fetch(`/api/receipt/${receipt.value.id}/request-payment`, {
      method: "POST",
      headers: getHeaders(),
    });
    await refreshReceipt();
  } catch (err: any) {
    requestError.value = err?.data?.message ?? "Помилка надсилання запиту";
  } finally {
    requestingPayment.value = false;
  }
};

const confirming = ref(false);
const confirmError = ref<string | null>(null);

const confirmPayment = async () => {
  if (!receipt.value) return;
  confirming.value = true;
  confirmError.value = null;
  try {
    await $fetch(`/api/receipt/${receipt.value.id}/confirm-payment`, {
      method: "POST",
      headers: getHeaders(),
    });
    await refreshReceipt();
  } catch (err: any) {
    confirmError.value = err?.data?.message ?? "Помилка підтвердження";
  } finally {
    confirming.value = false;
  }
};

const rejecting = ref(false);
const rejectError = ref<string | null>(null);

const rejectPayment = async () => {
  if (!receipt.value) return;
  rejecting.value = true;
  rejectError.value = null;
  try {
    await $fetch(`/api/receipt/${receipt.value.id}/reject-payment`, {
      method: "POST",
      headers: getHeaders(),
    });
    await refreshReceipt();
  } catch (err: any) {
    rejectError.value = err?.data?.message ?? "Помилка відхилення";
  } finally {
    rejecting.value = false;
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
        <div class="flex items-center justify-between">
          <div>
            <p class="font-semibold text-lg">{{ receipt.guestName }}</p>
            <p class="text-sm text-annotation">
              {{
                receipt.status === "UNPAID"
                  ? "Не оплачено"
                  : receipt.status === "AWAITING_PAYMENT"
                    ? "Очікується оплата"
                    : "Оплачено"
              }}
            </p>
          </div>
          <UButton
            v-if="receipt.status === 'AWAITING_PAYMENT'"
            size="sm"
            variant="ghost"
            @click="refreshReceipt"
          >
            Оновити
          </UButton>
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
        <p v-if="requestError" class="text-sm text-error">{{ requestError }}</p>

        <div
          class="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-gray-200 dark:border-neutral-700"
        >
          <div class="max-w-md mx-auto flex flex-col gap-2">
            <p class="text-center font-semibold">
              Разом: {{ formatPrice(runningTotal) }}
            </p>
            <div class="flex gap-2">
              <UButton
                class="flex-1"
                variant="ghost"
                :loading="saving"
                @click="saveEntries"
              >
                Зберегти
              </UButton>
              <UButton
                class="flex-1"
                :loading="requestingPayment"
                @click="requestPayment"
              >
                Надіслати запит оплати
              </UButton>
            </div>
          </div>
        </div>
      </template>

      <!-- AWAITING_PAYMENT: read-only summary -->
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

        <template v-if="!receipt.paymentFileId">
          <p class="text-annotation text-sm text-center">
            Очікуємо підтвердження оплати від гостя...
          </p>
        </template>

        <template v-else>
          <UCard>
            <template #header>
              <h2 class="font-semibold">Підтвердження оплати</h2>
            </template>
            <ViewerPaymentReceipt
              :file-id="receipt.paymentFileId"
              :mimetype="receipt.paymentMimetype"
            />
          </UCard>

          <p v-if="confirmError" class="text-sm text-error">
            {{ confirmError }}
          </p>
          <p v-if="rejectError" class="text-sm text-error">{{ rejectError }}</p>

          <div class="flex gap-2">
            <UButton
              class="flex-1"
              color="error"
              variant="ghost"
              :loading="rejecting"
              @click="rejectPayment"
            >
              Відхилити
            </UButton>
            <UButton
              class="flex-1"
              :loading="confirming"
              @click="confirmPayment"
            >
              Підтвердити
            </UButton>
          </div>
        </template>
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
    </template>
  </div>
</template>
