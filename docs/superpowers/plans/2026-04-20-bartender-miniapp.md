# Bartender Mini-App Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bartender order flow (QR scan → receipt edit → payment) and inventory (product CRUD) to the Nuxt mini-app.

**Architecture:** New Nitro API routes handle receipt and product data using raw SQL (postgres driver). Two new page groups are added: `/scan/[qr]` for the order/payment flow and `/inventory` for product CRUD. A `useAuth` composable gates both areas to `BARTENDER | SUDO` roles. No test framework exists in the project — each task ends with a manual verification step instead of automated tests.

**Tech Stack:** Nuxt 4, Vue 3, @nuxt/ui v4, postgres driver, @tma.js/sdk-vue, raw SQL

---

## File Map

**New server files:**

- `server/utils/telegram.ts` — sendTelegramMessage helper
- `server/utils/payment-link.ts` — generatePaymentLink stub
- `server/api/products/index.get.ts` — list all products
- `server/api/products/index.post.ts` — create product
- `server/api/products/[id].put.ts` — update product
- `server/api/products/[id].delete.ts` — delete product
- `server/api/receipt/upsert-for/[qr].post.ts` — find or create UNPAID receipt by QR
- `server/api/receipt/[id]/entries.put.ts` — replace all entries + recalculate total
- `server/api/receipt/[id]/request-payment.post.ts` — send DM + set AWAITING_PAYMENT
- `server/api/receipt/[id]/confirm-payment.post.ts` — set CONFIRMED + PAID
- `server/api/receipt/[id]/reject-payment.post.ts` — set FAILED + UNPAID + resend DM

**Modified server files:**

- `server/middleware/auth.ts` — add `SUDO` to allowed roles

**New app files:**

- `app/types/receipt.ts` — Product, ReceiptEntry, ReceiptResponse types
- `app/composables/useAuth.ts` — fetch /api/me, expose isBartender, guard pages
- `app/pages/inventory/index.vue` — product CRUD page
- `app/pages/scan/index.vue` — QR scanner entry for bartenders
- `app/pages/scan/[qr].vue` — receipt order/payment page

---

### Task 1: TypeScript types

**Files:**

- Create: `app/types/receipt.ts`

- [ ] **Step 1: Create types file**

```typescript
// app/types/receipt.ts

export interface Product {
  id: number;
  name: string;
  description: string | null;
  unit: string;
  price: number; // cents
  tags: string[];
}

export interface ReceiptEntryDetail {
  productId: number;
  productName: string;
  unit: string;
  unitPrice: number; // cents
  unitCount: number;
  subtotal: number; // cents
}

export interface ReceiptResponse {
  id: number;
  status: "UNPAID" | "AWAITING_PAYMENT" | "PAID";
  total: number; // cents
  guestName: string;
  entries: ReceiptEntryDetail[];
  paymentFileId: string | null;
  paymentMimetype: string | null;
}

export interface UpdateEntriesBody {
  entries: { product_id: number; unit_count: number }[];
}

export interface CreateProductBody {
  name: string;
  unit: string;
  price: number; // cents
  description?: string | null;
  tags?: string[];
}
```

- [ ] **Step 2: Verify — run `bun run build` and confirm no type errors**

```bash
cd /mnt/shared/dev/kvartyrnyk-qr && bun run build 2>&1 | head -30
```

Expected: build completes or fails only on unrelated issues (types file alone adds no errors).

- [ ] **Step 3: Commit**

```bash
git add app/types/receipt.ts
git commit -m "feat(types): add receipt and product types"
```

---

### Task 2: Server utilities (Telegram messaging + payment link)

**Files:**

- Create: `server/utils/telegram.ts`
- Create: `server/utils/payment-link.ts`

- [ ] **Step 1: Create Telegram message utility**

```typescript
// server/utils/telegram.ts
import { botToken } from "./constants";

export async function sendTelegramMessage(
  chatId: bigint | number,
  text: string,
): Promise<void> {
  const res = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId.toString(), text }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error: ${body}`);
  }
}
```

- [ ] **Step 2: Create payment link stub**

```typescript
// server/utils/payment-link.ts
export function generatePaymentLink(amountcents: number): string {
  // TODO: integrate real payment processor (LiqPay / Monobank)
  return `https://pay.example.com/?amount=${amountcents}`;
}
```

- [ ] **Step 3: Commit**

```bash
git add server/utils/telegram.ts server/utils/payment-link.ts
git commit -m "feat(server): add Telegram message helper and payment link stub"
```

---

### Task 3: Update auth middleware to allow SUDO role

**Files:**

- Modify: `server/middleware/auth.ts`

- [ ] **Step 1: Add SUDO to the allowed roles list and update dev mock**

In `server/middleware/auth.ts`, make two changes:

Change the allowed roles check from:

```typescript
if (!dbUser || !["ADMIN", "BARTENDER"].includes(dbUser.role)) {
  throw createError({ statusCode: 403, message: "Доступ заборонено" });
}
```

to:

```typescript
if (!dbUser || !["ADMIN", "BARTENDER", "SUDO"].includes(dbUser.role)) {
  throw createError({ statusCode: 403, message: "Доступ заборонено" });
}
```

Also change the dev mock role from `"ADMIN"` to `"SUDO"` so that bartender/receipt/product endpoints (which require `BARTENDER | SUDO`) work in development:

```typescript
  // inside the `if (import.meta.dev)` block:
  dbUser: { id: 1, telegram_id: 1, role: "SUDO", full_name: "Dev User" },
```

- [ ] **Step 2: Verify — start dev server, hit /api/me with a SUDO user in DB**

In dev mode the mock user is ADMIN so auth always passes. After deploy, test with a real SUDO user. For now confirm the build still compiles:

```bash
bun run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add server/middleware/auth.ts
git commit -m "feat(auth): allow SUDO role through middleware"
```

---

### Task 4: Products API — GET list and POST create

**Files:**

- Create: `server/api/products/index.get.ts`
- Create: `server/api/products/index.post.ts`

- [ ] **Step 1: Create GET /api/products**

```typescript
// server/api/products/index.get.ts
import { sql } from "~~/server/utils/db";
import type { Product } from "~/types/receipt";

export default defineEventHandler(async (event): Promise<Product[]> => {
  const dbUser = event.context.auth?.dbUser;
  if (!dbUser || !["BARTENDER", "SUDO"].includes(dbUser.role)) {
    throw createError({ statusCode: 403, message: "Доступ заборонено" });
  }

  const rows = await sql<
    {
      id: number;
      name: string;
      description: string | null;
      unit: string;
      price: number;
      tags: string[];
    }[]
  >`
    SELECT id, name, description, unit, price, tags
    FROM products
    ORDER BY name ASC
  `;

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    unit: r.unit,
    price: Number(r.price),
    tags: r.tags ?? [],
  }));
});
```

- [ ] **Step 2: Create POST /api/products**

```typescript
// server/api/products/index.post.ts
import { sql } from "~~/server/utils/db";
import type { Product, CreateProductBody } from "~/types/receipt";

export default defineEventHandler(async (event): Promise<Product> => {
  const dbUser = event.context.auth?.dbUser;
  if (!dbUser || !["BARTENDER", "SUDO"].includes(dbUser.role)) {
    throw createError({ statusCode: 403, message: "Доступ заборонено" });
  }

  const body = await readBody<CreateProductBody>(event);

  if (!body.name?.trim()) {
    throw createError({ statusCode: 400, message: "Назва обов'язкова" });
  }
  if (!body.unit?.trim()) {
    throw createError({
      statusCode: 400,
      message: "Одиниця вимірювання обов'язкова",
    });
  }
  if (!Number.isFinite(body.price) || body.price < 0) {
    throw createError({ statusCode: 400, message: "Невірна ціна" });
  }

  const tags = body.tags ?? [];
  const [row] = await sql<
    {
      id: number;
      name: string;
      description: string | null;
      unit: string;
      price: number;
      tags: string[];
    }[]
  >`
    INSERT INTO products (name, description, unit, price, tags)
    VALUES (
      ${body.name.trim()},
      ${body.description?.trim() ?? null},
      ${body.unit.trim()},
      ${body.price},
      ${sql.array(tags)}
    )
    RETURNING id, name, description, unit, price, tags
  `;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    unit: row.unit,
    price: Number(row.price),
    tags: row.tags ?? [],
  };
});
```

- [ ] **Step 3: Verify — with dev server running, GET /api/products should return empty array**

```bash
curl -s http://localhost:3000/api/products | head -20
```

Expected: `[]` (empty array, no auth error in dev mode).

- [ ] **Step 4: Commit**

```bash
git add server/api/products/index.get.ts server/api/products/index.post.ts
git commit -m "feat(api): add products GET and POST endpoints"
```

---

### Task 5: Products API — PUT update and DELETE

**Files:**

- Create: `server/api/products/[id].put.ts`
- Create: `server/api/products/[id].delete.ts`

- [ ] **Step 1: Create PUT /api/products/:id**

```typescript
// server/api/products/[id].put.ts
import { sql } from "~~/server/utils/db";
import type { Product, CreateProductBody } from "~/types/receipt";

export default defineEventHandler(async (event): Promise<Product> => {
  const dbUser = event.context.auth?.dbUser;
  if (!dbUser || !["BARTENDER", "SUDO"].includes(dbUser.role)) {
    throw createError({ statusCode: 403, message: "Доступ заборонено" });
  }

  const id = Number(event.context.params?.id);
  if (!Number.isInteger(id) || id < 1) {
    throw createError({ statusCode: 400, message: "Невірний ID" });
  }

  const body = await readBody<CreateProductBody>(event);

  if (!body.name?.trim()) {
    throw createError({ statusCode: 400, message: "Назва обов'язкова" });
  }
  if (!body.unit?.trim()) {
    throw createError({
      statusCode: 400,
      message: "Одиниця вимірювання обов'язкова",
    });
  }
  if (!Number.isFinite(body.price) || body.price < 0) {
    throw createError({ statusCode: 400, message: "Невірна ціна" });
  }

  const tags = body.tags ?? [];
  const [row] = await sql<
    {
      id: number;
      name: string;
      description: string | null;
      unit: string;
      price: number;
      tags: string[];
    }[]
  >`
    UPDATE products
    SET
      name        = ${body.name.trim()},
      description = ${body.description?.trim() ?? null},
      unit        = ${body.unit.trim()},
      price       = ${body.price},
      tags        = ${sql.array(tags)},
      updated_at  = now()
    WHERE id = ${id}
    RETURNING id, name, description, unit, price, tags
  `;

  if (!row) {
    throw createError({ statusCode: 404, message: "Продукт не знайдено" });
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    unit: row.unit,
    price: Number(row.price),
    tags: row.tags ?? [],
  };
});
```

- [ ] **Step 2: Create DELETE /api/products/:id**

```typescript
// server/api/products/[id].delete.ts
import { sql } from "~~/server/utils/db";

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  const dbUser = event.context.auth?.dbUser;
  if (!dbUser || !["BARTENDER", "SUDO"].includes(dbUser.role)) {
    throw createError({ statusCode: 403, message: "Доступ заборонено" });
  }

  const id = Number(event.context.params?.id);
  if (!Number.isInteger(id) || id < 1) {
    throw createError({ statusCode: 400, message: "Невірний ID" });
  }

  try {
    const [row] = await sql<{ id: number }[]>`
      DELETE FROM products WHERE id = ${id} RETURNING id
    `;
    if (!row) {
      throw createError({ statusCode: 404, message: "Продукт не знайдено" });
    }
  } catch (err) {
    // Postgres FK restrict violation code: 23503
    if (err?.code === "23503") {
      throw createError({
        statusCode: 409,
        message: "Cannot delete: product is used in existing receipts",
      });
    }
    throw err;
  }

  return { ok: true };
});
```

- [ ] **Step 3: Verify — POST a product then DELETE it returns `{ok:true}`, DELETE non-existent returns 404**

```bash
# Start dev server first: bun run dev
# Create a product
curl -s -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","unit":"шт","price":5000}' | python3 -m json.tool

# Delete it (replace 1 with returned id)
curl -s -X DELETE http://localhost:3000/api/products/1 | python3 -m json.tool

# Delete non-existent
curl -s -X DELETE http://localhost:3000/api/products/99999 -o /dev/null -w "%{http_code}"
# Expected: 404
```

- [ ] **Step 4: Commit**

```bash
git add server/api/products/[id].put.ts server/api/products/[id].delete.ts
git commit -m "feat(api): add products PUT and DELETE endpoints"
```

---

### Task 6: Receipt upsert-for endpoint

**Files:**

- Create: `server/api/receipt/upsert-for/[qr].post.ts`

This route finds the guest's registration by QR token for the current ONGOING event, returns the existing UNPAID or AWAITING_PAYMENT receipt (or creates a fresh UNPAID one), with all entries and payment file info.

- [ ] **Step 1: Create helper to fetch full receipt by ID**

This SQL is reused by several endpoints. Write it inline in this file (it will be copy-pasted into later tasks since they are independent).

- [ ] **Step 2: Create the route file**

```typescript
// server/api/receipt/upsert-for/[qr].post.ts
import { sql } from "~~/server/utils/db";
import { uuidRegex } from "~/utils/redirects";
import type { ReceiptResponse } from "~/types/receipt";

async function fetchReceipt(receiptId: number): Promise<ReceiptResponse> {
  const [receipt] = await sql<
    {
      id: number;
      status: string;
      total: number;
      payment_id: number | null;
      full_name: string;
      payment_file_id: string | null;
      payment_mimetype: string | null;
    }[]
  >`
    SELECT
      r.id,
      r.status,
      r.total,
      r.payment_id,
      u.full_name,
      pay.file_id  AS payment_file_id,
      pay.mimetype AS payment_mimetype
    FROM receipts r
    JOIN registrations reg ON r.registration_id = reg.id
    JOIN users u ON reg.user_id = u.id
    LEFT JOIN payments pay ON r.payment_id = pay.id
    WHERE r.id = ${receiptId}
  `;

  const entries = await sql<
    {
      product_id: number;
      product_name: string;
      unit: string;
      unit_price: number;
      unit_count: number;
      subtotal: number;
    }[]
  >`
    SELECT
      re.product_id,
      p.name  AS product_name,
      p.unit,
      p.price AS unit_price,
      re.unit_count,
      re.subtotal
    FROM receipt_entries re
    JOIN products p ON re.product_id = p.id
    WHERE re.receipt_id = ${receiptId}
  `;

  return {
    id: receipt.id,
    status: receipt.status as ReceiptResponse["status"],
    total: Number(receipt.total),
    guestName: receipt.full_name,
    paymentFileId: receipt.payment_file_id,
    paymentMimetype: receipt.payment_mimetype,
    entries: entries.map((e) => ({
      productId: e.product_id,
      productName: e.product_name,
      unit: e.unit,
      unitPrice: Number(e.unit_price),
      unitCount: e.unit_count,
      subtotal: Number(e.subtotal),
    })),
  };
}

export default defineEventHandler(async (event): Promise<ReceiptResponse> => {
  const dbUser = event.context.auth?.dbUser;
  if (!dbUser || !["BARTENDER", "SUDO"].includes(dbUser.role)) {
    throw createError({ statusCode: 403, message: "Доступ заборонено" });
  }

  const qr = event.context.params?.qr;
  if (!qr || !uuidRegex.test(qr)) {
    throw createError({ statusCode: 400, message: "Невірний формат QR-коду" });
  }

  // Find registration in an ONGOING event
  const [reg] = await sql<{ id: number }[]>`
    SELECT r.id
    FROM registrations r
    JOIN events e ON r.event_id = e.id
    WHERE r.qr_token = ${qr}
      AND e.status = 'ONGOING'
    LIMIT 1
  `;

  if (!reg) {
    throw createError({
      statusCode: 404,
      message: "Реєстрацію не знайдено або захід не активний",
    });
  }

  // Return the most recent receipt for this registration regardless of status.
  // Create a fresh UNPAID receipt only if none exists at all.
  // This ensures refreshReceipt() after confirm/reject always returns the same record.
  const [existing] = await sql<{ id: number }[]>`
    SELECT id
    FROM receipts
    WHERE registration_id = ${reg.id}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  let receiptId: number;
  if (existing) {
    receiptId = existing.id;
  } else {
    const [created] = await sql<{ id: number }[]>`
      INSERT INTO receipts (registration_id, status, total)
      VALUES (${reg.id}, 'UNPAID', 0)
      RETURNING id
    `;
    receiptId = created.id;
  }

  return fetchReceipt(receiptId);
});
```

- [ ] **Step 3: Verify — scan a valid QR UUID, expect a ReceiptResponse JSON**

In dev mode, create a test registration with a known qr_token UUID in the DB, then:

```bash
curl -s -X POST http://localhost:3000/api/receipt/upsert-for/<uuid> | python3 -m json.tool
```

Expected: `{ id, status: "UNPAID", total: 0, guestName: "...", entries: [], paymentFileId: null, paymentMimetype: null }`

Calling the same endpoint again should return the same receipt ID (idempotent).

- [ ] **Step 4: Commit**

```bash
git add server/api/receipt/upsert-for/[qr].post.ts
git commit -m "feat(api): add receipt upsert-for endpoint"
```

---

### Task 7: Receipt entries update endpoint

**Files:**

- Create: `server/api/receipt/[id]/entries.put.ts`

Replaces all entries for a receipt and recalculates the total. Only works on UNPAID receipts.

- [ ] **Step 1: Create the route file**

```typescript
// server/api/receipt/[id]/entries.put.ts
import { sql } from "~~/server/utils/db";
import type { UpdateEntriesBody, ReceiptResponse } from "~/types/receipt";

async function fetchReceipt(receiptId: number): Promise<ReceiptResponse> {
  const [receipt] = await sql<
    {
      id: number;
      status: string;
      total: number;
      payment_id: number | null;
      full_name: string;
      payment_file_id: string | null;
      payment_mimetype: string | null;
    }[]
  >`
    SELECT
      r.id, r.status, r.total, r.payment_id,
      u.full_name,
      pay.file_id  AS payment_file_id,
      pay.mimetype AS payment_mimetype
    FROM receipts r
    JOIN registrations reg ON r.registration_id = reg.id
    JOIN users u ON reg.user_id = u.id
    LEFT JOIN payments pay ON r.payment_id = pay.id
    WHERE r.id = ${receiptId}
  `;
  const entries = await sql<
    {
      product_id: number;
      product_name: string;
      unit: string;
      unit_price: number;
      unit_count: number;
      subtotal: number;
    }[]
  >`
    SELECT re.product_id, p.name AS product_name, p.unit,
           p.price AS unit_price, re.unit_count, re.subtotal
    FROM receipt_entries re
    JOIN products p ON re.product_id = p.id
    WHERE re.receipt_id = ${receiptId}
  `;
  return {
    id: receipt.id,
    status: receipt.status as ReceiptResponse["status"],
    total: Number(receipt.total),
    guestName: receipt.full_name,
    paymentFileId: receipt.payment_file_id,
    paymentMimetype: receipt.payment_mimetype,
    entries: entries.map((e) => ({
      productId: e.product_id,
      productName: e.product_name,
      unit: e.unit,
      unitPrice: Number(e.unit_price),
      unitCount: e.unit_count,
      subtotal: Number(e.subtotal),
    })),
  };
}

export default defineEventHandler(async (event): Promise<ReceiptResponse> => {
  const dbUser = event.context.auth?.dbUser;
  if (!dbUser || !["BARTENDER", "SUDO"].includes(dbUser.role)) {
    throw createError({ statusCode: 403, message: "Доступ заборонено" });
  }

  const id = Number(event.context.params?.id);
  if (!Number.isInteger(id) || id < 1) {
    throw createError({ statusCode: 400, message: "Невірний ID" });
  }

  const body = await readBody<UpdateEntriesBody>(event);
  const entries = body?.entries ?? [];

  // Validate entries
  for (const e of entries) {
    if (!Number.isInteger(e.product_id) || e.product_id < 1) {
      throw createError({ statusCode: 400, message: "Невірний product_id" });
    }
    if (!Number.isInteger(e.unit_count) || e.unit_count < 1) {
      throw createError({
        statusCode: 400,
        message: "unit_count must be >= 1",
      });
    }
  }

  // Verify receipt exists and is UNPAID
  const [receipt] = await sql<{ status: string }[]>`
    SELECT status FROM receipts WHERE id = ${id}
  `;
  if (!receipt) {
    throw createError({ statusCode: 404, message: "Чек не знайдено" });
  }
  if (receipt.status !== "UNPAID") {
    throw createError({
      statusCode: 409,
      message: "Можна редагувати тільки неоплачений чек",
    });
  }

  // Delete existing entries
  await sql`DELETE FROM receipt_entries WHERE receipt_id = ${id}`;

  // Insert new entries (fetch product price for subtotal)
  for (const entry of entries) {
    const [product] = await sql<{ price: number }[]>`
      SELECT price FROM products WHERE id = ${entry.product_id}
    `;
    if (!product) {
      throw createError({
        statusCode: 400,
        message: `Продукт ${entry.product_id} не знайдено`,
      });
    }
    await sql`
      INSERT INTO receipt_entries (receipt_id, product_id, unit_count, subtotal)
      VALUES (
        ${id},
        ${entry.product_id},
        ${entry.unit_count},
        ${entry.unit_count * Number(product.price)}
      )
    `;
  }

  // Recalculate receipt total
  await sql`
    UPDATE receipts
    SET total      = (SELECT COALESCE(SUM(subtotal), 0) FROM receipt_entries WHERE receipt_id = ${id}),
        updated_at = now()
    WHERE id = ${id}
  `;

  return fetchReceipt(id);
});
```

- [ ] **Step 2: Verify — PUT entries, confirm total recalculated**

```bash
# Assumes receipt id=1 from Task 6 and product id=1 at price 5000 cents from Task 5
curl -s -X PUT http://localhost:3000/api/receipt/1/entries \
  -H "Content-Type: application/json" \
  -d '{"entries":[{"product_id":1,"unit_count":2}]}' | python3 -m json.tool
# Expected: total = 10000, entries has 1 item with unitCount=2, subtotal=10000

# Empty entries clears the order
curl -s -X PUT http://localhost:3000/api/receipt/1/entries \
  -H "Content-Type: application/json" \
  -d '{"entries":[]}' | python3 -m json.tool
# Expected: total = 0, entries = []
```

- [ ] **Step 3: Commit**

```bash
git add "server/api/receipt/[id]/entries.put.ts"
git commit -m "feat(api): add receipt entries update endpoint"
```

---

### Task 8: Payment action endpoints

**Files:**

- Create: `server/api/receipt/[id]/request-payment.post.ts`
- Create: `server/api/receipt/[id]/confirm-payment.post.ts`
- Create: `server/api/receipt/[id]/reject-payment.post.ts`

- [ ] **Step 1: Create request-payment endpoint**

```typescript
// server/api/receipt/[id]/request-payment.post.ts
import { sql } from "~~/server/utils/db";
import { sendTelegramMessage } from "~~/server/utils/telegram";
import { generatePaymentLink } from "~~/server/utils/payment-link";

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  const dbUser = event.context.auth?.dbUser;
  if (!dbUser || !["BARTENDER", "SUDO"].includes(dbUser.role)) {
    throw createError({ statusCode: 403, message: "Доступ заборонено" });
  }

  const id = Number(event.context.params?.id);
  if (!Number.isInteger(id) || id < 1) {
    throw createError({ statusCode: 400, message: "Невірний ID" });
  }

  const [row] = await sql<
    {
      status: string;
      total: number;
      telegram_id: bigint;
      receipt_payment_message: string | null;
    }[]
  >`
    SELECT
      r.status,
      r.total,
      u.telegram_id,
      e.receipt_payment_message
    FROM receipts r
    JOIN registrations reg ON r.registration_id = reg.id
    JOIN users u ON reg.user_id = u.id
    JOIN events e ON reg.event_id = e.id
    WHERE r.id = ${id}
    LIMIT 1
  `;

  if (!row) {
    throw createError({ statusCode: 404, message: "Чек не знайдено" });
  }
  if (row.status !== "UNPAID") {
    throw createError({
      statusCode: 409,
      message: "Запит оплати можна надіслати тільки для неоплаченого чеку",
    });
  }

  const link = generatePaymentLink(Number(row.total));
  const template =
    row.receipt_payment_message ?? "Сплати рахунок за бар: {link}";
  const message = template.replace("{link}", link);

  await sendTelegramMessage(row.telegram_id, message);

  await sql`
    UPDATE receipts
    SET status = 'AWAITING_PAYMENT', updated_at = now()
    WHERE id = ${id}
  `;

  return { ok: true };
});
```

- [ ] **Step 2: Create confirm-payment endpoint**

```typescript
// server/api/receipt/[id]/confirm-payment.post.ts
import { sql } from "~~/server/utils/db";

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  const dbUser = event.context.auth?.dbUser;
  if (!dbUser || !["BARTENDER", "SUDO"].includes(dbUser.role)) {
    throw createError({ statusCode: 403, message: "Доступ заборонено" });
  }

  const id = Number(event.context.params?.id);
  if (!Number.isInteger(id) || id < 1) {
    throw createError({ statusCode: 400, message: "Невірний ID" });
  }

  const [row] = await sql<
    {
      status: string;
      payment_id: number | null;
    }[]
  >`
    SELECT status, payment_id FROM receipts WHERE id = ${id}
  `;

  if (!row) {
    throw createError({ statusCode: 404, message: "Чек не знайдено" });
  }
  if (row.status !== "AWAITING_PAYMENT" || !row.payment_id) {
    throw createError({
      statusCode: 409,
      message: "Чек не очікує підтвердження оплати",
    });
  }

  await sql`UPDATE payments SET status = 'CONFIRMED' WHERE id = ${row.payment_id}`;
  await sql`UPDATE receipts SET status = 'PAID', updated_at = now() WHERE id = ${id}`;

  return { ok: true };
});
```

- [ ] **Step 3: Create reject-payment endpoint**

```typescript
// server/api/receipt/[id]/reject-payment.post.ts
import { sql } from "~~/server/utils/db";
import { sendTelegramMessage } from "~~/server/utils/telegram";
import { generatePaymentLink } from "~~/server/utils/payment-link";

export default defineEventHandler(async (event): Promise<{ ok: true }> => {
  const dbUser = event.context.auth?.dbUser;
  if (!dbUser || !["BARTENDER", "SUDO"].includes(dbUser.role)) {
    throw createError({ statusCode: 403, message: "Доступ заборонено" });
  }

  const id = Number(event.context.params?.id);
  if (!Number.isInteger(id) || id < 1) {
    throw createError({ statusCode: 400, message: "Невірний ID" });
  }

  const [row] = await sql<
    {
      status: string;
      payment_id: number | null;
      total: number;
      telegram_id: bigint;
      receipt_payment_message: string | null;
    }[]
  >`
    SELECT
      r.status,
      r.payment_id,
      r.total,
      u.telegram_id,
      e.receipt_payment_message
    FROM receipts r
    JOIN registrations reg ON r.registration_id = reg.id
    JOIN users u ON reg.user_id = u.id
    JOIN events e ON reg.event_id = e.id
    WHERE r.id = ${id}
    LIMIT 1
  `;

  if (!row) {
    throw createError({ statusCode: 404, message: "Чек не знайдено" });
  }
  if (row.status !== "AWAITING_PAYMENT" || !row.payment_id) {
    throw createError({
      statusCode: 409,
      message: "Чек не очікує підтвердження оплати",
    });
  }

  await sql`UPDATE payments SET status = 'FAILED' WHERE id = ${row.payment_id}`;
  await sql`
    UPDATE receipts
    SET status = 'UNPAID', payment_id = NULL, updated_at = now()
    WHERE id = ${id}
  `;

  // Resend payment DM
  const link = generatePaymentLink(Number(row.total));
  const template =
    row.receipt_payment_message ?? "Сплати рахунок за бар: {link}";
  const message = template.replace("{link}", link);
  await sendTelegramMessage(row.telegram_id, message);

  return { ok: true };
});
```

- [ ] **Step 4: Verify — build succeeds**

```bash
bun run build 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add "server/api/receipt/[id]/request-payment.post.ts" \
        "server/api/receipt/[id]/confirm-payment.post.ts" \
        "server/api/receipt/[id]/reject-payment.post.ts"
git commit -m "feat(api): add payment action endpoints (request/confirm/reject)"
```

---

### Task 9: useAuth composable

**Files:**

- Create: `app/composables/useAuth.ts`

- [ ] **Step 1: Create the composable**

```typescript
// app/composables/useAuth.ts
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
```

- [ ] **Step 2: Verify — import in a page works, build succeeds**

```bash
bun run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add app/composables/useAuth.ts
git commit -m "feat(composables): add useAuth for role-based page gating"
```

---

### Task 10: Inventory page

**Files:**

- Create: `app/pages/inventory/index.vue`

- [ ] **Step 1: Create the inventory page**

```vue
<!-- app/pages/inventory/index.vue -->
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

    <!-- Add/Edit form -->
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

    <!-- Product list -->
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
```

- [ ] **Step 2: Start dev server and navigate to /inventory in browser**

```bash
bun run dev
# Open http://localhost:3000/inventory
```

Expected:

- Page loads with "Інвентар" heading and "Додати продукт" button
- Click "Додати продукт" → form appears
- Fill in name/unit/price → save → product appears in list
- Edit button pre-fills form
- Delete button removes product (confirm dialog first)

- [ ] **Step 3: Commit**

```bash
git add app/pages/inventory/index.vue
git commit -m "feat(ui): add inventory product CRUD page"
```

---

### Task 11: Scan entry page for bartenders

**Files:**

- Create: `app/pages/scan/index.vue`

- [ ] **Step 1: Create the scan entry page**

```vue
<!-- app/pages/scan/index.vue -->
<script setup lang="ts">
const { isBartender, status: authStatus } = useAuth();
watch(authStatus, (s) => {
  if (s === "success" && !isBartender.value) navigateTo("/unauthenticated");
});

const router = useRouter();

const onScanned = (qr: string) => router.push(`/scan/${qr}`);
const onError = (err: string) => console.error("QR scan error:", err);
</script>

<template>
  <QrScanner @scanned="onScanned" @error="onError" />
</template>
```

- [ ] **Step 2: Verify in browser — navigate to /scan**

```bash
# With dev server running, open http://localhost:3000/scan
```

Expected: QR scanner opens immediately (same as /qr page). Scanning a QR navigates to `/scan/<uuid>`.

- [ ] **Step 3: Commit**

```bash
git add app/pages/scan/index.vue
git commit -m "feat(ui): add bartender QR scan entry page"
```

---

### Task 12: Receipt order/payment page

**Files:**

- Create: `app/pages/scan/[qr].vue`

This is the main bartender interaction page. It fetches the receipt on mount, shows the product catalog with +/- controls for UNPAID status, and shows payment actions based on status.

- [ ] **Step 1: Create the receipt page**

```vue
<!-- app/pages/scan/[qr].vue -->
<script setup lang="ts">
import { retrieveRawInitData } from "@tma.js/sdk-vue";
import type { Product, ReceiptResponse } from "~/types/receipt";

const { isBartender, status: authStatus } = useAuth();
watch(authStatus, (s) => {
  if (s === "success" && !isBartender.value) navigateTo("/unauthenticated");
});

const route = useRoute();
const qr = computed(() => route.params.qr as string);

// Fetch or create receipt
const {
  data: receipt,
  status: receiptStatus,
  error: receiptError,
  refresh: refreshReceipt,
} = useClientFetch<ReceiptResponse>(
  () => `/api/receipt/upsert-for/${qr.value}`,
  { method: "POST" },
);

// Fetch all products for the order catalog
const { data: products } = useClientFetch<Product[]>("/api/products");

// Local quantity map: product_id → count
const counts = reactive<Record<number, number>>({});

// Initialise counts from existing receipt entries when receipt loads
watch(receipt, (r) => {
  if (!r) return;
  for (const entry of r.entries) {
    counts[entry.productId] = entry.unitCount;
  }
});

const increment = (productId: number) => {
  counts[productId] = (counts[productId] ?? 0) + 1;
};

const decrement = (productId: number) => {
  const current = counts[productId] ?? 0;
  if (current > 0) counts[productId] = current - 1;
};

const runningTotal = computed(() => {
  if (!products.value) return 0;
  return products.value.reduce((sum, p) => {
    return sum + (counts[p.id] ?? 0) * p.price;
  }, 0);
});

const formatPrice = (cents: number) => `${(cents / 100).toFixed(2)} грн`;

const getHeaders = () => ({ Authorization: retrieveRawInitData() });

// Save entries
const saving = ref(false);
const saveError = ref<string | null>(null);

const saveEntries = async () => {
  if (!receipt.value) return;
  saving.value = true;
  saveError.value = null;
  try {
    const entries = Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([productId, unit_count]) => ({
        product_id: Number(productId),
        unit_count,
      }));

    await $fetch(`/api/receipt/${receipt.value.id}/entries`, {
      method: "PUT",
      body: { entries },
      headers: getHeaders(),
    });
    await refreshReceipt();
  } catch (err) {
    saveError.value = err?.data?.message ?? "Помилка збереження";
  } finally {
    saving.value = false;
  }
};

// Send payment request
const requestingPayment = ref(false);
const requestError = ref<string | null>(null);

const requestPayment = async () => {
  if (!receipt.value) return;
  requestingPayment.value = true;
  requestError.value = null;
  try {
    await $fetch(`/api/receipt/${receipt.value.id}/request-payment`, {
      method: "POST",
      headers: getHeaders(),
    });
    await refreshReceipt();
  } catch (err) {
    requestError.value = err?.data?.message ?? "Помилка надсилання запиту";
  } finally {
    requestingPayment.value = false;
  }
};

// Confirm payment
const confirming = ref(false);
const confirmError = ref<string | null>(null);

const confirmPayment = async () => {
  if (!receipt.value) return;
  confirming.value = true;
  confirmError.value = null;
  try {
    await $fetch(`/api/receipt/${receipt.value.id}/confirm-payment`, {
      method: "POST",
      headers: getHeaders(),
    });
    await refreshReceipt();
  } catch (err) {
    confirmError.value = err?.data?.message ?? "Помилка підтвердження";
  } finally {
    confirming.value = false;
  }
};

// Reject payment
const rejecting = ref(false);
const rejectError = ref<string | null>(null);

const rejectPayment = async () => {
  if (!receipt.value) return;
  rejecting.value = true;
  rejectError.value = null;
  try {
    await $fetch(`/api/receipt/${receipt.value.id}/reject-payment`, {
      method: "POST",
      headers: getHeaders(),
    });
    await refreshReceipt();
  } catch (err) {
    rejectError.value = err?.data?.message ?? "Помилка відхилення";
  } finally {
    rejecting.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col gap-4 p-4 w-full max-w-md mx-auto pb-32">
    <!-- Loading -->
    <div
      v-if="receiptStatus === 'idle' || receiptStatus === 'pending'"
      class="text-annotation text-sm text-center mt-8"
    >
      Завантаження...
    </div>

    <!-- Error -->
    <div
      v-else-if="receiptError"
      class="rounded-xl border border-error bg-error/10 p-4 text-sm text-error"
    >
      {{ receiptError.message }}
    </div>

    <template v-else-if="receipt">
      <!-- Guest header -->
      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="font-semibold text-lg">{{ receipt.guestName }}</p>
            <p class="text-sm text-annotation capitalize">
              {{
                receipt.status === "UNPAID"
                  ? "Не оплачено"
                  : receipt.status === "AWAITING_PAYMENT"
                    ? "Очікується оплата"
                    : "Оплачено"
              }}
            </p>
          </div>
          <UButton
            v-if="receipt.status === 'AWAITING_PAYMENT'"
            size="sm"
            variant="ghost"
            @click="refreshReceipt"
          >
            Оновити
          </UButton>
        </div>
      </UCard>

      <!-- UNPAID: editable product catalog -->
      <template v-if="receipt.status === 'UNPAID'">
        <UCard v-for="product in products" :key="product.id">
          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <p class="font-medium truncate">{{ product.name }}</p>
              <p class="text-sm text-annotation">
                {{ formatPrice(product.price) }} / {{ product.unit }}
              </p>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <UButton size="sm" variant="ghost" @click="decrement(product.id)">
                −
              </UButton>
              <span class="w-6 text-center font-mono">
                {{ counts[product.id] ?? 0 }}
              </span>
              <UButton size="sm" variant="ghost" @click="increment(product.id)">
                +
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Error display -->
        <p v-if="saveError" class="text-sm text-error">{{ saveError }}</p>
        <p v-if="requestError" class="text-sm text-error">{{ requestError }}</p>

        <!-- Sticky footer with total + actions -->
        <div
          class="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-gray-200 dark:border-neutral-700"
        >
          <div class="max-w-md mx-auto flex flex-col gap-2">
            <p class="text-center font-semibold">
              Разом: {{ formatPrice(runningTotal) }}
            </p>
            <div class="flex gap-2">
              <UButton
                class="flex-1"
                variant="ghost"
                :loading="saving"
                @click="saveEntries"
              >
                Зберегти
              </UButton>
              <UButton
                class="flex-1"
                :loading="requestingPayment"
                @click="requestPayment"
              >
                Надіслати запит оплати
              </UButton>
            </div>
          </div>
        </div>
      </template>

      <!-- AWAITING_PAYMENT: read-only summary -->
      <template v-else-if="receipt.status === 'AWAITING_PAYMENT'">
        <!-- Receipt summary -->
        <UCard>
          <template #header>
            <h2 class="font-semibold">Замовлення</h2>
          </template>
          <div class="flex flex-col gap-2">
            <div
              v-for="entry in receipt.entries"
              :key="entry.productId"
              class="flex justify-between text-sm"
            >
              <span>{{ entry.productName }} × {{ entry.unitCount }}</span>
              <span>{{ formatPrice(entry.subtotal) }}</span>
            </div>
            <div
              class="border-t border-gray-200 dark:border-neutral-700 pt-2 flex justify-between font-semibold"
            >
              <span>Разом</span>
              <span>{{ formatPrice(receipt.total) }}</span>
            </div>
          </div>
        </UCard>

        <!-- No proof yet -->
        <template v-if="!receipt.paymentFileId">
          <p class="text-annotation text-sm text-center">
            Очікуємо підтвердження оплати від гостя...
          </p>
        </template>

        <!-- Proof uploaded -->
        <template v-else>
          <UCard>
            <template #header>
              <h2 class="font-semibold">Підтвердження оплати</h2>
            </template>
            <ViewerPaymentReceipt
              :file-id="receipt.paymentFileId"
              :mimetype="receipt.paymentMimetype"
            />
          </UCard>

          <p v-if="confirmError" class="text-sm text-error">
            {{ confirmError }}
          </p>
          <p v-if="rejectError" class="text-sm text-error">{{ rejectError }}</p>

          <div class="flex gap-2">
            <UButton
              class="flex-1"
              color="error"
              variant="ghost"
              :loading="rejecting"
              @click="rejectPayment"
            >
              Відхилити
            </UButton>
            <UButton
              class="flex-1"
              :loading="confirming"
              @click="confirmPayment"
            >
              Підтвердити
            </UButton>
          </div>
        </template>
      </template>

      <!-- PAID: final state -->
      <template v-else-if="receipt.status === 'PAID'">
        <UCard>
          <template #header>
            <h2 class="font-semibold">Замовлення оплачено ✓</h2>
          </template>
          <div class="flex flex-col gap-2">
            <div
              v-for="entry in receipt.entries"
              :key="entry.productId"
              class="flex justify-between text-sm"
            >
              <span>{{ entry.productName }} × {{ entry.unitCount }}</span>
              <span>{{ formatPrice(entry.subtotal) }}</span>
            </div>
            <div
              class="border-t border-gray-200 dark:border-neutral-700 pt-2 flex justify-between font-semibold"
            >
              <span>Разом</span>
              <span>{{ formatPrice(receipt.total) }}</span>
            </div>
          </div>
        </UCard>
      </template>
    </template>
  </div>
</template>
```

- [ ] **Step 2: Verify end-to-end in browser**

With dev server running and a test registration in the DB:

1. Navigate to `/scan` — QR scanner opens
2. Scan or manually navigate to `/scan/<valid-qr-uuid>`
3. Page loads receipt (UNPAID), shows product catalog with +/- controls
4. Adjust quantities, hit "Зберегти" — see no errors, running total updates
5. Hit "Надіслати запит оплати" — status changes to AWAITING_PAYMENT, refresh button appears
6. Simulate guest proof upload via bot (or manually INSERT payment record and update receipts.payment_id in DB)
7. Hit "Оновити" — Confirm/Reject buttons appear with payment receipt display
8. Hit "Підтвердити" — status changes to PAID, read-only summary shown
9. Navigate to a paid receipt URL — shows PAID state correctly

- [ ] **Step 3: Commit**

```bash
git add "app/pages/scan/[qr].vue"
git commit -m "feat(ui): add bartender receipt order and payment page"
```

---

## End-to-End Verification Checklist

- [ ] `GET /api/products` returns `[]` with no auth error in dev mode
- [ ] Product can be created, edited, deleted via inventory page
- [ ] Deleting a product used in a receipt shows "Cannot delete" toast
- [ ] `/scan` page opens QR scanner and routes to `/scan/<qr>`
- [ ] `/scan/<qr>` creates UNPAID receipt on first visit, returns same receipt on repeat
- [ ] Saving entries recalculates total in DB
- [ ] "Надіслати запит оплати" changes status to AWAITING_PAYMENT
- [ ] Refresh button re-fetches receipt without creating a new one
- [ ] After proof upload, Confirm/Reject buttons appear
- [ ] Confirm sets receipt PAID, Reject resets to UNPAID and clears payment_id
- [ ] USER/BANNED role gets redirected to /unauthenticated on /scan and /inventory
