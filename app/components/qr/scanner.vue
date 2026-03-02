<script setup lang="ts">
const emit = defineEmits<{
  scanned: [code: string];
  error: [error: string];
}>();

const { isScanning, openScanner } = useScanner(
    (code) => emit("scanned", code),
    (error) => emit("error", error)
)

// Open scanner immediately on mount
onMounted(openScanner);
</script>

<template>
  <div class="flex flex-col items-center justify-center min-h-screen gap-6 p-4">
    <div class="text-center space-y-4">
      <p v-if="isScanning" class="text-annotation">Відкриваю камеру...</p>
      <UButton v-else block @click="openScanner">Сканувати QR код</UButton>
    </div>
  </div>
</template>
