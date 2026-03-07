<script setup lang="ts">
import type { StatsEventResponse } from "~/types/stats";

const printRef = ref<HTMLElement | null>(null);
const isGeneratingPdf = ref(false);

const route = useRoute();
const eventId = computed(() => route.params.event as string);

const { data, status, error } = useClientFetch<StatsEventResponse>(
  () => `/api/stats/${eventId.value}`,
);
</script>

<template>
  <div ref="printRef" class="flex flex-col gap-6 p-4 w-full max-w-3xl mx-auto">
    <div :class="{ hidden: isGeneratingPdf }" class="flex items-center gap-2">
      <UButton
        to="/stats"
        icon="i-lucide-arrow-left"
        variant="ghost"
        size="sm"
        label="Назад"
      />
    </div>

    <div
      v-if="status === 'idle' || status === 'pending'"
      class="text-gray-600 dark:text-gray-400 text-sm"
    >
      Завантаження...
    </div>

    <div
      v-else-if="error"
      class="rounded-xl border border-error bg-error/10 p-4 text-sm text-error"
    >
      {{ error.message }}
    </div>

    <template v-else-if="data">
      <StatsEventHeader
        v-model:generating="isGeneratingPdf"
        :event="data.event"
        :print-section="printRef"
      />

      <div :class="{ hidden: isGeneratingPdf }">
        <h2 class="font-semibold mb-3">
          Відвідувачі ({{ data.visitors.length }})
        </h2>
        <StatsVisitorAccordion :visitors="data.visitors" />
      </div>

      <StatsPrintList
        :visitors="data.visitors"
        :event-name="data.event.name"
        :is-generating-pdf="isGeneratingPdf"
      />
    </template>
  </div>
</template>
