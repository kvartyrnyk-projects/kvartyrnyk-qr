# Bartender Mini-App Integration Design

**Date:** 2026-04-20  
**Status:** Approved

## Context

The kvartyrnyk-bot project (sibling repo) implements bartender role, products, receipts, and receipt_entries at the DB and Telegram bot level (Stages 1–4 of the bartender spec). This spec covers Stage 5: the Nuxt mini-app integration. Bartenders need a QR-scan → order-editing → payment-request flow, and a product inventory management page.

---

## Architecture

Two new feature areas are added to the Nuxt mini-app, both gated to `BARTENDER | SUDO`:

1. **Bartender order flow** — `/scan` → `/scan/[qr]`: scan guest QR, view/edit receipt entries, send payment request, confirm or reject payment proof
2. **Inventory** — `/inventory`: product CRUD

The existing `/validate` check-in flow (admin QR scanning) is untouched.

A new `useAuth` composable fetches `/api/me` on mount, exposes the user's role, and redirects to `/unauthenticated` if role is insufficient for the current page.

---

## Bartender Scan Flow

### Entry: `/scan/index.vue`

Mirrors the existing `/qr` scanner page but routes results to `/scan/[qr]` instead of `/validate/qr/[qr]`. Gated to `BARTENDER | SUDO`.

### Receipt Page: `/scan/[qr].vue`

On mount, calls `POST /api/receipt/upsert-for/:qr`:
- Resolves the QR token to a registration for the current ONGOING event
- If an UNPAID or AWAITING_PAYMENT receipt exists, returns it with its entries
- Otherwise creates a fresh UNPAID receipt with no entries

The page renders based on `receipt.status`:

**Status: `UNPAID`**
- Guest name header
- Product list: every product from `GET /api/products` as a row with name, unit, price, and `−` / count / `+` controls (count initialised from existing entries, 0 for new)
- Running total footer (recalculated client-side as items change)
- **Save** button — `PUT /api/receipt/:id/entries` with `{product_id, unit_count}[]` for all items with count > 0
- **Send Payment Request** button — `POST /api/receipt/:id/request-payment`; transitions receipt to `AWAITING_PAYMENT` and triggers bot DM to guest

**Status: `AWAITING_PAYMENT`, no `payment_id` yet**
- Receipt summary (items + total, read-only)
- "Waiting for payment proof..." status label
- **Refresh** button — re-fetches receipt to check if guest has uploaded proof

**Status: `AWAITING_PAYMENT`, `payment_id` set (proof uploaded)**
- Receipt summary (items + total, read-only)
- Payment proof display (mirrors existing `<PaymentReceipt>` component)
- **Confirm Payment** — `POST /api/receipt/:id/confirm-payment` → `payment.status = CONFIRMED`, `receipt.status = PAID`
- **Reject Payment** — `POST /api/receipt/:id/reject-payment` → `payment.status = FAILED`, `receipt.status = UNPAID`, backend resends payment DM to guest

**Status: `PAID`**
- Read-only receipt summary with "Paid" status badge

---

## Inventory Page: `/inventory/index.vue`

Accessible to `BARTENDER | SUDO`. Displays a table of all products with columns: name, description, unit, price (formatted as UAH), tags.

### Actions

- **Add product** — opens a form (modal or inline): name (required), unit (required), price in UAH (required, stored server-side as cents = value × 100), description (optional), tags (optional, comma-separated input → `text[]`)
- **Edit** — per-row button, opens same form pre-filled
- **Delete** — per-row button with confirmation dialog; if the product is referenced by any `receipt_entries`, the backend returns `409` (Postgres `RESTRICT`) and the UI shows an error toast: "Cannot delete: product is used in existing receipts"

---

## API Routes

All routes require `BARTENDER | SUDO` (enforced by auth middleware).

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/receipt/upsert-for/:qr` | Resolve QR → registration → upsert UNPAID receipt |
| `PUT` | `/api/receipt/:id/entries` | Replace all entries (items with count > 0) |
| `POST` | `/api/receipt/:id/request-payment` | Send payment DM to guest, set `AWAITING_PAYMENT` |
| `POST` | `/api/receipt/:id/confirm-payment` | Set payment `CONFIRMED`, receipt `PAID` |
| `POST` | `/api/receipt/:id/reject-payment` | Set payment `FAILED`, receipt `UNPAID`, resend DM |
| `GET` | `/api/products` | List all products |
| `POST` | `/api/products` | Create product |
| `PUT` | `/api/products/:id` | Update product |
| `DELETE` | `/api/products/:id` | Delete product (409 if FK restrict triggered) |

---

## New Files

| File | Purpose |
|---|---|
| `app/pages/scan/index.vue` | QR scanner entry for bartenders |
| `app/pages/scan/[qr].vue` | Receipt order/payment page |
| `app/pages/inventory/index.vue` | Product CRUD |
| `app/composables/useAuth.ts` | Fetches `/api/me`, exposes role, guards pages |
| `server/api/receipt/upsert-for/[qr].post.ts` | Upsert receipt for guest |
| `server/api/receipt/[id]/entries.put.ts` | Update receipt entries |
| `server/api/receipt/[id]/request-payment.post.ts` | Send payment request |
| `server/api/receipt/[id]/confirm-payment.post.ts` | Confirm payment |
| `server/api/receipt/[id]/reject-payment.post.ts` | Reject payment |
| `server/api/products/index.get.ts` | List products |
| `server/api/products/index.post.ts` | Create product |
| `server/api/products/[id].put.ts` | Update product |
| `server/api/products/[id].delete.ts` | Delete product |

---

## Verification Plan

1. **Auth gate**: log in as `USER` role, navigate to `/scan` and `/inventory` — expect redirect to `/unauthenticated`
2. **Receipt upsert**: scan a guest QR as bartender — expect receipt page to load with product list; scan again — expect same receipt returned (not duplicated)
3. **Order editing**: add items with +/−, hit Save — verify `receipt_entries` rows in DB match, total updated
4. **Payment request**: hit "Send Payment Request" — verify receipt status becomes `AWAITING_PAYMENT`, bot sends DM to guest
5. **Waiting state**: refresh page with no proof yet — see read-only summary + Refresh button
6. **Proof uploaded**: upload payment proof via bot as guest — hit Refresh in mini-app — see Confirm/Reject buttons appear
7. **Confirm**: press Confirm — verify `receipt.status = PAID`, `payment.status = CONFIRMED`
8. **Reject**: upload proof, press Reject — verify receipt back to `UNPAID`, bot resends DM
9. **Inventory CRUD**: create product, edit it, verify changes in DB; attempt delete of a product used in a receipt — expect error toast
