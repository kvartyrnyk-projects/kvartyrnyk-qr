<script setup lang="ts">
import type { AlreadyScannedResponse } from "~/types/validation";

defineProps<{ data: AlreadyScannedResponse }>();
</script>

<template>
  <div
    class="rounded-2xl border-2 border-purple-500 bg-purple-500/10 p-6 w-full space-y-3"
  >
    <div class="flex items-center gap-3">
      <div class="size-4 rounded-full bg-purple-500" />
      <span class="text-purple-500 font-bold text-lg">Вже скановано</span>
    </div>
    <p class="text-2xl font-semibold text-foreground">{{ data.fullName }}</p>
    <div class="text-annotation space-y-1">
      <p>
        ⏰ Скановано: {{ new Date(data.scannedAt).toLocaleString("uk-UA") }}
      </p>
      <p>👥 Друзі: {{ data.friendsCount }}</p>
      <p v-if="data.event">📍 {{ data.event.name }}</p>
      <p v-if="data.event?.date">
        📅 {{ new Date(data.event.date).toLocaleDateString("uk-UA") }}
      </p>
      <p>🎟️ Відвідано подій: {{ data.visitedEvents }}</p>
    </div>
  </div>
</template>
