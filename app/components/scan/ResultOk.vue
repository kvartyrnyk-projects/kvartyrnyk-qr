<script setup lang="ts">
import type { OKValidationResponse } from "~/types/validation";

const { data } =  defineProps<{ data: OKValidationResponse }>();

const fileUrl = computed(() => {
  if (!data.paymentFile) return null;
  const { fileId } = data.paymentFile;
  return `/api/file/${encodeURIComponent(fileId)}`;
});
</script>

<template>
  <div
    class="rounded-2xl border-2 border-green-500 bg-green-500/10 p-6 w-full space-y-3"
  >
    <div class="flex items-center gap-3">
      <div class="size-4 rounded-full bg-green-500 animate-pulse" />
      <span class="text-green-500 font-bold text-lg">Успішно</span>
    </div>
    <p class="text-2xl font-semibold text-foreground">{{ data.fullName }}</p>
    <div class="text-annotation space-y-1">
      <p v-if="data.event">📍 {{ data.event.name }}</p>
      <p v-if="data.event?.date">
        📅 {{ new Date(data.event.date).toLocaleDateString("uk-UA") }}
      </p>
      <p>👥 Друзі: {{ data.friendsCount }}</p>
      <p>🎟️ Відвідано подій: {{ data.visitedEvents }}</p>
    </div>
    <div v-if="fileUrl" class="pt-2">
      <NuxtLink
        :href="fileUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-annotation text-sm mb-1"
      >
        🧾 Чек оплати
    </NuxtLink>
    </div>
  </div>
</template>
