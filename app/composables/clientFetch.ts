import { retrieveRawInitData } from "@tma.js/sdk-vue";

type UseFetchOptions<T> = Parameters<typeof useFetch<T>>[1];

/**
 * Client-only fetch with automatic Telegram initData authorization.
 * Delays execution until onMounted so the Authorization header is always set.
 */
export const useClientFetch = <T>(
  url: string | (() => string),
  options?: Omit<UseFetchOptions<T>, "server" | "headers" | "immediate">,
) => {
  const initData = ref<string>();
  const headers = computed(() =>
    initData.value ? { Authorization: initData.value } : undefined,
  );

  const result = useFetch<T>(url, {
    ...options,
    server: false,
    immediate: false,
    headers,
  });

  onMounted(() => {
    initData.value = retrieveRawInitData();
    result.execute();
  });

  return result;
};
