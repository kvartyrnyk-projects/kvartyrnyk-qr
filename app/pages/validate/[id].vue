<script setup lang="ts">
import { onError, validate, uuidRegex } from "~/utils/redirects";

// Get the scanned code from route parameters
const route = useRoute();
const scannedCode = computed(() => route.params.id as string | null);

if (!scannedCode.value || !uuidRegex.test(scannedCode.value)) {
  onError("Невірний QR код. Спробуйте ще раз.");
}

const { openScanner } = useScanner(validate, onError);
</script>

<template>
  <div class="w-full max-w-md space-y-4">
    <h1 class="text-lg text-annotation">Результат сканування</h1>
    <p class="text-xl break-all text-foreground">
      {{ scannedCode }}
    </p>
    <ControlButtons @scanner="openScanner" />
  </div>
</template>
