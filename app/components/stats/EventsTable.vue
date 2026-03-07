<script setup lang="ts">
import type { EventSummaryRow } from "~/types/stats";

defineProps<{ events: EventSummaryRow[] }>();

const statusColor = (
  status: EventSummaryRow["status"],
): "neutral" | "info" | "warning" | "success" | "error" => {
  const map: Record<
    EventSummaryRow["status"],
    "neutral" | "info" | "warning" | "success" | "error"
  > = {
    DRAFT: "neutral",
    REGISTRATION_OPEN: "info",
    REGISTRATION_CLOSED: "warning",
    ONGOING: "success",
    FINISHED: "neutral",
    CANCELLED: "error",
  };
  return map[status] ?? "neutral";
};

const statusLabel: Record<EventSummaryRow["status"], string> = {
  DRAFT: "Чернетка",
  REGISTRATION_OPEN: "Реєстрація відкрита",
  REGISTRATION_CLOSED: "Реєстрація закрита",
  ONGOING: "Триває",
  FINISHED: "Завершено",
  CANCELLED: "Скасовано",
};
</script>

<template>
  <div class="w-full overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr
          class="border-b border-gray-200 dark:border-neutral-700 text-left text-gray-600 dark:text-gray-400"
        >
          <th class="py-2 pr-4 font-medium">Назва</th>
          <th class="py-2 pr-4 font-medium">Дата</th>
          <th class="py-2 pr-4 font-medium">Статус</th>
          <th class="py-2 pr-4 font-medium text-right">Реєстрацій</th>
          <th class="py-2 pr-4 font-medium text-right">Відвідали</th>
          <th class="py-2 pr-4 font-medium text-right">Оплат</th>
          <th class="py-2 font-medium" />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="ev in events"
          :key="ev.id"
          class="border-b border-gray-200 dark:border-neutral-700 last:border-0"
        >
          <td class="py-3 pr-4 font-medium">
            <NuxtLink :to="`/stats/${ev.id}`" class="hover:underline">
              {{ ev.name }}
            </NuxtLink>
          </td>
          <td class="py-3 pr-4 text-gray-600 dark:text-gray-400">
            {{ new Date(ev.startsAt).toLocaleDateString("uk-UA") }}
          </td>
          <td class="py-3 pr-4">
            <UBadge
              :label="statusLabel[ev.status]"
              :color="statusColor(ev.status)"
              variant="soft"
              size="sm"
            />
          </td>
          <td class="py-3 pr-4 text-right">
            {{ ev.registrationsCount }} / {{ ev.maxSlots }}
          </td>
          <td class="py-3 pr-4 text-right">{{ ev.checkedInCount }}</td>
          <td class="py-3 pr-4 text-right">{{ ev.confirmedPayments }}</td>
          <td class="py-3">
            <UButton
              :to="`/stats/${ev.id}`"
              size="xs"
              variant="ghost"
              icon="i-lucide-arrow-right"
            />
          </td>
        </tr>
        <tr v-if="!events.length">
          <td
            colspan="7"
            class="py-6 text-center text-gray-600 dark:text-gray-400"
          >
            Немає подій
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
