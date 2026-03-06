import { sql } from "~~/server/utils/db";
import { uuidRegex } from "~/utils/redirects";

import type {
  FullValidationResponse,
  OKValidationResponse,
  AlreadyScannedResponse,
  BannedResponse,
  NotFoundResponse,
  ErrorResponse,
  NotOpenResponse,
} from "~/types/validation";
import type { EventStatus } from "~/types/event";

interface RegistrationRow {
  id: number;
  user_id: number;
  event_id: number;
  checked_in_at: string | null;
  full_name: string;
  user_role: string;
  username: string | null;
  event_name: string;
  event_date: string;
  eid: number;
  event_status: EventStatus;
  friends_count: number;
  payment_file_id: string | null;
}

interface VisitedCountRow {
  count: number;
}

export default defineEventHandler(
  async (event): Promise<FullValidationResponse> => {
    const qrToken = event.context.params?.qr;

    if (!qrToken || !uuidRegex.test(qrToken)) {
      return {
        status: "ERROR",
        message: "❌ Невірний формат QR-коду",
      } satisfies ErrorResponse;
    }

    const scannedBy: number | null = event.context.auth?.dbUser?.id ?? null;

    // Look up registration by QR token with user and event details
    const [registration] = await sql<RegistrationRow[]>`
      SELECT
        r.id,
        r.user_id,
        r.event_id,
        r.checked_in_at,
        u.full_name,
        u.role AS user_role,
        u.username,
        e.name  AS event_name,
        e.starts_at AS event_date,
        e.id    AS eid,
        e.status AS event_status,
        (SELECT COUNT(*)::int FROM friends f WHERE f.registration_id = r.id) AS friends_count,
        (SELECT p.file_id FROM payments p WHERE p.registration_id = r.id ORDER BY p.created_at DESC LIMIT 1) AS payment_file_id
      FROM registrations r
      JOIN users  u ON r.user_id  = u.id
      JOIN events e ON r.event_id = e.id
      WHERE r.qr_token = ${qrToken}
    `;

    if (!registration) {
      await sql`
        INSERT INTO scans (scanned_by, status, scanned_at)
        VALUES (${scannedBy}, 'NOT_FOUND', now())
      `;
      return {
        status: "NOT_FOUND",
        message: "❌ QR-код не знайдено в системі",
      } satisfies NotFoundResponse;
    }

    if (registration.event_status !== "ONGOING") {
      return {
        status: "NOT_OPEN",
        message: "⚠️ Захід ще не відкритий для сканування",
        event: {
          id: registration.eid.toString(),
          name: registration.event_name,
          date: registration.event_date,
          status: registration.event_status,
        },
      } satisfies NotOpenResponse;
    }

    // Count previously visited events for this user
    const [previousRegistrations] = await sql<VisitedCountRow[]>`
      SELECT COUNT(DISTINCT event_id)::int AS count
      FROM registrations
      WHERE user_id = ${registration.user_id} AND checked_in_at IS NOT NULL
    `;
    const visitedEvents = Number(previousRegistrations?.count ?? 0);

    const eventDetails = {
      id: registration.eid.toString(),
      name: registration.event_name,
      date: registration.event_date,
    };

    const friendsCount = Number(registration.friends_count ?? 0);

    // Banned user
    if (registration.user_role === "BANNED") {
      await sql`
        INSERT INTO scans (registration_id, scanned_by, status, scanned_at)
        VALUES (${registration.id}, ${scannedBy}, 'BANNED', now())
      `;
      return {
        status: "BANNED",
        message: "❌ Користувач заблокований",
        fullName: registration.full_name,
        visitedEvents,
        friendsCount,
      } satisfies BannedResponse;
    }

    // Already checked in
    if (registration.checked_in_at) {
      return {
        status: "ALREADY_SCANNED",
        message: "🟣 QR-код вже було скановано",
        fullName: registration.full_name,
        event: eventDetails,
        visitedEvents,
        scannedAt: String(registration.checked_in_at),
        friendsCount,
        paymentFileId: registration.payment_file_id ?? null,
      } satisfies AlreadyScannedResponse;
    }

    // Success — check in the user
    await sql`
      UPDATE registrations
      SET checked_in_at = now()
      WHERE id = ${registration.id}
    `;

    await sql`
      INSERT INTO scans (registration_id, scanned_by, status, scanned_at)
      VALUES (${registration.id}, ${scannedBy}, 'OK', now())
    `;

    return {
      status: "OK",
      message: "✅ Успішно зареєстровано та перевірено",
      fullName: registration.full_name,
      event: eventDetails,
      visitedEvents: visitedEvents + 1,
      friendsCount,
      paymentFileId: registration.payment_file_id ?? null,
    } satisfies OKValidationResponse;
  },
);
