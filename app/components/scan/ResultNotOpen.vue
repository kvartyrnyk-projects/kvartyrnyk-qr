<script setup lang="ts">
import type { NotOpenResponse } from "~/types/validation";

defineProps<{ data: NotOpenResponse }>();
</script>

<template>
  <div
    class="rounded-2xl border-2 border-yellow-500 bg-yellow-500/10 p-6 w-full space-y-3"
  >
    <div class="flex items-center gap-3">
      <div class="size-4 rounded-full bg-yellow-500" />
      <span class="text-yellow-500 font-bold text-lg">{{ data.message }}</span>
    </div>
    <p class="text-2xl font-semibold text-foreground">{{ data.event.name }}</p>
    <div class="text-annotation space-y-1">
      <p>
        📅 {{ new Date(data.event.date).toLocaleDateString("uk-UA") }}
      </p>
      <p v-if="data.event.status">📃 {{ data.event.status }}</p>
    </div>
  </div>
</template>
