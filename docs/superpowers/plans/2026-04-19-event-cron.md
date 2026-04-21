# Event Cron — Auto Status Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically transition event statuses when their `starts_at` / `ends_at` timestamps are reached, and notify admins via the bot.

**Architecture:** A `setInterval`-based cron runs every 60 seconds inside the existing Bun process. On each tick it queries two sets of events — ones due to start (status `REGISTRATION_OPEN` or `REGISTRATION_CLOSED`, `starts_at ≤ now`) and ones due to end (status `ONGOING`, `ends_at ≤ now`) — transitions each with the existing `setStatus`, then sends a DM to every `ADMIN`/`SUDO` user. An immediate tick on startup handles any transitions missed while the bot was offline.

**Tech Stack:** Drizzle ORM, Grammy `Api`, Bun `setInterval`, Biome, TypeScript

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/repositories/event.ts` | Add `findDueToStart`, `findDueToEnd` |
| Modify | `src/messages.ts` | Add `event_started`, `event_finished` to `admin` section |
| Create | `src/services/event-cron.ts` | Tick logic: query → transition → notify |
| Modify | `src/index.ts` | Wire cron: immediate tick + `setInterval` |

---

## Task 1: EventRepository — findDueToStart + findDueToEnd

**Files:**
- Modify: `src/repositories/event.ts`

- [ ] **Step 1: Add `inArray`, `isNotNull`, `lte` to the drizzle-orm import**

In `src/repositories/event.ts`, replace the import line:

```ts
import { and, asc, desc, eq, gte, sql } from "drizzle-orm"
```

with:

```ts
import { and, asc, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm"
```

- [ ] **Step 2: Add `findDueToStart` method**

Append inside the `EventRepository` class, after `autoCloseIfFull`:

```ts
async findDueToStart(now: Date) {
	return db
		.select()
		.from(events)
		.where(
			and(
				inArray(events.status, ["REGISTRATION_OPEN", "REGISTRATION_CLOSED"]),
				lte(events.starts_at, now),
			),
		)
		.orderBy(asc(events.starts_at))
}
```

- [ ] **Step 3: Add `findDueToEnd` method**

Append inside the `EventRepository` class, after `findDueToStart`:

```ts
async findDueToEnd(now: Date) {
	return db
		.select()
		.from(events)
		.where(
			and(
				eq(events.status, "ONGOING"),
				isNotNull(events.ends_at),
				lte(events.ends_at, now),
			),
		)
		.orderBy(asc(events.ends_at))
}
```

- [ ] **Step 4: Lint**

```bash
bun run lint
```

Expected: no errors.

---

## Task 2: Messages — event_started + event_finished

**Files:**
- Modify: `src/messages.ts`

- [ ] **Step 1: Add two messages to the `admin` section**

In `src/messages.ts`, inside the `admin` object, find the line:

```ts
		action_cancelled: "❌ Дію скасовано.",
```

Add two new lines directly above it:

```ts
		event_started: ({ name }: { name: TextValue }) =>
			`▶️ <b>Подія розпочалась:</b> ${name}`,
		event_finished: ({ name }: { name: TextValue }) =>
			`✅ <b>Подія завершилась:</b> ${name}`,
```

- [ ] **Step 2: Lint**

```bash
bun run lint
```

Expected: no errors.

---

## Task 3: EventCronService

**Files:**
- Create: `src/services/event-cron.ts`

- [ ] **Step 1: Create `src/services/event-cron.ts`**

```ts
import type { Api } from "grammy"

import type { AppContainer } from "#/app/container.js"
import { sudoId } from "#/constants.js"
import { MESSAGES } from "#/messages.js"

const notifyAdmins = async (
	api: Api,
	container: AppContainer,
	text: string,
) => {
	const ids = await container.users.listTelegramIdsByRoles(["ADMIN", "SUDO"])
	ids.add(sudoId)
	for (const id of ids) {
		try {
			await api.sendMessage(Number(id), text, { parse_mode: "HTML" })
		} catch {
			// admin may have blocked the bot
		}
	}
}

export const createEventCron = (api: Api, container: AppContainer) => {
	const tick = async () => {
		const now = new Date()

		const toStart = await container.events.findDueToStart(now)
		for (const event of toStart) {
			await container.events.setStatus(event.id, "ONGOING")
			await notifyAdmins(
				api,
				container,
				MESSAGES.admin.event_started({ name: event.name }),
			)
		}

		const toEnd = await container.events.findDueToEnd(now)
		for (const event of toEnd) {
			await container.events.setStatus(event.id, "FINISHED")
			await notifyAdmins(
				api,
				container,
				MESSAGES.admin.event_finished({ name: event.name }),
			)
		}
	}

	return { tick }
}
```

- [ ] **Step 2: Lint**

```bash
bun run lint
```

Expected: no errors.

---

## Task 4: Wire cron into index.ts

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Import `createEventCron` and wire it**

Replace the entire `src/index.ts` with:

```ts
import process from "node:process"
import { logger } from "@bogeychan/elysia-logger"
import { Elysia } from "elysia"
import { webhookCallback } from "grammy"

import { createBotRuntime } from "#/bot/router.js"
import { hostname, logLevel, port, webhookUrl } from "#/constants.js"
import { createEventCron } from "#/services/event-cron.js"

const CRON_INTERVAL_MS = 60_000

const main = async () => {
	const { bot, container } = createBotRuntime()

	await bot.api.setWebhook(webhookUrl, {
		drop_pending_updates: true,
	})

	const { tick } = createEventCron(bot.api, container)
	tick().catch((error) => console.error("Event cron initial tick error:", error))
	setInterval(
		() => tick().catch((error) => console.error("Event cron tick error:", error)),
		CRON_INTERVAL_MS,
	)

	const callback = webhookCallback(bot, "elysia")

	const app = new Elysia()
		.use(logger({ level: logLevel }))
		.post("/webhook", callback)
		.listen({ port, hostname })

	console.log(
		`HTTP server with the Telegram webhook is running on ${app.server?.url}`,
	)
}

if (import.meta.main) {
	// Keep chained because bun --compile doesn't support top-level await yet
	main().catch((error) => {
		console.error("Error running the server:", error)
		process.exit(1)
	})
}
```

- [ ] **Step 2: Lint**

```bash
bun run lint
```

Expected: no errors.

- [ ] **Step 3: Verify build**

```bash
bun build src/index.ts --outdir /tmp/build-check --target bun 2>&1 | grep -E "error|warning"
```

Expected: no output (zero errors, zero warnings).

---

## Verification Checklist

Manual tests (requires a running bot + DB):

```
# 1. Verify auto-start:
#    - Create event with starts_at = now - 1 minute, status = REGISTRATION_OPEN
#    - Start bot → immediate tick runs → event status → ONGOING
#    - All ADMIN/SUDO users receive "▶️ Подія розпочалась: <name>"

# 2. Verify auto-finish:
#    - Set event status = ONGOING, ends_at = now - 1 minute
#    - Start bot → immediate tick runs → event status → FINISHED
#    - All ADMIN/SUDO users receive "✅ Подія завершилась: <name>"

# 3. Verify idempotency:
#    - Run tick twice on same already-transitioned event → no double notification
#    (status no longer matches query conditions after first transition)

# 4. Verify REGISTRATION_CLOSED → ONGOING:
#    - Event with status = REGISTRATION_CLOSED and starts_at in the past
#    - Tick runs → status → ONGOING

# 5. No ends_at → never auto-finishes:
#    - Event with status = ONGOING, ends_at = NULL
#    - Tick runs → status unchanged
```
