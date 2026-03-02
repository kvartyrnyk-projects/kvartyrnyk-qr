import { isTMA } from "@tma.js/sdk-vue";

/**
 * Checks if the app is running inside Telegram Mini Apps. If not, it redirects to the 404 page.
 *
 * This is a REQUIREMENT for production, as the Telegram Web App API
 * is only available when the app is ran inside Telegram.
 *
 * @param currentRoute - The current route path, used to prevent redirect loop when already on 404 page.
 */
export const useOriginCheck = (currentRoute: string) => {
  if (currentRoute === "/unauthenticated") {
    return;
  }

  onMounted(async () => {
    const isTelegramMiniApps = await isTMA("complete");
    if (!isTelegramMiniApps) {
      return navigateTo("/unauthenticated");
    }
  });
};
