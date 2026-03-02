<script setup lang="ts">
import { qrScanner, miniApp } from "@tma.js/sdk-vue";

const scannedCode = ref<string | null>(null);
const isScanning = ref(false);
const error = ref<string | null>(null);

async function openScanner() {
  if (isScanning.value) return;

  isScanning.value = true;
  scannedCode.value = null;
  error.value = null;

  try {
    const result = await qrScanner.capture({
      text: "Наведіть камеру на QR код",
      capture: () => true,
    });

    if (result) {
      scannedCode.value = result;
    }
  } catch (e) {
    error.value =
      e instanceof Error ? e.message : "Невідома помилка сканування";
  } finally {
    isScanning.value = false;
  }
}

// Open scanner immediately on mount
onMounted(openScanner);
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-screen gap-6 p-4">
    <div v-if="scannedCode" class="w-full max-w-md space-y-4">
      <p class="text-sm text-annotation">Результат сканування:</p>
      <img
        v-if="scannedCode.startsWith('data:image')"
        :src="scannedCode"
        alt="Scanned QR code result"
        class="w-full h-auto object-contain"
      >
      <p v-else class="text-xl break-all font-mono text-foreground">
        {{ scannedCode }}
      </p>
      <div class="flex flex-row gap-4">
        <UButton
          block
          class="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white"
          @click="miniApp.close()"
        >
          Вийти
        </UButton>
        <UButton block @click="openScanner">Сканувати</UButton>
      </div>
    </div>

    <div v-else-if="error" class="w-full max-w-md space-y-4 text-center">
      <p class="text-red-500">{{ error }}</p>
      <UButton block @click="openScanner">Повторити спробу</UButton>
    </div>

    <div v-else class="text-center space-y-4">
      <p v-if="isScanning" class="text-annotation">Відкриваю камеру...</p>
      <UButton v-else block @click="openScanner">Сканувати QR код</UButton>
    </div>
  </div>
</template>
