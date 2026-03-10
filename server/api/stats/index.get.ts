import { sql } from "~~/server/utils/db";
import type { StatsIndexResponse, EventSummaryRow } from "~/types/stats";

interface TotalsRow {
  total_events: number;
  total_registrations: number;
  total_checked_in: number;
}

interface EventSummaryDbRow {
  id: number;
  name: string;
  status: string;
  starts_at: Date;
  max_slots: number;
  registrations_count: number;
  checked_in_count: number;
  confirmed_payments: number;
  friends_count: number;
}

export default defineEventHandler(
  async (event): Promise<StatsIndexResponse> => {
    const dbUser = event.context.auth?.dbUser;
    if (dbUser?.role !== "ADMIN") {
      throw createError({ statusCode: 403, message: "Доступ заборонено" });
    }

    const [totals] = await sql<[TotalsRow]>`
      SELECT
        (SELECT COUNT(*)::int FROM events)                                           AS total_events,
        (SELECT COUNT(*)::int FROM registrations)                                    AS total_registrations,
        (SELECT COUNT(*)::int FROM registrations WHERE checked_in_at IS NOT NULL)    AS total_checked_in
    `;

    const eventRows = await sql<EventSummaryDbRow[]>`
      SELECT
        e.id,
        e.name,
        e.status,
        e.starts_at,
        e.max_slots,
        COUNT(r.id)::int                                                          AS registrations_count,
        COUNT(r.checked_in_at)::int                                               AS checked_in_count,
        COUNT(*) FILTER (WHERE p.status = 'CONFIRMED')::int                    AS confirmed_payments,
        (SELECT COUNT(*)::int FROM friends f JOIN registrations r2 ON f.registration_id = r2.id WHERE r2.event_id = e.id) AS friends_count
      FROM events e
      LEFT JOIN registrations r ON r.event_id = e.id
      LEFT JOIN LATERAL (
        SELECT
          file_id,
          mimetype,
          status
        FROM payments
        WHERE payments.registration_id = r.id
        ORDER BY created_at DESC
        LIMIT 1
      ) p ON TRUE
      GROUP BY e.id
      ORDER BY e.starts_at DESC
    `;

    return {
      totalEvents: totals.total_events,
      totalRegistrations: totals.total_registrations,
      totalCheckedIn: totals.total_checked_in,
      events: eventRows.map(
        (r): EventSummaryRow => ({
          id: r.id,
          name: r.name,
          status: r.status as EventSummaryRow["status"],
          startsAt: r.starts_at.toISOString(),
          maxSlots: r.max_slots,
          registrationsCount: r.registrations_count,
          checkedInCount: r.checked_in_count,
          confirmedPayments: r.confirmed_payments,
          friendsCount: r.friends_count,
        }),
      ),
    };
  },
);
