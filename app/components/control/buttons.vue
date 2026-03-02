<script setup lang="ts">
import { miniApp } from "@tma.js/sdk-vue";

const emit = defineEmits<{
  scanner: [];
}>();
</script>

<template>
  <div class="flex flex-row gap-4">
    <UButton
      block
      class="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white"
      @click="miniApp.close()"
    >
      Вийти
    </UButton>
    <UButton block @click="emit('scanner')">Сканувати</UButton>
  </div>
</template>
