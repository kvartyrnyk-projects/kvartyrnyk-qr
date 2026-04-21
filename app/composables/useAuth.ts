import type { MeResponse } from "~/types/stats";

export const useAuth = () => {
  const { data, status, error } = useClientFetch<MeResponse>("/api/me");

  const role = computed(() => data.value?.role ?? null);

  const isBartender = computed(
    () => role.value === "BARTENDER" || role.value === "SUDO",
  );

  const isAdmin = computed(
    () => role.value === "ADMIN" || role.value === "SUDO",
  );

  return { role, isBartender, isAdmin, status, error };
};
