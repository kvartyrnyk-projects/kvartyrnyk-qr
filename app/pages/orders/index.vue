<script setup lang="ts">
import type { ReceiptStatus, PaymentMethod } from "~/types/receipt";

interface ReceiptSummary {
  id: number;
  status: ReceiptStatus;
  paymentMethod: PaymentMethod | null;
  total: number;
  guestName: string;
}

const { isBartender, status: authStatus } = useAuth();

const { data: receipts, status: fetchStatus } = useClientFetch<ReceiptSummary[]>("/api/receipts");

const formatPrice = (cents: number) => `${(cents / 100).toFixed(2)} грн`;

const unpaid = computed(() => receipts.value?.filter((r) => r.status === "UNPAID") ?? []);
const awaiting = computed(() => receipts.value?.filter((r) => r.status === "AWAITING_PAYMENT") ?? []);
const paid = computed(() => receipts.value?.filter((r) => r.status === "PAID") ?? []);
const cancelled = computed(() => receipts.value?.filter((r) => r.status === "CANCELLED") ?? []);

const unpaidLabel = computed(() =>
  isBartender.value ? "В процесі" : "Збережено, не надіслано"
);
</script>

<template>
  <div class="flex flex-col gap-6 p-4 w-full max-w-md mx-auto">
    <h1 class="text-xl font-bold">Замовлення</h1>

    <div
      v-if="fetchStatus === 'idle' || fetchStatus === 'pending'"
      class="text-sm text-annotation text-center mt-8"
    >
      Завантаження...
    </div>

    <template v-else>
      <!-- In progress / Saved -->
      <section v-if="unpaid.length > 0">
        <h2 class="text-sm font-semibold text-annotation uppercase tracking-wide mb-2">
          {{ unpaidLabel }}
        </h2>
        <div class="flex flex-col gap-2">
          <UCard
            v-for="receipt in unpaid"
            :key="receipt.id"
            class="cursor-pointer"
            @click="navigateTo(`/receipt/${receipt.id}`)"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{{ receipt.guestName }}</p>
                <p class="text-sm text-annotation">{{ formatPrice(receipt.total) }}</p>
              </div>
              <UButton variant="ghost" size="sm" @click.stop="navigateTo(`/receipt/${receipt.id}`)">
                <UIcon name="i-heroicons-eye" aria-hidden="true" />
                <span class="sr-only">Переглянути</span>
              </UButton>
            </div>
          </UCard>
        </div>
      </section>

      <!-- Awaiting payment -->
      <section v-if="awaiting.length > 0">
        <h2 class="text-sm font-semibold text-annotation uppercase tracking-wide mb-2">
          Очікується оплата
        </h2>
        <div class="flex flex-col gap-2">
          <UCard
            v-for="receipt in awaiting"
            :key="receipt.id"
            class="cursor-pointer"
            @click="navigateTo(`/receipt/${receipt.id}`)"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{{ receipt.guestName }}</p>
                <p class="text-sm text-annotation">
                  {{ formatPrice(receipt.total) }}
                  <span v-if="receipt.paymentMethod" class="ml-1">
                    · {{ receipt.paymentMethod === "CASH" ? "готівка" : "картка" }}
                  </span>
                </p>
              </div>
              <UButton variant="ghost" size="sm" @click.stop="navigateTo(`/receipt/${receipt.id}`)">
                <UIcon name="i-heroicons-eye" aria-hidden="true" />
                <span class="sr-only">Переглянути</span>
              </UButton>
            </div>
          </UCard>
        </div>
      </section>

      <!-- Done -->
      <section v-if="paid.length > 0">
        <h2 class="text-sm font-semibold text-annotation uppercase tracking-wide mb-2">
          Оплачено
        </h2>
        <div class="flex flex-col gap-2">
          <UCard
            v-for="receipt in paid"
            :key="receipt.id"
            class="cursor-pointer"
            @click="navigateTo(`/receipt/${receipt.id}`)"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{{ receipt.guestName }}</p>
                <p class="text-sm text-annotation">{{ formatPrice(receipt.total) }}</p>
              </div>
              <UButton variant="ghost" size="sm" @click.stop="navigateTo(`/receipt/${receipt.id}`)">
                <UIcon name="i-heroicons-eye" aria-hidden="true" />
                <span class="sr-only">Переглянути</span>
              </UButton>
            </div>
          </UCard>
        </div>
      </section>

      <!-- Cancelled -->
      <section v-if="cancelled.length > 0">
        <h2 class="text-sm font-semibold text-annotation uppercase tracking-wide mb-2">
          Скасовано
        </h2>
        <div class="flex flex-col gap-2">
          <UCard
            v-for="receipt in cancelled"
            :key="receipt.id"
            class="opacity-60 cursor-pointer"
            @click="navigateTo(`/receipt/${receipt.id}`)"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="font-medium">{{ receipt.guestName }}</p>
                <p class="text-sm text-annotation">{{ formatPrice(receipt.total) }}</p>
              </div>
              <UButton variant="ghost" size="sm" @click.stop="navigateTo(`/receipt/${receipt.id}`)">
                <UIcon name="i-heroicons-eye" aria-hidden="true" />
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
