<script setup lang="ts">
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

// Required by PDF.js itself to set the worker source
GlobalWorkerOptions.workerSrc = workerUrl;

const props = defineProps<{
  url: MaybeRef<string | null>;
}>();

const renderPdf = async (url: string, canvas: HTMLCanvasElement) => {
  const { href } = new URL(url, globalThis.location.href);

  const pdf = await getDocument({ url: href }).promise;
  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 1.5 });

  canvas.height = viewport.height;
  canvas.width = viewport.width;

  await page.render({ canvas, viewport }).promise;
};

const pdfCanvas = ref<HTMLCanvasElement | null>(null);
watchEffect(() => {
  const url = unref(props.url);
  if (!url || !pdfCanvas.value) return;
  renderPdf(url, pdfCanvas.value).catch((err) => {
    alert(`Помилка при завантаженні PDF: ${err.message}`);
  });
});
</script>

<template>
  <canvas ref="pdfCanvas" class="w-full rounded-xl border mt-2" />
</template>
