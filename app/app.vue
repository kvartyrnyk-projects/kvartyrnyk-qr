<script setup lang="ts">
import { init } from "@tma.js/sdk-vue";

const route = useRoute();

useMockTelegram();
useOriginCheck(route.path);
onMounted(init);
</script>

<template>
  <NuxtRouteAnnouncer />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
