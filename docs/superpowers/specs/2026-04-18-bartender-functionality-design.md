# Bartender Functionality Design

**Date:** 2026-04-18  
**Status:** Approved

## Context

The bot manages event registrations and check-ins. This spec adds a bartender role and bar tab system: bartenders can create orders for guests during events, send payment requests, and confirm payments. A god-level SUDO role is introduced to separate privilege escalation from plain administration.

---

## Implementation Stages

1. DB schema migrations
2. Roles (SUDO, guards, keyboard visibility)
3. Bartender menu and flows
4. Event status automation + event-end payment collection
5. Mini app integration (out of scope — sibling repository)

---

## Stage 1: DB Schema Changes

### Modified enums

**`user_role`** — add `SUDO` value  
`"ADMIN" | "BARTENDER" | "USER" | "BANNED" | "SUDO"`

**New enum `payment_type`**  
`"REGISTRATION" | "RECEIPT"`

**New enum `receipt_status`**  
`"UNPAID" | "AWAITING_PAYMENT" | "PAID"`

### Modified tables

#### `payments`
- **Remove** `registration_id` FK
- **Add** `type: payment_type` (not null)
- **Migrate** `amount int` → `amount bigint` (smallest currency units, cents)

#### `registrations`
- **Add** `payment_id` (nullable bigint FK → `payments.id`, set null on delete)

#### `events`
- **Add** `registration_payment_message text` (nullable) — DM template for registration fee payment; use `{link}` placeholder. Example: `"Сплати вступний внесок: {link}"`
- **Add** `receipt_payment_message text` (nullable) — DM template for receipt/bar tab payment; use `{link}` placeholder. Example: `"Твій рахунок за бар: {link}"`
- **Migrate** `price int` → `price bigint`

### New tables

#### `products`
```
id          serial PK
name        text NOT NULL
description text (nullable)
tags        text[] NOT NULL DEFAULT '{}'   -- GIN index for recommendation system
unit        text NOT NULL                  -- e.g. "шт", "мл", "порція"
price       bigint NOT NULL               -- cents
created_at  timestamp with tz DEFAULT now()
updated_at  timestamp with tz DEFAULT now()
```
Indexes: GIN on `tags`

#### `receipts`
```
id              serial PK
registration_id integer FK → registrations.id (cascade delete)
payment_id      integer FK → payments.id (set null on delete, nullable)
status          receipt_status NOT NULL DEFAULT 'UNPAID'
total           bigint NOT NULL DEFAULT 0  -- cents, pre-calculated
created_at      timestamp with tz DEFAULT now()
updated_at      timestamp with tz DEFAULT now()
```
Indexes:
- Partial unique: `(registration_id) WHERE status = 'UNPAID'` — enforces one open tab per registration

#### `receipt_entries`
```
id          serial PK
receipt_id  integer FK → receipts.id (cascade delete)
product_id  integer FK → products.id (restrict)
unit_count  integer NOT NULL CHECK (unit_count > 0)
subtotal    bigint NOT NULL    -- cents, unit_count * product.price at time of order
created_at  timestamp with tz DEFAULT now()
updated_at  timestamp with tz DEFAULT now()
```

### File: `src/infra/db/schema.ts`
All new tables and enum additions go here. Document `{link}` placeholder convention in inline comments on `registration_payment_message` and `receipt_payment_message`.

---

## Stage 2: Roles

### SUDO role

- `SUDO` is a god-level role: full access to both admin and bartender menus
- `ADMIN_ID` env var is always treated as hardcoded SUDO (same pattern as current adminCache)
- Plain `ADMIN` users lose the ability to change user roles

### Cache (`src/app/container.ts`)

Replace `adminCache: AdminCache` with three caches:
- `adminCache` — users with `ADMIN | SUDO` role (access to admin menu)
- `sudoCache` — users with `SUDO` role only (access to role management)
- `bartenderCache` — users with `BARTENDER | SUDO` role (access to bartender menu)

Each cache follows the existing TTL pattern (30s). `ADMIN_ID` is injected into `adminCache` and `sudoCache` at startup.

### Guards (`src/middleware/guards.ts`)

| Guard | Passes for |
|---|---|
| `requireAdmin` | `ADMIN \| SUDO` (or cached) |
| `requireSudo` | `SUDO` only (or hardcoded ADMIN_ID) |
| `requireBartender` | `BARTENDER \| SUDO` (or cached) |

### Main keyboard (`src/handlers/user/start.ts`)

`buildMainReplyKeyboard(role, adminCache, sudoCache, bartenderCache)`:
- `"Меню адміністратора"` — shown if `ADMIN | SUDO`
- `"Меню бармена"` — shown if `BARTENDER | SUDO`
- `"Меню"` — always shown

### Role change (`src/handlers/admin/flows.ts`)

`userRoleKeyboard()` — role-change buttons only rendered when `actor.role === 'SUDO'` or actor is ADMIN_ID. Plain ADMIN sees user info card but no role-change action.

---

## Stage 3: Bartender Menu

### New files

- `src/handlers/bartender/panel.ts` — entry, dashboard
- `src/handlers/bartender/flows.ts` — FSM flows
- `src/repositories/product.ts` — CRUD for products
- `src/repositories/receipt.ts` — CRUD for receipts and entries

### Routing (`src/bot/router.ts`)

Add `bartenderPanelComposer` + `bartenderFlowsComposer` behind `requireBartender` guard, parallel to admin routes.

### Bartender panel keyboard

- `Активні замовлення` — list UNPAID + AWAITING_PAYMENT receipts for current ONGOING event
- `Нове замовлення` — start order creation flow
- `Назад`

### Create order flow (FSM in `BartenderSession`)

1. Bartender inputs guest username or telegram_id
2. Bot resolves user → shows existing UNPAID receipt or creates new one
3. Product catalog: inline keyboard with product rows + `[+]` buttons, running total shown
4. `[Підтвердити]` → upsert `receipt_entries`, recalculate `receipt.total`

### Send payment request (from active receipts list)

- Inline button per UNPAID receipt: `[📲 Надіслати запит]`
- Bot DMs guest: `event.receipt_payment_message.replace('{link}', generatePaymentLink(receipt.total))`
- Receipt status → `AWAITING_PAYMENT`

### Payment proof flow (extends `src/handlers/user/flows.ts`)

When user uploads photo/document to bot:
- Check if user has an `AWAITING_PAYMENT` receipt for the current event
- Create `payment` record: `{ type: 'RECEIPT', status: 'PENDING', amount: receipt.total, ...fileFields }`
- Set `receipt.payment_id = payment.id`
- Broadcast to all `BARTENDER | SUDO` users: forwarded proof + inline buttons `[✅ Підтвердити] [❌ Відхилити]`

### Confirmation handler

- First tap (Confirm): `payment.status → CONFIRMED`, `receipt.status → PAID`
- First tap (Reject): `payment.status → FAILED`, `receipt.status → UNPAID`
- Subsequent taps (any frontend): edit message to `"Already handled"` + remove buttons

### `generatePaymentLink` stub (`src/services/payment-link.ts`)

```typescript
export function generatePaymentLink(amount: number): string {
  // TODO: integrate real payment processor (LiqPay / Monobank)
  return `https://pay.example.com/?amount=${amount}`
}
```

---

## Stage 4: Event Status Automation

### Dependency

Add `cron` npm package (`npm install cron`).

### New file: `src/jobs/event-status.ts`

Cron schedule: every 15 minutes (`"*/15 * * * *"`)

**Each tick:**
1. Find events: `status = 'REGISTRATION_CLOSED'` AND `starts_at <= now() + 30 minutes` → set `ONGOING`
2. Find events: `status = 'ONGOING'` AND `ends_at IS NOT NULL` AND `ends_at <= now()` → set `FINISHED` → call `handleEventEnd(event)`

**`handleEventEnd(event)`:**
1. Query all registrations for the event
2. For each registration: find UNPAID receipts
3. For each UNPAID receipt:
   - Bot DMs registered user: `event.receipt_payment_message.replace('{link}', generatePaymentLink(receipt.total))` (fallback to default string if message is null)
   - Receipt status → `AWAITING_PAYMENT`

### Job initialization

Start cron job in `src/index.ts` alongside bot startup.

### Event `registration_payment_message` usage

Update existing `handlePaymentStep` in `src/handlers/user/flows.ts` to use `event.registration_payment_message.replace('{link}', paymentInfo)` instead of hardcoded text.

---

## Verification Plan

1. **Schema**: run `drizzle-kit generate` + `drizzle-kit migrate`, verify no data loss on existing rows
2. **Roles**: set user to SUDO in DB, verify role-change button appears; set to ADMIN, verify it's hidden
3. **Bartender menu**: set user to BARTENDER, verify "Меню бармена" appears in main keyboard
4. **Order flow**: create order as bartender → send payment request → upload proof → confirm as bartender → receipt PAID
5. **Event automation**: set event `starts_at = now() + 25min`, run job tick manually → event should transition to ONGOING; set `ends_at = now() - 1min`, run tick → FINISHED + payment DMs sent
6. **"Already handled"**: confirm a receipt payment from one client → attempt confirm from another → see "Already handled"
