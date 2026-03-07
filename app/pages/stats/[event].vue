<script setup lang="ts">
import type { StatsEventResponse } from "~/types/stats";

const printRef = ref<HTMLElement | null>(null);

const route = useRoute();
const eventId = computed(() => route.params.event as string);

const { data, status, error } = useClientFetch<StatsEventResponse>(
  () => `/api/stats/${eventId.value}`,
);
</script>

<template>
  <div ref="printRef" class="flex flex-col gap-6 p-4 w-full max-w-3xl mx-auto">
    <div
      class="print:hidden flex items-center gap-2"
      data-html2canvas-ignore="true"
    >
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
      class="text-muted text-sm"
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
      <StatsEventHeader :event="data.event" :print-section="printRef" />

      <div class="print:hidden" data-html2canvas-ignore="true">
        <h2 class="font-semibold mb-3">
          Відвідувачі ({{ data.visitors.length }})
        </h2>
        <StatsVisitorAccordion :visitors="data.visitors" />
      </div>

      <StatsPrintList :visitors="data.visitors" :event-name="data.event.name" />
    </template>
  </div>
</template>
