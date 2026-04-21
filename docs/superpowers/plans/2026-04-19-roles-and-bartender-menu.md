# Roles + Bartender Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Stage 2 (SUDO/admin/bartender role guards + caches + keyboard visibility) and Stage 3 (bartender panel, create-order FSM, payment request flow, proof broadcast, confirm/reject).

**Architecture:** A generic `RoleCache` class replaces the bespoke `AdminCache`, giving three caches (admin, sudo, bartender). New guards `requireSudo` and `requireBartender` gate route composers. The bartender menu uses an FSM session stored in `container.bartenderSessions`. Payment proof uploads are extended to handle `RECEIPT` type payments with inline confirm/reject broadcast to all bartenders.

**Tech Stack:** Grammy (Composer pattern), Drizzle ORM, Bun, Biome (linting), TypeScript, PostgreSQL

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/repositories/user.ts` | Add `listTelegramIdsByRoles` |
| Modify | `src/app/session-types.ts` | Add `BartenderSession` type |
| Modify | `src/app/container.ts` | Generic `RoleCache`; three caches; `bartenderSessions` map |
| Modify | `src/middleware/guards.ts` | Add `requireSudo`, `requireBartender`; update `requireAdmin` |
| Modify | `src/handlers/user/start.ts` | `buildMainReplyKeyboard` shows bartender button |
| Modify | `src/handlers/admin/flows.ts` | Gate role-change keyboard to SUDO; sync all three caches |
| Modify | `src/messages.ts` | Add bartender keyboard labels + bartender message strings |
| Create | `src/services/payment-link.ts` | `generatePaymentLink` stub |
| Modify | `src/repositories/payment.ts` | Add `confirmIfPending` method |
| Modify | `src/repositories/receipt.ts` | Add `findAwaitingPaymentByRegistration`, `findByPaymentId`, `listActiveByEventWithUsers` |
| Create | `src/handlers/bartender/panel.ts` | Bartender panel entry + active receipts list |
| Create | `src/handlers/bartender/flows.ts` | Create-order FSM, send payment request, confirm/reject proof |
| Modify | `src/handlers/user/flows.ts` | Extend photo/document handlers for receipt payment proofs |
| Modify | `src/bot/router.ts` | Wire bartender routes behind `requireBartender` |

---

## Task 1: UserRepository — listTelegramIdsByRoles

**Files:**
- Modify: `src/repositories/user.ts`

- [ ] **Step 1: Add `inArray` import and `listTelegramIdsByRoles` to UserRepository**

In `src/repositories/user.ts`, replace:
```ts
import { asc, eq, or, sql } from "drizzle-orm"
```
with:
```ts
import { asc, eq, inArray, or, sql } from "drizzle-orm"
```

Then add this method inside the `UserRepository` class, after `listAdminTelegramIds`:

```ts
async listTelegramIdsByRoles(roles: UserRow["role"][]) {
	if (roles.length === 0) return new Set<bigint>()
	const rows = await db
		.select({ telegramId: users.telegram_id })
		.from(users)
		.where(inArray(users.role, roles))
	return new Set(rows.map((row) => row.telegramId))
}
```

- [ ] **Step 2: Lint**

```bash
bun run lint
```

Expected: no errors.

---

## Task 2: BartenderSession type

**Files:**
- Modify: `src/app/session-types.ts`

- [ ] **Step 1: Append BartenderSession to session-types.ts**

Add at the end of `src/app/session-types.ts`:

```ts
export type BartenderSession = {
	step: "waiting_guest_id" | "browsing_products"
	receiptId: number | null
	registrationId: number | null
	pendingItems: Record<number, number>
	catalogMessageId: number | null
}
```

- [ ] **Step 2: Lint**

```bash
bun run lint
```

Expected: no errors.

---

## Task 3: Container — generic RoleCache + three caches + bartenderSessions

**Files:**
- Modify: `src/app/container.ts`

- [ ] **Step 1: Rewrite container.ts**

Replace the entire file with:

```ts
import type { AdminSession, BartenderSession, RegisterSession } from "#/app/session-types.js"
import type { UserRole } from "#/app/types.js"
import { adminId } from "#/constants.js"
import { EventRepository } from "#/repositories/event.js"
import { FriendRepository } from "#/repositories/friend.js"
import { PaymentRepository } from "#/repositories/payment.js"
import { ProductRepository } from "#/repositories/product.js"
import { ReceiptRepository } from "#/repositories/receipt.js"
import { RegistrationRepository } from "#/repositories/registration.js"
import { UserRepository } from "#/repositories/user.js"

const CACHE_TTL_MS = 30_000

class RoleCache {
	private ids = new Set<bigint>()
	private expiresAt = 0

	constructor(
		private readonly users: UserRepository,
		private readonly roles: UserRole[],
		private readonly extraIds: bigint[] = [],
	) {}

	async has(telegramId: bigint) {
		if (this.isExpired()) {
			await this.refresh()
		}
		return this.ids.has(telegramId)
	}

	async refresh() {
		this.ids = await this.users.listTelegramIdsByRoles(this.roles)
		for (const id of this.extraIds) {
			this.ids.add(id)
		}
		this.expiresAt = Date.now() + CACHE_TTL_MS
	}

	add(telegramId: bigint) {
		this.ids.add(telegramId)
	}

	remove(telegramId: bigint) {
		this.ids.delete(telegramId)
	}

	private isExpired() {
		return Date.now() > this.expiresAt
	}
}

export type AppContainer = {
	users: UserRepository
	events: EventRepository
	registrations: RegistrationRepository
	friends: FriendRepository
	payments: PaymentRepository
	products: ProductRepository
	receipts: ReceiptRepository
	adminCache: RoleCache
	sudoCache: RoleCache
	bartenderCache: RoleCache
	registerSessions: Map<bigint, RegisterSession>
	adminSessions: Map<bigint, AdminSession>
	bartenderSessions: Map<bigint, BartenderSession>
}

export const createContainer = (): AppContainer => {
	const users = new UserRepository()
	const events = new EventRepository()
	const registrations = new RegistrationRepository()
	const friends = new FriendRepository()
	const payments = new PaymentRepository()
	const products = new ProductRepository()
	const receipts = new ReceiptRepository()

	return {
		users,
		events,
		registrations,
		friends,
		payments,
		products,
		receipts,
		adminCache: new RoleCache(users, ["ADMIN", "SUDO"], [adminId]),
		sudoCache: new RoleCache(users, ["SUDO"], [adminId]),
		bartenderCache: new RoleCache(users, ["BARTENDER", "SUDO"], [adminId]),
		registerSessions: new Map(),
		adminSessions: new Map(),
		bartenderSessions: new Map(),
	}
}
```

- [ ] **Step 2: Lint**

```bash
bun run lint
```

Expected: no errors.

---

## Task 4: Guards — requireSudo, requireBartender, update requireAdmin

**Files:**
- Modify: `src/middleware/guards.ts`

- [ ] **Step 1: Rewrite guards.ts**

Replace the entire file:

```ts
import { Composer, type MiddlewareFn } from "grammy"

import type { BotContext } from "#/app/types.js"
import { MESSAGES } from "#/messages.js"

export const requirePrivateChat: MiddlewareFn<BotContext> = async (
	ctx,
	next,
) => {
	if (ctx.chat?.type !== "private") {
		return
	}
	await next()
}

export const requireActor: MiddlewareFn<BotContext> = async (ctx, next) => {
	if (!ctx.state.actor) {
		await ctx.reply(MESSAGES.user.something_went_wrong)
		return
	}
	await next()
}

export const requireNotBanned: MiddlewareFn<BotContext> = async (ctx, next) => {
	const actor = ctx.state.actor
	if (!actor) {
		await ctx.reply(MESSAGES.user.something_went_wrong)
		return
	}
	if (actor.role === "BANNED") {
		await ctx.reply(MESSAGES.user.blacklist)
		return
	}
	await next()
}

export const requireAdmin: MiddlewareFn<BotContext> = async (ctx, next) => {
	const actor = ctx.state.actor
	const cache = ctx.state.container?.adminCache
	if (!actor || !cache) {
		await ctx.reply(MESSAGES.user.something_went_wrong)
		return
	}
	const isAdmin =
		actor.role === "ADMIN" ||
		actor.role === "SUDO" ||
		(await cache.has(actor.telegramId))
	if (!isAdmin) {
		await ctx.reply(MESSAGES.user.something_went_wrong)
		return
	}
	await next()
}

export const requireSudo: MiddlewareFn<BotContext> = async (ctx, next) => {
	const actor = ctx.state.actor
	const cache = ctx.state.container?.sudoCache
	if (!actor || !cache) {
		await ctx.reply(MESSAGES.user.something_went_wrong)
		return
	}
	const isSudo = actor.role === "SUDO" || (await cache.has(actor.telegramId))
	if (!isSudo) {
		await ctx.reply(MESSAGES.user.something_went_wrong)
		return
	}
	await next()
}

export const requireBartender: MiddlewareFn<BotContext> = async (ctx, next) => {
	const actor = ctx.state.actor
	const cache = ctx.state.container?.bartenderCache
	if (!actor || !cache) {
		await ctx.reply(MESSAGES.user.something_went_wrong)
		return
	}
	const isBartender =
		actor.role === "BARTENDER" ||
		actor.role === "SUDO" ||
		(await cache.has(actor.telegramId))
	if (!isBartender) {
		await ctx.reply(MESSAGES.user.something_went_wrong)
		return
	}
	await next()
}

export const protectedPrivate = () => {
	const composer = new Composer<BotContext>()
	composer.use(requirePrivateChat)
	composer.use(requireActor)
	composer.use(requireNotBanned)
	return composer
}
```

- [ ] **Step 2: Lint**

```bash
bun run lint
```

Expected: no errors.

---

## Task 5: Main keyboard — bartender button + admin role-change gate

**Files:**
- Modify: `src/handlers/user/start.ts`
- Modify: `src/handlers/admin/flows.ts`

- [ ] **Step 1: Update buildMainReplyKeyboard to accept isBartender**

Replace `src/handlers/user/start.ts`:

```ts
import { Composer, InlineKeyboard, Keyboard } from "grammy"

import type { BotContext } from "#/app/types.js"
import { MESSAGES } from "#/messages.js"

const buildMainReplyKeyboard = (isAdmin: boolean, isBartender: boolean) => {
	const keyboard = new Keyboard().text(MESSAGES.keyboards.user.user_menu)

	if (isAdmin) {
		keyboard.text(MESSAGES.keyboards.user.admin_menu)
	}
	if (isBartender) {
		keyboard.text(MESSAGES.keyboards.user.bartender_menu)
	}

	return keyboard.resized()
}

export const buildUserInlineKeyboard = () => {
	return new InlineKeyboard()
		.text(MESSAGES.keyboards.user.register, "user_register")
		.text(MESSAGES.keyboards.user.my_status, "user_status")
		.row()
		.text(MESSAGES.keyboards.user.event_info, "user_event_info")
		.text(MESSAGES.keyboards.user.my_qr, "user_qr")
		.row()
		.text(MESSAGES.keyboards.user.cancel_booking, "user_cancel_booking")
}

export const userStartComposer = () => {
	const composer = new Composer<BotContext>()

	const showMenu = async (ctx: BotContext) => {
		const actor = ctx.state.actor
		const adminCache = ctx.state.container?.adminCache
		const bartenderCache = ctx.state.container?.bartenderCache
		const isAdmin =
			actor?.role === "ADMIN" ||
			actor?.role === "SUDO" ||
			(actor?.telegramId
				? (await adminCache?.has(actor.telegramId)) ?? false
				: false)
		const isBartender =
			actor?.role === "BARTENDER" ||
			actor?.role === "SUDO" ||
			(actor?.telegramId
				? (await bartenderCache?.has(actor.telegramId)) ?? false
				: false)

		await ctx.reply(MESSAGES.user.nav, {
			reply_markup: buildMainReplyKeyboard(isAdmin, isBartender),
		})
		await ctx.reply(MESSAGES.user.welcome, {
			parse_mode: "HTML",
			reply_markup: buildUserInlineKeyboard(),
		})
	}

	composer.command("start", showMenu)
	composer.hears(MESSAGES.keyboards.user.user_menu, showMenu)
	composer.callbackQuery("user_back", async (ctx) => {
		await showMenu(ctx)
		await ctx.answerCallbackQuery()
	})

	return composer
}
```

- [ ] **Step 2: Gate role-change keyboard to SUDO in admin/flows.ts**

In `src/handlers/admin/flows.ts`, find `showUserDetail` and replace it:

```ts
const showUserDetail = async (ctx: BotContext, telegramId: bigint) => {
	const container = getContainer(ctx)
	const actor = getActor(ctx)
	const user = await container.users.findByTelegramId(telegramId)
	if (!user) {
		await ctx.reply(
			MESSAGES.admin.user_not_found({ value: telegramId.toString() }),
		)
		return
	}
	const isSudo =
		actor.role === "SUDO" || (await container.sudoCache.has(actor.telegramId))
	await ctx.reply(
		MESSAGES.admin.user_detail({
			name: user.fullName ?? "-",
			tg_id: user.telegramId.toString(),
			username: user.username ?? "-",
			role: user.role,
		}),
		{
			parse_mode: "HTML",
			reply_markup: isSudo
				? userRoleKeyboard(user.telegramId)
				: new InlineKeyboard().text(
						MESSAGES.keyboards.admin.back_to_panel,
						"admin_panel",
					),
		},
	)
}
```

- [ ] **Step 3: Add SUDO check to admin_setrole callback + sync all three caches**

In `src/handlers/admin/flows.ts`, find the `admin_setrole` callback query handler and replace it:

```ts
composer.callbackQuery(
	/^admin_setrole_(\d+)_(ADMIN|BARTENDER|USER|BANNED)$/u,
	async (ctx) => {
		const container = getContainer(ctx)
		const actor = getActor(ctx)
		const isSudo =
			actor.role === "SUDO" ||
			(await container.sudoCache.has(actor.telegramId))
		if (!isSudo) {
			await ctx.answerCallbackQuery({
				text: MESSAGES.admin.something_went_wrong,
				show_alert: true,
			})
			return
		}
		const telegramId = BigInt(ctx.match[1] ?? "0")
		const role = ctx.match[2] as Exclude<UserRole, "SUDO">
		const updated = await container.users.updateRoleByTelegramId(
			telegramId,
			role,
		)
		if (!updated) {
			await ctx.answerCallbackQuery({
				text: MESSAGES.admin.something_went_wrong,
				show_alert: true,
			})
			return
		}
		if (role === "ADMIN") {
			container.adminCache.add(telegramId)
			container.sudoCache.remove(telegramId)
			container.bartenderCache.remove(telegramId)
		} else if (role === "BARTENDER") {
			container.adminCache.remove(telegramId)
			container.sudoCache.remove(telegramId)
			container.bartenderCache.add(telegramId)
		} else {
			container.adminCache.remove(telegramId)
			container.sudoCache.remove(telegramId)
			container.bartenderCache.remove(telegramId)
		}
		await ctx.reply(MESSAGES.admin.user_role_updated({ role }))
		await showUserDetail(ctx, telegramId)
		await ctx.answerCallbackQuery()
	},
)
```

- [ ] **Step 4: Lint**

```bash
bun run lint
```

Expected: no errors.

---

## Task 6: Messages — add bartender strings + keyboard labels

**Files:**
- Modify: `src/messages.ts`

- [ ] **Step 1: Add bartender keyboard labels to MESSAGES.keyboards**

In `src/messages.ts`, inside `keyboards.user`, add after `admin_menu`:
```ts
bartender_menu: "Меню бармена",
```

Add a new `keyboards.bartender` section after `keyboards.admin`:
```ts
bartender: {
	active_receipts: "📋 Активні замовлення",
	new_order: "🛒 Нове замовлення",
	send_payment_request: "📲 Надіслати запит",
	back: "⬅️ Назад",
},
```

- [ ] **Step 2: Add bartender message strings to MESSAGES**

Add a `bartender` section after `admin`:
```ts
bartender: {
	dashboard: `🍺 <b>МЕНЮ БАРМЕНА</b>\n━━━━━━━━━━━━━━━━━━`,
	active_receipts_header: `📋 <b>Активні замовлення</b>\n━━━━━━━━━━━━━━━━━━`,
	no_active_event: "ℹ️ Немає активної події.",
	no_active_receipts: "ℹ️ Немає активних замовлень.",
	enter_guest_id: "👤 Введіть @username або Telegram ID гостя:",
	guest_not_found: ({ value }: { value: TextValue }) =>
		`⚠️ Гостя '${value}' не знайдено.`,
	guest_not_registered: "⚠️ Гість не зареєстрований на поточну подію.",
	receipt_open: ({ total }: { total: TextValue }) =>
		`📋 Відкрите замовлення. Поточна сума: ${total} коп.`,
	receipt_created: "✅ Нове замовлення відкрито.",
	product_catalog: ({ total }: { total: TextValue }) =>
		`🛒 <b>Каталог продуктів</b>\nПоточна сума: ${total} коп.`,
	order_confirmed: ({ total }: { total: TextValue }) =>
		`✅ Замовлення підтверджено. Сума: ${total} коп.`,
	payment_request_sent: "📲 Запит на оплату надіслано.",
	payment_request_no_message:
		"⚠️ Шаблон повідомлення для оплати не налаштовано для цієї події.",
	proof_received:
		"✅ Підтвердження оплати отримано. Бармени повідомлені.",
	proof_broadcast_caption: ({
		name,
		total,
	}: {
		name: TextValue
		total: TextValue
	}) =>
		`💳 Підтвердження оплати від <b>${name}</b>\nСума: ${total} коп.`,
	payment_confirmed: "✅ Оплату підтверджено.",
	payment_rejected: "❌ Оплату відхилено.",
	already_handled: "ℹ️ Це вже оброблено.",
	receipt_card: ({
		id,
		total,
		status,
		user,
	}: {
		id: TextValue
		total: TextValue
		status: TextValue
		user: TextValue
	}) =>
		`📋 Замовлення #${id} — ${user}\n💰 Сума: ${total} коп.\n🔖 ${status}`,
},
```

- [ ] **Step 3: Lint**

```bash
bun run lint
```

Expected: no errors.

---

## Task 7: generatePaymentLink stub

**Files:**
- Create: `src/services/payment-link.ts`

- [ ] **Step 1: Create the file**

```ts
// src/services/payment-link.ts
// TODO: integrate real payment processor (LiqPay / Monobank)
export function generatePaymentLink(amount: number): string {
	return `https://pay.example.com/?amount=${amount}`
}
```

- [ ] **Step 2: Lint**

```bash
bun run lint
```

Expected: no errors.

---

## Task 8: Repository additions — PaymentRepository and ReceiptRepository

**Files:**
- Modify: `src/repositories/payment.ts`
- Modify: `src/repositories/receipt.ts`

- [ ] **Step 1: Add confirmIfPending to PaymentRepository**

In `src/repositories/payment.ts`, replace the import:
```ts
import { eq } from "drizzle-orm"
```
with:
```ts
import { and, eq } from "drizzle-orm"
```

Add this method inside `PaymentRepository` after `updateStatus`:

```ts
async confirmIfPending(
	paymentId: number,
	newStatus: "CONFIRMED" | "FAILED",
) {
	const [payment] = await db
		.update(payments)
		.set({ status: newStatus })
		.where(and(eq(payments.id, paymentId), eq(payments.status, "PENDING")))
		.returning()
	return payment ?? null
}
```

- [ ] **Step 2: Add three methods to ReceiptRepository**

In `src/repositories/receipt.ts`, add the `users` import. Find the existing import:
```ts
import { receiptEntries, receipts, registrations } from "#/infra/db/schema.js"
```
Replace with:
```ts
import { receiptEntries, receipts, registrations, users } from "#/infra/db/schema.js"
```

Then add these three methods inside `ReceiptRepository` after `listEntriesByReceipt`:

```ts
async findAwaitingPaymentByRegistration(registrationId: number) {
	const [receipt] = await db
		.select()
		.from(receipts)
		.where(
			and(
				eq(receipts.registration_id, registrationId),
				eq(receipts.status, "AWAITING_PAYMENT"),
			),
		)
		.limit(1)
	return receipt ?? null
}

async findByPaymentId(paymentId: number) {
	const [receipt] = await db
		.select()
		.from(receipts)
		.where(eq(receipts.payment_id, paymentId))
		.limit(1)
	return receipt ?? null
}

async listActiveByEventWithUsers(eventId: number) {
	return db
		.select({
			receipt: receipts,
			userFullName: users.full_name,
			userUsername: users.username,
			userTelegramId: users.telegram_id,
		})
		.from(receipts)
		.innerJoin(registrations, eq(receipts.registration_id, registrations.id))
		.innerJoin(users, eq(registrations.user_id, users.id))
		.where(
			and(
				eq(registrations.event_id, eventId),
				inArray(receipts.status, ["UNPAID", "AWAITING_PAYMENT"]),
			),
		)
		.orderBy(receipts.created_at)
}
```

Note: `users` must be imported from schema (step above). `inArray` is already imported.

- [ ] **Step 3: Lint**

```bash
bun run lint
```

Expected: no errors.

---

## Task 9: Bartender panel handler

**Files:**
- Create: `src/handlers/bartender/panel.ts`

- [ ] **Step 1: Create src/handlers/bartender/panel.ts**

```ts
import { Composer, InlineKeyboard } from "grammy"

import type { BotContext } from "#/app/types.js"
import { MESSAGES } from "#/messages.js"

const bartenderPanelKeyboard = () =>
	new InlineKeyboard()
		.text(
			MESSAGES.keyboards.bartender.active_receipts,
			"bartender_active_receipts",
		)
		.row()
		.text(MESSAGES.keyboards.bartender.new_order, "bartender_new_order")
		.row()
		.text(MESSAGES.keyboards.bartender.back, "bartender_back")

const openPanel = async (ctx: BotContext) => {
	await ctx.reply(MESSAGES.bartender.dashboard, {
		parse_mode: "HTML",
		reply_markup: bartenderPanelKeyboard(),
	})
}

export const bartenderPanelComposer = () => {
	const composer = new Composer<BotContext>()
	composer.hears(MESSAGES.keyboards.user.bartender_menu, openPanel)
	composer.callbackQuery("bartender_panel", async (ctx) => {
		await openPanel(ctx)
		await ctx.answerCallbackQuery()
	})
	return composer
}
```

- [ ] **Step 2: Lint**

```bash
bun run lint
```

Expected: no errors.

---

## Task 10: Bartender flows handler

**Files:**
- Create: `src/handlers/bartender/flows.ts`

- [ ] **Step 1: Create src/handlers/bartender/flows.ts**

```ts
import { Composer, InlineKeyboard } from "grammy"

import type { BartenderSession } from "#/app/session-types.js"
import type { BotContext } from "#/app/types.js"
import { adminId } from "#/constants.js"
import { generatePaymentLink } from "#/services/payment-link.js"
import { MESSAGES } from "#/messages.js"

const getActor = (ctx: BotContext) => {
	const actor = ctx.state.actor
	if (!actor) throw new Error("Actor not attached")
	return actor
}

const getContainer = (ctx: BotContext) => {
	const container = ctx.state.container
	if (!container) throw new Error("Container not attached")
	return container
}

const setSession = (ctx: BotContext, session: BartenderSession) => {
	const actor = getActor(ctx)
	const container = getContainer(ctx)
	container.bartenderSessions.set(actor.telegramId, session)
}

const clearSession = (ctx: BotContext) => {
	const actor = getActor(ctx)
	const container = getContainer(ctx)
	container.bartenderSessions.delete(actor.telegramId)
}

type Product = {
	id: number
	name: string
	price: number
	unit: string
}

const buildCatalogKeyboard = (
	products: Product[],
	pendingItems: Record<number, number>,
) => {
	const keyboard = new InlineKeyboard()
	let total = 0
	for (const product of products) {
		const count = pendingItems[product.id] ?? 0
		total += product.price * count
		keyboard
			.text(
				`${product.name} (${product.price} коп/${product.unit})`,
				"bartender_noop",
			)
			.text(count > 0 ? `+${count}` : "+", `bartender_add_${product.id}`)
			.row()
	}
	if (total > 0) {
		keyboard
			.text(
				`✅ Підтвердити (${total} коп.)`,
				"bartender_confirm_order",
			)
			.row()
	}
	keyboard.text(MESSAGES.keyboards.bartender.back, "bartender_panel")
	return { keyboard, total }
}

const showCatalog = async (
	ctx: BotContext,
	session: BartenderSession,
	products: Product[],
) => {
	const { keyboard, total } = buildCatalogKeyboard(products, session.pendingItems)
	const text = MESSAGES.bartender.product_catalog({ total })
	if (session.catalogMessageId) {
		try {
			await ctx.api.editMessageText(
				Number(getActor(ctx).telegramId),
				session.catalogMessageId,
				text,
				{ parse_mode: "HTML", reply_markup: keyboard },
			)
			return
		} catch {
			// message may have been deleted — fall through to send new
		}
	}
	const sent = await ctx.reply(text, {
		parse_mode: "HTML",
		reply_markup: keyboard,
	})
	session.catalogMessageId = sent.message_id
	setSession(ctx, session)
}

const showActiveReceipts = async (ctx: BotContext) => {
	const container = getContainer(ctx)
	const event = await container.events.findCurrentEvent()
	if (!event) {
		await ctx.reply(MESSAGES.bartender.no_active_event)
		return
	}
	const rows = await container.receipts.listActiveByEventWithUsers(event.id)
	if (rows.length === 0) {
		await ctx.reply(MESSAGES.bartender.no_active_receipts)
		return
	}
	const keyboard = new InlineKeyboard()
	const lines: string[] = []
	for (const row of rows) {
		const userName =
			row.userFullName ??
			(row.userUsername ? `@${row.userUsername}` : row.userTelegramId.toString())
		lines.push(
			MESSAGES.bartender.receipt_card({
				id: row.receipt.id,
				total: row.receipt.total,
				status: row.receipt.status,
				user: userName,
			}),
		)
		if (row.receipt.status === "UNPAID") {
			keyboard
				.text(
					`${MESSAGES.keyboards.bartender.send_payment_request} #${row.receipt.id}`,
					`bartender_send_request_${row.receipt.id}`,
				)
				.row()
		}
	}
	keyboard.text(MESSAGES.keyboards.bartender.back, "bartender_panel")
	await ctx.reply(`${MESSAGES.bartender.active_receipts_header}\n\n${lines.join("\n\n")}`, {
		parse_mode: "HTML",
		reply_markup: keyboard,
	})
}

export const bartenderFlowsComposer = () => {
	const composer = new Composer<BotContext>()

	// Active receipts
	composer.callbackQuery("bartender_active_receipts", async (ctx) => {
		await showActiveReceipts(ctx)
		await ctx.answerCallbackQuery()
	})

	// Start new order
	composer.callbackQuery("bartender_new_order", async (ctx) => {
		setSession(ctx, {
			step: "waiting_guest_id",
			receiptId: null,
			registrationId: null,
			pendingItems: {},
			catalogMessageId: null,
		})
		await ctx.reply(MESSAGES.bartender.enter_guest_id)
		await ctx.answerCallbackQuery()
	})

	// No-op for product label buttons
	composer.callbackQuery("bartender_noop", async (ctx) => {
		await ctx.answerCallbackQuery()
	})

	// Add product
	composer.callbackQuery(/^bartender_add_(\d+)$/u, async (ctx) => {
		const actor = getActor(ctx)
		const container = getContainer(ctx)
		const session = container.bartenderSessions.get(actor.telegramId)
		if (!session || session.step !== "browsing_products") {
			await ctx.answerCallbackQuery()
			return
		}
		const productId = Number.parseInt(ctx.match[1] ?? "0", 10)
		session.pendingItems[productId] = (session.pendingItems[productId] ?? 0) + 1
		setSession(ctx, session)
		const products = await container.products.listAll()
		await showCatalog(ctx, session, products)
		await ctx.answerCallbackQuery()
	})

	// Confirm order
	composer.callbackQuery("bartender_confirm_order", async (ctx) => {
		const actor = getActor(ctx)
		const container = getContainer(ctx)
		const session = container.bartenderSessions.get(actor.telegramId)
		if (!session || session.step !== "browsing_products" || !session.receiptId) {
			await ctx.answerCallbackQuery()
			return
		}
		const products = await container.products.listAll()
		const productMap = new Map(products.map((p) => [p.id, p]))
		for (const [productIdStr, count] of Object.entries(session.pendingItems)) {
			const productId = Number(productIdStr)
			const product = productMap.get(productId)
			if (!product || count <= 0) continue
			await container.receipts.upsertEntry({
				receiptId: session.receiptId,
				productId,
				unitCount: count,
				subtotal: product.price * count,
			})
		}
		const receipt = await container.receipts.recalculateTotal(session.receiptId)
		clearSession(ctx)
		await ctx.reply(
			MESSAGES.bartender.order_confirmed({ total: receipt?.total ?? 0 }),
		)
		await ctx.answerCallbackQuery()
	})

	// Send payment request
	composer.callbackQuery(/^bartender_send_request_(\d+)$/u, async (ctx) => {
		const container = getContainer(ctx)
		const receiptId = Number.parseInt(ctx.match[1] ?? "0", 10)
		const receipt = await container.receipts.findById(receiptId)
		if (!receipt || receipt.status !== "UNPAID") {
			await ctx.answerCallbackQuery({
				text: MESSAGES.bartender.already_handled,
				show_alert: true,
			})
			return
		}
		// Find registration → user → current event
		const registration = await container.registrations.findById(receipt.registration_id)
		if (!registration) {
			await ctx.answerCallbackQuery()
			return
		}
		const event = await container.events.findById(registration.event_id)
		if (!event?.receipt_payment_message) {
			await ctx.reply(MESSAGES.bartender.payment_request_no_message)
			await ctx.answerCallbackQuery()
			return
		}
		const link = generatePaymentLink(receipt.total)
		const message = event.receipt_payment_message.replace("{link}", link)
		// DM the guest
		const user = await container.users.findById(registration.user_id)
		if (user) {
			try {
				await ctx.api.sendMessage(Number(user.telegramId), message)
			} catch {
				// user may have blocked the bot
			}
		}
		await container.receipts.setStatus(receiptId, "AWAITING_PAYMENT")
		await ctx.reply(MESSAGES.bartender.payment_request_sent)
		await ctx.answerCallbackQuery()
	})

	// Confirm payment proof
	composer.callbackQuery(/^bartender_confirm_payment_(\d+)$/u, async (ctx) => {
		const container = getContainer(ctx)
		const paymentId = Number.parseInt(ctx.match[1] ?? "0", 10)
		const payment = await container.payments.confirmIfPending(paymentId, "CONFIRMED")
		if (!payment) {
			await ctx.answerCallbackQuery({
				text: MESSAGES.bartender.already_handled,
				show_alert: true,
			})
			try {
				await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() })
			} catch {}
			return
		}
		const receipt = await container.receipts.findByPaymentId(paymentId)
		if (receipt) {
			await container.receipts.setStatus(receipt.id, "PAID")
		}
		await ctx.answerCallbackQuery({
			text: MESSAGES.bartender.payment_confirmed,
			show_alert: true,
		})
		try {
			await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() })
		} catch {}
	})

	// Reject payment proof
	composer.callbackQuery(/^bartender_reject_payment_(\d+)$/u, async (ctx) => {
		const container = getContainer(ctx)
		const paymentId = Number.parseInt(ctx.match[1] ?? "0", 10)
		const payment = await container.payments.confirmIfPending(paymentId, "FAILED")
		if (!payment) {
			await ctx.answerCallbackQuery({
				text: MESSAGES.bartender.already_handled,
				show_alert: true,
			})
			try {
				await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() })
			} catch {}
			return
		}
		const receipt = await container.receipts.findByPaymentId(paymentId)
		if (receipt) {
			await container.receipts.setStatus(receipt.id, "UNPAID")
		}
		await ctx.answerCallbackQuery({
			text: MESSAGES.bartender.payment_rejected,
			show_alert: true,
		})
		try {
			await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() })
		} catch {}
	})

	// Back to bartender panel
	composer.callbackQuery("bartender_back", async (ctx) => {
		clearSession(ctx)
		await ctx.reply(MESSAGES.bartender.dashboard, { parse_mode: "HTML" })
		await ctx.answerCallbackQuery()
	})

	// Handle bartender text input (guest ID)
	composer.on("message:text", async (ctx, next) => {
		const actor = getActor(ctx)
		const container = getContainer(ctx)
		const session = container.bartenderSessions.get(actor.telegramId)
		if (!session || session.step !== "waiting_guest_id") {
			await next()
			return
		}
		const text = ctx.message.text.trim()
		const guestUser = await container.users.findByIdOrUsername(text)
		if (!guestUser) {
			await ctx.reply(MESSAGES.bartender.guest_not_found({ value: text }))
			return
		}
		const event = await container.events.findCurrentEvent()
		if (!event) {
			await ctx.reply(MESSAGES.bartender.no_active_event)
			clearSession(ctx)
			return
		}
		const registration = await container.registrations.findByUserAndEvent(
			guestUser.id,
			event.id,
		)
		if (!registration) {
			await ctx.reply(MESSAGES.bartender.guest_not_registered)
			return
		}
		let receipt = await container.receipts.findUnpaidByRegistration(registration.id)
		if (receipt) {
			await ctx.reply(MESSAGES.bartender.receipt_open({ total: receipt.total }))
		} else {
			receipt = await container.receipts.createUnpaid(registration.id)
			await ctx.reply(MESSAGES.bartender.receipt_created)
		}
		if (!receipt) {
			clearSession(ctx)
			return
		}
		session.step = "browsing_products"
		session.receiptId = receipt.id
		session.registrationId = registration.id
		session.pendingItems = {}
		session.catalogMessageId = null
		setSession(ctx, session)
		const products = await container.products.listAll()
		await showCatalog(ctx, session, products)
	})

	return composer
}
```

- [ ] **Step 2: Lint**

```bash
bun run lint
```

Expected: no errors (note `findById` on registrations and users repositories will be added in step 3 below).

---

## Task 11: Add missing repository methods used by bartender flows

**Files:**
- Modify: `src/repositories/registration.ts`
- Modify: `src/repositories/user.ts`

The bartender flows call `container.registrations.findById(id)` and `container.users.findById(id)`. These methods need to exist.

- [ ] **Step 1: Add findById to RegistrationRepository**

In `src/repositories/registration.ts`, add the following method inside the class (after any existing method):

```ts
async findById(id: number) {
	const [row] = await db
		.select()
		.from(registrations)
		.where(eq(registrations.id, id))
		.limit(1)
	return row ?? null
}
```

Check the existing imports in `src/repositories/registration.ts` — `eq` should already be imported from `drizzle-orm`.

- [ ] **Step 2: Add findById to UserRepository**

In `src/repositories/user.ts`, add the following method inside the `UserRepository` class, after `findByTelegramId`:

```ts
async findById(id: number) {
	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.id, id))
		.limit(1)
	return user ? toActor(user) : null
}
```

- [ ] **Step 3: Lint**

```bash
bun run lint
```

Expected: no errors.

---

## Task 12: Extend user payment proof flow for receipts

**Files:**
- Modify: `src/handlers/user/flows.ts`

When a user uploads a photo or document, and they are **not** in a `waiting_payment` registration session, the bot should check if they have an `AWAITING_PAYMENT` receipt for the current event and handle it as a receipt payment proof.

- [ ] **Step 1: Add handleReceiptPaymentProof helper in flows.ts**

In `src/handlers/user/flows.ts`, add the following imports at the top:

```ts
import { InlineKeyboard } from "grammy"
import { adminId } from "#/constants.js"
import { generatePaymentLink } from "#/services/payment-link.js"
```

(Keep all existing imports — add these in addition. `InlineKeyboard` is already imported as part of `grammy`. Add `adminId` and `generatePaymentLink` imports.)

Then add the `handleReceiptPaymentProof` helper before `userFlowsComposer`:

```ts
const handleReceiptPaymentProof = async (
	ctx: BotContext,
	receiptId: number,
	receiptTotal: number,
	file: { fileId: string; fileUniqueId: string; mimetype: string | null },
) => {
	const actor = getActor(ctx)
	const container = getContainer(ctx)
	const duplicate = await container.payments.findByFileUniqueId(file.fileUniqueId)
	if (duplicate) {
		await ctx.reply(MESSAGES.user.payment_duplicate)
		return
	}
	const payment = await container.payments.createPending({
		type: "RECEIPT",
		amount: receiptTotal,
		fileId: file.fileId,
		fileUniqueId: file.fileUniqueId,
		mimetype: file.mimetype,
	})
	if (!payment) return
	await container.receipts.setPaymentId(receiptId, payment.id)
	// Broadcast to all BARTENDER | SUDO users (+ hardcoded adminId)
	const bartenderIds = await container.users.listTelegramIdsByRoles([
		"BARTENDER",
		"SUDO",
	])
	bartenderIds.add(adminId)
	const confirmKeyboard = new InlineKeyboard()
		.text("✅ Підтвердити", `bartender_confirm_payment_${payment.id}`)
		.text("❌ Відхилити", `bartender_reject_payment_${payment.id}`)
	for (const bartenderId of bartenderIds) {
		try {
			await ctx.api.forwardMessage(
				Number(bartenderId),
				ctx.chat!.id,
				ctx.message!.message_id,
			)
			await ctx.api.sendMessage(
				Number(bartenderId),
				MESSAGES.bartender.proof_broadcast_caption({
					name:
						actor.fullName ??
						(actor.username ? `@${actor.username}` : actor.telegramId.toString()),
					total: receiptTotal,
				}),
				{ parse_mode: "HTML", reply_markup: confirmKeyboard },
			)
		} catch {
			// bartender may have blocked the bot
		}
	}
	await ctx.reply(MESSAGES.bartender.proof_received)
}
```

- [ ] **Step 2: Extend the photo handler to check for receipt payments**

Find the existing `composer.on("message:photo", ...)` handler. Replace it with:

```ts
composer.on("message:photo", async (ctx, next) => {
	const actor = ctx.state.actor
	const container = ctx.state.container
	if (!actor || !container) {
		await next()
		return
	}
	const session = container.registerSessions.get(actor.telegramId)
	if (session?.step === "waiting_payment") {
		const largest = ctx.message.photo.at(-1)
		if (!largest) {
			await next()
			return
		}
		await finalizeRegistration(ctx, {
			fileId: largest.file_id,
			fileUniqueId: largest.file_unique_id,
			mimetype: "image/jpeg",
		})
		return
	}
	// Check for AWAITING_PAYMENT receipt
	const event = await container.events.findCurrentEvent()
	if (event) {
		const registration = await container.registrations.findByUserAndEvent(
			actor.id,
			event.id,
		)
		if (registration) {
			const receipt = await container.receipts.findAwaitingPaymentByRegistration(
				registration.id,
			)
			if (receipt) {
				const largest = ctx.message.photo.at(-1)
				if (largest) {
					await handleReceiptPaymentProof(ctx, receipt.id, receipt.total, {
						fileId: largest.file_id,
						fileUniqueId: largest.file_unique_id,
						mimetype: "image/jpeg",
					})
					return
				}
			}
		}
	}
	await next()
})
```

- [ ] **Step 3: Extend the document handler similarly**

Find the existing `composer.on("message:document", ...)` handler. Replace it with:

```ts
composer.on("message:document", async (ctx, next) => {
	const actor = ctx.state.actor
	const container = ctx.state.container
	if (!actor || !container) {
		await next()
		return
	}
	const session = container.registerSessions.get(actor.telegramId)
	if (session?.step === "waiting_payment") {
		await finalizeRegistration(ctx, {
			fileId: ctx.message.document.file_id,
			fileUniqueId: ctx.message.document.file_unique_id,
			mimetype: ctx.message.document.mime_type ?? null,
		})
		return
	}
	// Check for AWAITING_PAYMENT receipt
	const event = await container.events.findCurrentEvent()
	if (event) {
		const registration = await container.registrations.findByUserAndEvent(
			actor.id,
			event.id,
		)
		if (registration) {
			const receipt = await container.receipts.findAwaitingPaymentByRegistration(
				registration.id,
			)
			if (receipt) {
				await handleReceiptPaymentProof(ctx, receipt.id, receipt.total, {
					fileId: ctx.message.document.file_id,
					fileUniqueId: ctx.message.document.file_unique_id,
					mimetype: ctx.message.document.mime_type ?? null,
				})
				return
			}
		}
	}
	await next()
})
```

- [ ] **Step 4: Lint**

```bash
bun run lint
```

Expected: no errors.

---

## Task 13: Wire bartender routes in router.ts

**Files:**
- Modify: `src/bot/router.ts`

- [ ] **Step 1: Rewrite router.ts**

```ts
import { Bot, Composer } from "grammy"

import { type AppContainer, createContainer } from "#/app/container.js"
import type { BotContext } from "#/app/types.js"
import { botToken } from "#/constants.js"
import { adminFlowsComposer } from "#/handlers/admin/flows.js"
import { adminPanelComposer } from "#/handlers/admin/panel.js"
import { bartenderFlowsComposer } from "#/handlers/bartender/flows.js"
import { bartenderPanelComposer } from "#/handlers/bartender/panel.js"
import { userFlowsComposer } from "#/handlers/user/flows.js"
import { userStartComposer } from "#/handlers/user/start.js"
import { attachActor, withContainer } from "#/middleware/context.js"
import {
	protectedPrivate,
	requireAdmin,
	requireBartender,
} from "#/middleware/guards.js"

export type BotRuntime = {
	bot: Bot<BotContext>
	container: AppContainer
}

export const createBotRuntime = (): BotRuntime => {
	const container = createContainer()
	const bot = new Bot<BotContext>(botToken)

	bot.use(withContainer(container))
	bot.use(attachActor)

	const privateRoutes = protectedPrivate()
	privateRoutes.use(userStartComposer())
	privateRoutes.use(userFlowsComposer())

	const adminRoutes = new Composer<BotContext>()
	adminRoutes.use(requireAdmin)
	adminRoutes.use(adminPanelComposer())
	adminRoutes.use(adminFlowsComposer())

	const bartenderRoutes = new Composer<BotContext>()
	bartenderRoutes.use(requireBartender)
	bartenderRoutes.use(bartenderPanelComposer())
	bartenderRoutes.use(bartenderFlowsComposer())

	privateRoutes.use(adminRoutes)
	privateRoutes.use(bartenderRoutes)
	bot.use(privateRoutes)

	bot.catch((error) => {
		console.error("Unhandled Telegram update error", error.error)
	})

	return { bot, container }
}
```

- [ ] **Step 2: Lint**

```bash
bun run lint
```

Expected: no errors.

- [ ] **Step 3: Verify TypeScript build**

```bash
bun build src/index.ts --outdir /tmp/build-check 2>&1 | head -40
```

Expected: zero TypeScript errors. Warnings about unused vars (if any) are OK.

---

## Verification Checklist

Run these checks after all tasks complete:

```bash
# 1. Lint clean
bun run lint

# 2. Build clean
bun build src/index.ts --outdir /tmp/build-check 2>&1 | head -40

# 3. Manual role checks (set role in DB, verify keyboard):
# - Set user to BARTENDER → /start → "Меню бармена" button visible
# - Set user to ADMIN → /start → "Меню бармена" NOT visible
# - Set user to SUDO → /start → both "Меню адміністратора" and "Меню бармена" visible
# - As plain ADMIN, open user detail → role-change buttons NOT shown
# - As SUDO, open user detail → role-change buttons visible

# 4. Bartender order flow:
# - Login as BARTENDER, tap "Меню бармена" → panel opens
# - Tap "Нове замовлення" → enter guest @username
# - Add products, confirm → receipt total recalculated
# - Tap "Активні замовлення" → receipt appears with "Надіслати запит" button
# - Tap "Надіслати запит" → guest receives DM with payment link
#   (requires event.receipt_payment_message to be set in DB)

# 5. Payment proof flow:
# - Guest uploads photo/PDF → broadcast forwarded to all BARTENDER|SUDO users
# - Tap "✅ Підтвердити" → payment CONFIRMED, receipt PAID
# - Second bartender taps any button → "Already handled" shown

# 6. Already-handled idempotency:
# - After confirming, try confirming again → shows alert "ℹ️ Це вже оброблено."
```
