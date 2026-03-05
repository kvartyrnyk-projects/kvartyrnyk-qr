<script setup lang="ts">
import type { NotFoundResponse } from "~/types/validation";

defineProps<{ data: NotFoundResponse }>();
</script>

<template>
  <div
    class="rounded-2xl border-2 border-red-500 bg-red-500/10 p-6 w-full space-y-3"
  >
    <div class="flex items-center gap-3">
      <div class="size-4 rounded-full bg-red-500" />
      <span class="text-red-500 font-bold text-lg">Не знайдено</span>
    </div>
    <p class="text-lg text-foreground">{{ data.message }}</p>
  </div>
</template>
