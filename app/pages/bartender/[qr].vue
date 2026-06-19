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

// Payment method modal
const paymentModalOpen = ref(false);

const openPaymentModal = () => {
  paymentModalOpen.value = true;
};

const requestingPayment = ref(false);
const requestError = ref<string | null>(null);

const requestPayment = async (method: "CARD" | "CASH") => {
  if (!receipt.value) return;
  paymentModalOpen.value = false;
  requestingPayment.value = true;
  requestError.value = null;
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
    await $fetch(`/api/receipt/${receipt.value.id}/request-payment`, {
      method: "POST",
      body: { method },
      headers: getHeaders(),
    });
    await refreshReceipt();
  } catch (err) {
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
  } catch (err) {
    confirmError.value = err?.data?.message ?? "Помилка підтвердження";
  } finally {
    confirming.value = false;
  }
};

const editing = ref(false);
const editError = ref<string | null>(null);

const editReceipt = async () => {
  if (!receipt.value) return;
  editing.value = true;
  editError.value = null;
  try {
    await $fetch(`/api/receipt/${receipt.value.id}/reject-payment`, {
      method: "POST",
      headers: getHeaders(),
    });
    await refreshReceipt();
  } catch (err) {
    editError.value = err?.data?.message ?? "Помилка редагування";
  } finally {
    editing.value = false;
  }
};

const cancelling = ref(false);
const cancelError = ref<string | null>(null);

const cancelReceipt = async () => {
  if (!receipt.value) return;
  cancelling.value = true;
  cancelError.value = null;
  try {
    await $fetch(`/api/receipt/${receipt.value.id}/cancel`, {
      method: "POST",
      headers: getHeaders(),
    });
    await refreshReceipt();
  } catch (err) {
    cancelError.value = err?.data?.message ?? "Помилка скасування";
  } finally {
    cancelling.value = false;
  }
};

const finishing = ref(false);
const finishError = ref<string | null>(null);

const finishReceipt = async () => {
  if (!receipt.value) return;
  finishing.value = true;
  finishError.value = null;
  try {
    await $fetch(`/api/receipt/${receipt.value.id}/finish`, {
      method: "POST",
      headers: getHeaders(),
    });
    await refreshReceipt();
  } catch (err) {
    finishError.value = err?.data?.message ?? "Помилка";
  } finally {
    finishing.value = false;
  }
};

const creatingNew = ref(false);
const createNewError = ref<string | null>(null);

const createNewOrder = async () => {
  creatingNew.value = true;
  createNewError.value = null;
  try {
    await $fetch(`/api/receipt/new-for/${qr.value}`, {
      method: "POST",
      headers: getHeaders(),
    });
    Object.keys(counts).forEach((k) => delete counts[Number(k)]);
    await refreshReceipt();
  } catch (err) {
    createNewError.value = err?.data?.message ?? "Помилка створення замовлення";
  } finally {
    creatingNew.value = false;
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
      <!-- Payment method modal -->
      <UModal v-model:open="paymentModalOpen" title="Спосіб оплати">
        <template #body>
          <p class="text-sm text-annotation mb-4">
            Оберіть спосіб оплати для замовлення #{{ receipt.id }}
          </p>
          <div class="flex gap-3">
            <UButton
              class="flex-1"
              variant="outline"
              :loading="requestingPayment"
              @click="requestPayment('CASH')"
            >
              <UIcon name="i-heroicons-banknotes" class="size-5 mr-1" aria-hidden="true" />
              <span>Готівка</span>
            </UButton>
            <UButton
              class="flex-1"
              :loading="requestingPayment"
              @click="requestPayment('CARD')"
            >
              <UIcon name="i-heroicons-credit-card" class="size-5 mr-1" aria-hidden="true" />
              <span>Картка</span>
            </UButton>
          </div>
        </template>
      </UModal>

      <div class="flex items-center gap-2">
        <UButton
          to="/orders"
          icon="i-lucide-arrow-left"
          variant="ghost"
          size="sm"
          label="В меню"
        />
      </div>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="font-semibold text-lg">
              Замовлення #{{ receipt.id }} для {{ receipt.guestName }}
            </p>
            <p class="text-sm text-annotation">
              @{{ receipt.username }} | {{ receipt.phoneNumber }}
            </p>
          </div>
          <UButton
            v-if="receipt.status === 'AWAITING_PAYMENT'"
            size="sm"
            variant="ghost"
            @click="refreshReceipt"
          >
            <UIcon name="i-heroicons-arrow-path" class="size-5" aria-hidden="true" />
            <span class="sr-only">Оновити</span>
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
        <p v-if="cancelError" class="text-sm text-error">{{ cancelError }}</p>

        <div
          class="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-gray-200 dark:border-neutral-700"
        >
          <div class="max-w-md mx-auto flex flex-col gap-2">
            <p class="text-center font-semibold">
              Разом: {{ formatPrice(runningTotal) }}
            </p>
            <div class="flex justify-between gap-2">
              <UButton
                color="error"
                variant="ghost"
                :loading="cancelling"
                @click="cancelReceipt"
              >
                <UIcon name="i-heroicons-x-mark" class="size-5" aria-hidden="true" />
                <span class="sr-only">Скасувати</span>
              </UButton>
              <UButton
                variant="ghost"
                :loading="requestingPayment"
                @click="openPaymentModal"
              >
                Надіслати запит оплати
              </UButton>
              <UButton :loading="saving" @click="saveEntries">
                <UIcon name="i-heroicons-check" class="size-5" aria-hidden="true" />
                <span class="sr-only">Зберегти</span>
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

        <!-- Cash path: no screenshot needed -->
        <template v-if="receipt.paymentMethod === 'CASH'">
          <p v-if="confirmError" class="text-sm text-error">
            {{ confirmError }}
          </p>
          <p v-if="editError" class="text-sm text-error">{{ editError }}</p>
          <p v-if="cancelError" class="text-sm text-error">{{ cancelError }}</p>

          <div class="flex justify-end gap-2">
            <UButton
              color="error"
              variant="ghost"
              :loading="cancelling"
              @click="cancelReceipt"
            >
              <UIcon name="i-heroicons-x-mark" class="size-5" aria-hidden="true" />
              <span class="sr-only">Скасувати</span>
            </UButton>
            <UButton variant="outline" :loading="editing" @click="editReceipt">
              <UIcon name="i-heroicons-pencil" class="size-5" aria-hidden="true" />
              <span class="sr-only">Редагувати</span>
            </UButton>
            <UButton :loading="confirming" @click="confirmPayment">
              Підтвердити отримання готівки
            </UButton>
          </div>
        </template>

        <!-- Card path: wait for screenshot -->
        <template v-else>
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
          </template>

          <p v-if="confirmError" class="text-sm text-error">
            {{ confirmError }}
          </p>
          <p v-if="editError" class="text-sm text-error">{{ editError }}</p>
          <p v-if="cancelError" class="text-sm text-error">{{ cancelError }}</p>

          <div class="flex justify-end gap-2">
            <UButton
              color="error"
              variant="ghost"
              :loading="cancelling"
              @click="cancelReceipt"
            >
              <UIcon name="i-heroicons-x-mark" class="size-5" aria-hidden="true" />
              <span class="sr-only">Скасувати</span>
            </UButton>
            <UButton variant="outline" :loading="editing" @click="editReceipt">
              <UIcon name="i-heroicons-pencil" class="size-5" aria-hidden="true" />
              <span class="sr-only">Редагувати</span>
            </UButton>
            <UButton
              v-if="receipt.paymentFileId"
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

        <p v-if="finishError" class="text-sm text-error">{{ finishError }}</p>
        <p v-if="createNewError" class="text-sm text-error">
          {{ createNewError }}
        </p>

        <div class="flex justify-end gap-2">
          <UButton
            variant="ghost"
            :loading="creatingNew"
            @click="createNewOrder"
          >
            <UIcon name="i-heroicons-plus" class="size-5 mr-1" aria-hidden="true" />
            <span class="sr-only">Нове замовлення</span>
            Нове замовлення
          </UButton>
          <UButton :loading="finishing" @click="finishReceipt">
            <UIcon name="i-heroicons-check-circle" class="size-5 mr-1" aria-hidden="true" />
            Оброблено
          </UButton>
        </div>
      </template>

      <!-- FINISHED: terminal state -->
      <template v-else-if="receipt.status === 'FINISHED'">
        <UCard>
          <template #header>
            <h2 class="font-semibold">Оброблено ✓</h2>
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
              class="border-t border-gray-200 dark:border-neutral-700 pt-2 flex justify-between font-semibold text-annotation"
            >
              <span>Разом</span>
              <span>{{ formatPrice(receipt.total) }}</span>
            </div>
          </div>
        </UCard>

        <p v-if="createNewError" class="text-sm text-error">
          {{ createNewError }}
        </p>

        <UButton
          class="w-full"
          variant="ghost"
          :loading="creatingNew"
          @click="createNewOrder"
        >
          <UIcon name="i-heroicons-plus" class="size-5 mr-1" aria-hidden="true" />
          Нове замовлення
        </UButton>
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
              class="border-t border-gray-200 dark:border-neutral-700 pt-2 flex justify-between font-semibold text-annotation"
            >
              <span>Разом</span>
              <span>{{ formatPrice(receipt.total) }}</span>
            </div>
          </div>
        </UCard>

        <p v-if="createNewError" class="text-sm text-error">
          {{ createNewError }}
        </p>

        <UButton
          class="w-full"
          variant="ghost"
          :loading="creatingNew"
          @click="createNewOrder"
        >
          <UIcon name="i-heroicons-plus" class="size-5 mr-1" aria-hidden="true" />
          Нове замовлення
        </UButton>
      </template>
    </template>
  </div>
</template>
