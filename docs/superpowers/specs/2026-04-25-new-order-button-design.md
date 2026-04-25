# New Order Button on Paid Receipt Page

**Date:** 2026-04-25
**Status:** Approved

## Context

The `scan/[qr].vue` page manages a bartender's view of a guest's receipt. Receipts flow through three states: `UNPAID → AWAITING_PAYMENT → PAID`. Once a receipt reaches `PAID`, the page shows a read-only order summary with no further actions. If a guest wants to order again (e.g. second round), the bartender has no way to start a new order without rescanning the QR code. A "Нове замовлення" (New Order) button on the PAID state eliminates this friction.

## Architecture

### Backend — new API endpoint

**`POST /api/receipt/new-for/[qr]`** (`server/api/receipt/new-for/[qr].post.ts`)

- Requires role: `BARTENDER` or `SUDO`
- Validates QR format (reuses existing `uuidRegex`)
- Fetches the `registration_id` for the given QR (same query as `upsert-for`)
- Inserts a new `receipts` row with `status='UNPAID'`, `total=0`
- Returns the new receipt via the already-exported `fetchReceipt()` helper from `upsert-for/[qr].post.ts`

No changes to existing endpoints. The existing `upsert-for/[qr]` naturally returns the newest receipt (`ORDER BY created_at DESC LIMIT 1`), so after creation, `refreshReceipt()` will fetch the new UNPAID receipt.

### Frontend — PAID state update

**`app/pages/scan/[qr].vue`**

Add to script:
- `creatingNew: ref(false)` — loading state for the button
- `createNewError: ref<string | null>(null)` — error display
- `createNewOrder()` — calls the new endpoint, clears `counts`, calls `refreshReceipt()`

Clearing `counts` must delete all existing keys (not just overwrite), since the watch handler only sets counts for entries that exist in the receipt — it won't zero out old products:
```ts
Object.keys(counts).forEach((k) => delete counts[Number(k)]);
```

Add to PAID template: a `UButton` labeled "Нове замовлення" below the order summary card. Error shown as a `<p class="text-sm text-error">` if the call fails.

## Data Flow

```
Bartender on PAID page
  → clicks "Нове замовлення"
  → POST /api/receipt/new-for/{qr}
  → inserts receipts row (UNPAID, total=0)
  → client clears counts{}
  → refreshReceipt() → POST /api/receipt/upsert-for/{qr}
  → returns new receipt (most recent, UNPAID)
  → page re-renders in UNPAID state with empty product catalog
```

## Error Handling

- Invalid QR / registration not found → server returns 400/404, surfaced via `createNewError`
- Event closed/cancelled → same 404 path as `upsert-for`
- Network failure → caught in try/catch, shown inline

## Files Changed

| File | Change |
|------|--------|
| `server/api/receipt/new-for/[qr].post.ts` | New file — creates UNPAID receipt |
| `app/pages/scan/[qr].vue` | Add button + handler to PAID state |

## Verification

1. Open a receipt in PAID state → "Нове замовлення" button is visible
2. Click it → page transitions to UNPAID with empty product list and same guest name
3. Add products, save, request payment → full flow works on the new receipt
4. Old PAID receipt still exists in DB (check via stats page or DB query)
5. Error case: if endpoint fails, error message appears without leaving the page
