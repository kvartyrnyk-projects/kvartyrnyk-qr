<script setup lang="ts">
import type { VisitorRow } from "~/types/stats";

const { visitors } = defineProps<{ visitors: VisitorRow[] }>();

const paymentStatusLabel: Record<string, string> = {
  PENDING: "Очікує",
  CONFIRMED: "Підтверджено",
  FAILED: "Відхилено",
  REFUNDED: "Повернено",
};

const paymentStatusColor = (
  status: string,
): "neutral" | "success" | "error" | "warning" => {
  switch (status) {
    case "CONFIRMED":
      return "success";
    case "FAILED":
      return "error";
    case "REFUNDED":
      return "warning";
    default:
      return "neutral";
  }
};

const visitorLabel = (v: VisitorRow) =>
  v.fullName ??
  (v.username ? `@${v.username}` : `Відвідувач #${v.registrationId}`);
</script>

<template>
  <div class="w-full space-y-2">
    <!--
      One UAccordion per visitor with a fixed slot name "row".
      This avoids the Vue 3 compile-time limitation on v-for + dynamic slots.
    -->
    <UAccordion
      v-for="v in visitors"
      :key="v.registrationId"
      :items="[{ label: visitorLabel(v), slot: 'row' }]"
      collapsible
    >
      <!-- Trigger area (always visible) -->
      <template #default>
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="font-medium">{{ visitorLabel(v) }}</span>
          <span
            v-if="v.friendsCount > 0"
            class="text-sky-400 font-medium text-sm"
            >+{{ v.friendsCount }}</span
          >
          <UBadge
            v-if="v.checkedInAt"
            label="✓ Зайшов"
            color="success"
            variant="soft"
            size="xs"
          />
          <UBadge
            v-else
            label="Не прийшов"
            color="neutral"
            variant="soft"
            size="xs"
          />
          <UBadge
            v-if="v.userRole === 'BANNED'"
            label="Заблокований"
            color="error"
            variant="soft"
            size="xs"
          />
        </div>
      </template>

      <!-- Expanded body -->
      <template #row>
        <div class="space-y-3 pb-2">
          <!-- Meta -->
          <div class="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <p v-if="v.username">@{{ v.username }}</p>
            <p v-if="v.registeredAt">
              Зареєстровано:
              {{ new Date(v.registeredAt).toLocaleString("uk-UA") }}
            </p>
            <p v-if="v.checkedInAt">
              Зайшов:
              {{ new Date(v.checkedInAt).toLocaleString("uk-UA") }}
            </p>
          </div>

          <!-- Friends -->
          <div v-if="v.friends.length">
            <p class="text-sm font-medium mb-1">
              👥 Друзі ({{ v.friends.length }})
            </p>
            <ul
              class="text-sm text-gray-600 dark:text-gray-400 space-y-0.5 list-disc list-inside"
            >
              <li v-for="(f, fi) in v.friends" :key="fi">
                {{ f.name
                }}<span v-if="f.username" class="ml-1 opacity-60"
                  >@{{ f.username }}</span
                >
              </li>
            </ul>
          </div>

          <!-- Payment -->
          <div v-if="v.payment">
            <div class="flex items-center gap-2 mb-1">
              <p class="text-sm font-medium">💳 Оплата</p>
              <UBadge
                :label="
                  paymentStatusLabel[v.payment.status] ?? v.payment.status
                "
                :color="paymentStatusColor(v.payment.status)"
                variant="soft"
                size="xs"
              />
              <span class="text-sm text-gray-600 dark:text-gray-400"
                >{{ v.payment.amount }} UAH</span
              >
            </div>
            <ViewerPaymentReceipt
              :file-id="v.payment.fileId"
              :mimetype="v.payment.mimetype"
            />
          </div>
          <p v-else class="text-sm text-gray-600 dark:text-gray-400">
            Оплата не завантажена
          </p>
        </div>
      </template>
    </UAccordion>
  </div>
</template>
