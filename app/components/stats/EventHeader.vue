<script setup lang="ts">
import { initData } from "@tma.js/sdk-vue";
import type { EventDetail } from "~/types/stats";

const { event, printSection } = defineProps<{ 
  event: EventDetail
  printSection: HTMLElement | null
}>();

const isGeneratingPDF = ref(false);

const printPage = async () => {
  if (!globalThis.window || !printSection) return;

  // Grab the Telegram WebApp instance
  
  const chatId = initData.user()?.id;
  if (!chatId) {
    alert("Помилка: Не вдалося знайти ID користувача Telegram.");
    return;
  }

  try {
    isGeneratingPDF.value = true;
    await nextTick(); 
    await new Promise(resolve => setTimeout(resolve, 150)); // Give fonts a beat to render

    // Robust dynamic imports to avoid SSR issues
    const [{ toPng }, { jsPDF }] = await Promise.all([
      import('html-to-image'),
      import('jspdf')
    ]);

    const dataUrl = await toPng(printSection, {
      quality: 1,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const imgProps = pdf.getImageProperties(dataUrl);
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);

    // 1. Export the PDF as a Base64 Data URL instead of a Blob
    const pdfBase64 = pdf.output('datauristring');
    const filename = `Event_Stats_${event.name.replaceAll(/\s+/g, '_')}.pdf`;

    // 2. Send it to our Nuxt backend
    await $fetch('/api/file/send-pdf', {
      method: 'POST',
      body: {
        chatId,
        filename,
        pdfBase64
      }
    });

    // 3. Give the user satisfying native feedback
    alert("✅ PDF успішно надіслано у ваш чат!");
    
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    alert(`❌ Помилка: ${message}`);
  } finally {
    isGeneratingPDF.value = false; 
  }
};
</script>

<template>
  <UCard class="w-full">
    <template #header>
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
          <h1 class="text-xl font-bold">{{ event.name }}</h1>
          <p v-if="event.location" class="text-sm text-muted">
            📍 {{ event.location }}
          </p>
          <p class="text-sm text-muted">
            📅 {{ new Date(event.startsAt).toLocaleString("uk-UA") }}
          </p>
        </div>
        <UButton
          label="Друк"
          icon="i-lucide-printer"
          variant="outline"
          size="sm"
          class="print:hidden shrink-0"
          :class="{ 'hidden': isGeneratingPDF }"
          data-html2canvas-ignore="true"
          @click="printPage"
        />
      </div>
    </template>

    <div class="grid grid-cols-3 gap-4 text-center">
      <div>
        <p class="text-2xl font-bold text-primary">
          {{ event.registrationsCount }}
        </p>
        <p class="text-xs text-muted">Зареєстровано</p>
      </div>
      <div>
        <p class="text-2xl font-bold text-success">
          {{ event.checkedInCount }}
        </p>
        <p class="text-xs text-muted">Відвідали</p>
      </div>
      <div>
        <p class="text-2xl font-bold">{{ event.maxSlots }}</p>
        <p class="text-xs text-muted">Місць</p>
      </div>
    </div>

    <!-- Slot usage bar -->
    <div class="mt-4">
      <div class="h-2 w-full rounded-full bg-default overflow-hidden">
        <div
          class="h-2 rounded-full bg-primary transition-all"
          :style="{
            width: `${Math.min(100, (event.registrationsCount / event.maxSlots) * 100)}%`,
          }"
        />
      </div>
      <p class="mt-1 text-right text-xs text-muted">
        {{ event.registrationsCount }} / {{ event.maxSlots }} місць
      </p>
    </div>
  </UCard>
</template>
