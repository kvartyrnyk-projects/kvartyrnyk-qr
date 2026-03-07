<script setup lang="ts">
const { fileId, mimetype } = defineProps<{
  fileId: MaybeRef<string | null>;
  mimetype: MaybeRef<string | null>;
}>();

const isImage = (mime: MaybeRef<string | null>) =>
  !!unref(mime)?.startsWith("image/");
const isPdf = (mime: MaybeRef<string | null>) =>
  unref(mime) === "application/pdf";

const fileUrl = computed(() => {
  const id = unref(fileId);
  return id ? `/api/file/${encodeURIComponent(id)}` : null;
});
</script>

<template>
  <ClientOnly v-if="fileUrl && mimetype">
    <img
      v-if="isImage(mimetype)"
      :src="fileUrl"
      alt="Чек оплати"
      class="mt-2 max-h-256 max-w-full w-auto rounded-xl border border-default object-contain"
    >
    <ViewerPdf v-else-if="isPdf(mimetype)" :url="fileUrl" />
    <NuxtLink
      v-else
      :href="fileUrl"
      target="_blank"
      class="mt-2 text-sm text-primary underline"
    >
      Відкрити файл
    </NuxtLink>
    <template #fallback>
      <p class="mt-2 text-sm text-muted text-center">Завантаження чека...</p>
    </template>
  </ClientOnly>
  <p v-else class="mt-2 text-sm text-muted text-center">Файл чеку не знайдено</p>
</template>
