<script setup lang="ts">
import type { VisitorRow } from "~/types/stats";

defineProps<{
  visitors: VisitorRow[];
  eventName: string;
  isGeneratingPdf?: boolean;
}>();
</script>

<template>
  <div :class="['w-full text-green-500', { hidden: !isGeneratingPdf }]">
    <h2 class="text-lg font-bold mb-4">
      {{ eventName }} — Список відвідувачів
    </h2>
    <ol class="space-y-6">
      <li
        v-for="(v, i) in visitors"
        :key="v.registrationId"
        class="border-b border-neutral-300 dark:border-neutral-600 pb-4 last:border-0"
      >
        <div class="flex items-start justify-between gap-2">
          <div>
            <span class="font-semibold"
              >{{ i + 1 }}.
              {{
                v.fullName ??
                (v.username ? `@${v.username}` : `#${v.registrationId}`)
              }}</span
            ><span
              v-if="v.friendsCount > 0"
              class="font-semibold text-sky-400 ml-1"
              >+{{ v.friendsCount }}</span
            >
            <span
              v-if="v.username"
              class="ml-2 text-sm text-black dark:text-neutral-400"
              >@{{ v.username }}</span
            >
          </div>
          <span class="text-sm">{{ v.checkedInAt ? "✓" : "–" }}</span>
        </div>

        <!-- Friends -->
        <ul
          v-if="v.friends.length"
          class="mt-1 ml-4 text-sm text-black dark:text-neutral-500 list-disc list-inside"
        >
          <li v-for="(f, fi) in v.friends" :key="fi">
            {{ f.name
            }}<span v-if="f.username" class="ml-1 opacity-60"
              >@{{ f.username }}</span
            >
          </li>
        </ul>

        <!-- Payment receipt for print -->
        <div v-if="v.payment?.fileId" class="mt-2">
          <ViewerPaymentReceipt
            :file-id="v.payment.fileId"
            :mimetype="v.payment.mimetype"
          />
        </div>
      </li>
    </ol>
  </div>
</template>
