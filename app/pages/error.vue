<script setup lang="ts">
const route = useRoute();
const message = computed(() => route.query.message);

const { openScanner } = useScanner(validateQr, onQrError);
</script>

<template>
  <div class="flex flex-col justify-center items-center w-full h-svh max-w-md mx-auto gap-4">
    <h1 class="text-lg text-red-500">Помилка сканування</h1>
    <p v-if="message" class="text-xl wrap-break-word text-center text-annotation">
      {{ message }}
    </p>
    <ControlButtons @scanner="openScanner" />
  </div>
</template>
