<script setup lang="ts">
defineProps<{
  totalEvents: number;
  totalRegistrations: number;
  totalCheckedIn: number;
}>();
</script>

<template>
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
    <UCard>
      <div class="flex flex-col items-center gap-1 py-2 text-center">
        <span class="text-3xl font-bold text-primary">{{ totalEvents }}</span>
        <span class="text-sm text-muted">Подій</span>
      </div>
    </UCard>
    <UCard>
      <div class="flex flex-col items-center gap-1 py-2 text-center">
        <span class="text-3xl font-bold text-primary">{{
          totalRegistrations
        }}</span>
        <span class="text-sm text-muted">Реєстрацій</span>
      </div>
    </UCard>
    <UCard>
      <div class="flex flex-col items-center gap-1 py-2 text-center">
        <span class="text-3xl font-bold text-success">{{
          totalCheckedIn
        }}</span>
        <span class="text-sm text-muted">Відвідали</span>
      </div>
    </UCard>
  </div>
</template>
