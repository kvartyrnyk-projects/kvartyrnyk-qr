<script setup lang="ts">
import { init } from "@tma.js/sdk-vue";

if (import.meta.client) {
  init();
}

useHead({
  title: "Сканер QR-кодів для Квартирника",
  meta: [
    { name: "description", content: "Скануйте QR код для перевірки статусу" },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
  ],
});

const route = useRoute();

useMockTelegram();
useOriginCheck(route.path);
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
