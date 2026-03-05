<script setup lang="ts">
import type { BannedResponse } from "~/types/validation";

defineProps<{ data: BannedResponse }>();
</script>

<template>
  <div
    class="rounded-2xl border-2 border-red-500 bg-red-500/10 p-6 w-full space-y-3"
  >
    <div class="flex items-center gap-3">
      <div class="size-4 rounded-full bg-red-500" />
      <span class="text-red-500 font-bold text-lg">Заблоковано</span>
    </div>
    <p class="text-2xl font-semibold text-foreground">{{ data.fullName }}</p>
    <div class="text-annotation space-y-1">
      <p>{{ data.message }}</p>
      <p>🎟️ Відвідано подій: {{ data.visitedEvents }}</p>
      <p>👥 Друзі: {{ data.friendsCount }}</p>
    </div>
  </div>
</template>
