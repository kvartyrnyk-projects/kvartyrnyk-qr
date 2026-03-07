<script setup lang="ts">
import type { StatsIndexResponse } from "~/types/stats";

const { data, status, error } =
  useClientFetch<StatsIndexResponse>("/api/stats");
</script>

<template>
  <div class="flex flex-col gap-6 p-4 w-full max-w-3xl mx-auto">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Статистика</h1>
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
      <StatsSummaryCards
        :total-events="data.totalEvents"
        :total-registrations="data.totalRegistrations"
        :total-checked-in="data.totalCheckedIn"
      />

      <UCard>
        <template #header>
          <h2 class="font-semibold">Події</h2>
        </template>
        <StatsEventsTable :events="data.events" />
      </UCard>
    </template>
  </div>
</template>
