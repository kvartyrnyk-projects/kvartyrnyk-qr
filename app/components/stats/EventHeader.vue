<script setup lang="ts">
import { retrieveLaunchParams } from "@tma.js/sdk";
import type { EventDetail } from "~/types/stats";

const { event, printSection } = defineProps<{
  event: EventDetail;
  printSection: HTMLElement | null;
}>();

const generating = defineModel<boolean>("generating", { default: false });

const userId = ref<number>();

onMounted(() => {
  const { tgWebAppData } = retrieveLaunchParams();
  userId.value = tgWebAppData?.user?.id;
});

const handlePrint = () => {
  printPage(event, printSection, userId.value, generating);
};
</script>

<template>
  <UCard class="w-full">
    <template #header>
      <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
          <h1 class="text-xl font-bold">{{ event.name }}</h1>
          <p
            v-if="event.location"
            class="text-sm text-gray-600 dark:text-gray-400"
          >
            📍 {{ event.location }}
          </p>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            📅 {{ new Date(event.startsAt).toLocaleString("uk-UA") }}
          </p>
        </div>
        <UButton
          label="Друк"
          icon="i-lucide-printer"
          variant="outline"
          size="sm"
          class="shrink-0"
          :class="{ hidden: generating }"
          @click="handlePrint"
        />
      </div>
    </template>

    <div class="grid grid-cols-4 gap-4 text-center">
      <div>
        <p class="text-2xl font-bold text-primary">
          {{ event.registrationsCount }}
        </p>
        <p class="text-xs text-gray-600 dark:text-gray-400">Зареєстровано</p>
      </div>
      <div>
        <p class="text-2xl font-bold">
          <span class="text-success">{{ event.checkedInCount }}</span
          ><span v-if="event.checkedInFriendsCount > 0" class="text-sky-400"
            >+{{ event.checkedInFriendsCount }}</span
          >
        </p>
        <p class="text-xs text-gray-600 dark:text-gray-400">Відвідали</p>
      </div>
      <div>
        <p class="text-2xl font-bold text-sky-400">{{ event.friendsCount }}</p>
        <p class="text-xs text-gray-600 dark:text-gray-400">Друзі</p>
      </div>
      <div>
        <p class="text-2xl font-bold">{{ event.maxSlots }}</p>
        <p class="text-xs text-gray-600 dark:text-gray-400">Місць</p>
      </div>
    </div>

    <!-- Slot usage bar -->
    <div class="mt-4">
      <div
        class="h-2 w-full rounded-full bg-gray-200 dark:bg-neutral-700 overflow-hidden flex"
      >
        <div
          class="h-2 bg-primary transition-all"
          :style="{
            width: `${Math.min(100, (event.registrationsCount / event.maxSlots) * 100)}%`,
          }"
        />
        <div
          v-if="event.friendsCount > 0"
          class="h-2 bg-sky-400 transition-all"
          :style="{
            width: `${Math.min(
              100 -
                Math.min(
                  100,
                  (event.registrationsCount / event.maxSlots) * 100,
                ),
              (event.friendsCount / event.maxSlots) * 100,
            )}%`,
          }"
        />
      </div>
      <p class="mt-1 text-right text-xs text-gray-600 dark:text-gray-400">
        {{ event.registrationsCount + event.friendsCount }} /
        {{ event.maxSlots }} місць
      </p>
    </div>
  </UCard>
</template>
