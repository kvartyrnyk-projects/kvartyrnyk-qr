<script setup lang="ts">
import { retrieveRawInitData } from "@tma.js/sdk-vue";
import type { Product, CreateProductBody } from "~/types/receipt";

const { isBartender, status: authStatus } = useAuth();
watch(authStatus, (s) => {
  if (s === "success" && !isBartender.value) navigateTo("/unauthenticated");
});

const { data: products, refresh } = useClientFetch<Product[]>("/api/products");

const showForm = ref(false);
const saving = ref(false);
const deleteError = ref<string | null>(null);
const editingProduct = ref<Product | null>(null);

const form = reactive({
  name: "",
  unit: "",
  price: "",
  description: "",
  tags: "",
});

const resetForm = () => {
  form.name = "";
  form.unit = "";
  form.price = "";
  form.description = "";
  form.tags = "";
  editingProduct.value = null;
};

const openCreate = () => {
  resetForm();
  showForm.value = true;
};

const openEdit = (product: Product) => {
  editingProduct.value = product;
  form.name = product.name;
  form.unit = product.unit;
  form.price = (product.price / 100).toFixed(2);
  form.description = product.description ?? "";
  form.tags = product.tags.join(", ");
  showForm.value = true;
};

const getHeaders = () => ({ Authorization: retrieveRawInitData() });

const submit = async () => {
  saving.value = true;
  try {
    const body: CreateProductBody = {
      name: form.name.trim(),
      unit: form.unit.trim(),
      price: Math.round(parseFloat(form.price) * 100),
      description: form.description.trim() || null,
      tags: form.tags
        ? form.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
    };

    if (editingProduct.value) {
      await $fetch(`/api/products/${editingProduct.value.id}`, {
        method: "PUT",
        body,
        headers: getHeaders(),
      });
    } else {
      await $fetch("/api/products", {
        method: "POST",
        body,
        headers: getHeaders(),
      });
    }

    showForm.value = false;
    resetForm();
    await refresh();
  } finally {
    saving.value = false;
  }
};

const deleteProduct = async (id: number) => {
  if (!confirm("Видалити продукт?")) return;
  deleteError.value = null;
  try {
    await $fetch(`/api/products/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    await refresh();
  } catch (err) {
    deleteError.value = err?.data?.message ?? "Помилка видалення";
  }
};

const formatPrice = (cents: number) => `${(cents / 100).toFixed(2)} грн`;
</script>

<template>
  <div class="flex flex-col gap-6 p-4 w-full max-w-3xl mx-auto">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Інвентар</h1>
      <UButton @click="openCreate">Додати продукт</UButton>
    </div>

    <div
      v-if="deleteError"
      class="rounded-xl border border-error bg-error/10 p-4 text-sm text-error"
    >
      {{ deleteError }}
    </div>

    <UCard v-if="showForm">
      <template #header>
        <h2 class="font-semibold">
          {{ editingProduct ? "Редагувати продукт" : "Новий продукт" }}
        </h2>
      </template>
      <div class="flex flex-col gap-4">
        <input
          v-model="form.name"
          placeholder="Назва *"
          class="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
        />
        <input
          v-model="form.unit"
          placeholder="Одиниця (шт, мл, порція) *"
          class="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
        />
        <input
          v-model="form.price"
          type="number"
          min="0"
          step="0.01"
          placeholder="Ціна у гривнях *"
          class="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
        />
        <input
          v-model="form.description"
          placeholder="Опис (необов'язково)"
          class="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
        />
        <input
          v-model="form.tags"
          placeholder="Теги через кому (необов'язково)"
          class="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
        />
        <div class="flex gap-2 justify-end">
          <UButton
            variant="ghost"
            @click="
              showForm = false;
              resetForm();
            "
          >
            Скасувати
          </UButton>
          <UButton :loading="saving" @click="submit">Зберегти</UButton>
        </div>
      </div>
    </UCard>

    <div
      v-if="authStatus === 'idle' || authStatus === 'pending'"
      class="text-annotation text-sm"
    >
      Завантаження...
    </div>
    <template v-else-if="products">
      <p v-if="products.length === 0" class="text-annotation text-sm">
        Продуктів ще немає. Додайте перший!
      </p>
      <UCard v-for="product in products" :key="product.id">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="font-semibold">{{ product.name }}</p>
            <p class="text-sm text-annotation">
              {{ formatPrice(product.price) }} / {{ product.unit }}
            </p>
            <p v-if="product.description" class="text-sm text-annotation mt-1">
              {{ product.description }}
            </p>
            <p v-if="product.tags.length" class="text-xs text-annotation mt-1">
              {{ product.tags.join(", ") }}
            </p>
          </div>
          <div class="flex gap-2 shrink-0">
            <UButton size="sm" variant="ghost" @click="openEdit(product)">
              Ред.
            </UButton>
            <UButton
              size="sm"
              color="error"
              variant="ghost"
              @click="deleteProduct(product.id)"
            >
              Вид.
            </UButton>
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>
