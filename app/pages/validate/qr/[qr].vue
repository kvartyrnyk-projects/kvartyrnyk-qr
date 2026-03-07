<script setup lang="ts">
import { useScanData } from "~/composables/scan";

const route = useRoute();
const qr = computed(() => route.params.qr as string);

const { data, error, status } = await useScanData(qr);
const scanResultComponent = computed(() => {
  switch (data.value?.status) {
    case "OK":
      return resolveComponent("ScanResultOk");
    case "ALREADY_SCANNED":
      return resolveComponent("ScanResultAlreadyScanned");
    case "NOT_OPEN":
      return resolveComponent("ScanResultNotOpen");
    case "BANNED":
      return resolveComponent("ScanResultBanned");
    case "NOT_FOUND":
      return resolveComponent("ScanResultNotFound");
    case "ERROR":
      return resolveComponent("ScanResultError");
    default:
      return null;
  }
});

const validateFn = (code: string) => validateQr(code);
const { openScanner } = useScanner(validateFn, (err) => onQrError(err));
</script>

<template>
  <div
    class="flex flex-col justify-center items-center w-full h-svh max-w-md mx-auto gap-4 p-4"
  >
    <h1 class="text-lg text-annotation">Результат сканування</h1>

    <div
      v-if="status === 'idle' || status === 'pending'"
      class="text-annotation"
    >
      Перевіряю QR-код...
    </div>
    <template v-else-if="data">
      <component :is="scanResultComponent" :data="data" />
    </template>
    <div
      v-else-if="error"
      class="rounded-2xl border-2 border-red-500 bg-red-500/10 p-6 w-full space-y-3"
    >
      <div class="flex items-center gap-3">
        <div class="size-4 rounded-full bg-red-500" />
        <span class="text-red-500 font-bold text-lg">Помилка</span>
      </div>
      <p class="text-lg text-foreground">{{ error.message }}</p>
    </div>

    <ControlButtons @scanner="openScanner" />
  </div>
</template>
