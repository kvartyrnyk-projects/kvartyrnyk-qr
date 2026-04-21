<script setup lang="ts">
const { isBartender, status: authStatus } = useAuth();
watch(authStatus, (s) => {
  if (s === "success" && !isBartender.value) navigateTo("/unauthenticated");
});

const router = useRouter();

const onScanned = (qr: string) => router.push(`/scan/${qr}`);
const onError = (err: string) => console.error("QR scan error:", err);
</script>

<template>
  <QrScanner @scanned="onScanned" @error="onError" />
</template>
