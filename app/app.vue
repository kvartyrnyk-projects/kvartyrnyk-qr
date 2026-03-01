<script setup lang="ts">
import { init } from "@tma.js/sdk-vue";

useMockTelegram();
onMounted(init);
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
