<script setup lang="ts">
import type { EventDetail } from "~/types/stats";
import html2pdf from "html2pdf.js";

const props = defineProps<{ event: EventDetail }>();

const printSection = ref<HTMLElement | null>(null);
const isGeneratingPDF = ref(false);

const printPage = async () => {
  if (!globalThis.window || !printSection.value) return;

  try {
    // 1. Hide the button
    isGeneratingPDF.value = true;
    
    // 2. Wait for Vue to update the DOM so the button is actually gone
    await nextTick(); 

    const options = {
      margin:       10,
      filename:     `Event_Stats_${props.event.name.replaceAll(/\s+/g, '_')}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    } as const;

    // 3. Generate the PDF (Wait for the promise to resolve)
    await html2pdf().set(options).from(printSection.value).save();
    
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    alert(`Failed to generate PDF: ${message}`);
  } finally {
    // 4. Bring the button back, no matter what happens
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
