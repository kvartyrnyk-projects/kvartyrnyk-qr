import { sql } from "~~/server/utils/db";
import type {
  StatsEventResponse,
  VisitorRow,
  FriendRow,
  PaymentInfo,
} from "~/types/stats";

interface EventDbRow {
  id: number;
  name: string;
  location: string | null;
  starts_at: Date;
  max_slots: number;
  status: string;
}

interface VisitorDbRow {
  registration_id: number;
  full_name: string | null;
  username: string | null;
  user_role: string;
  checked_in_at: Date | null;
  created_at: Date | null;
  friends_count: number;
  payment_file_id: string | null;
  payment_mimetype: string | null;
  payment_status: string | null;
  payment_amount: number | null;
}

interface FriendDbRow {
  registration_id: number;
  name: string;
  username: string | null;
}

export default defineEventHandler(
  async (event): Promise<StatsEventResponse> => {
    const dbUser = event.context.auth?.dbUser;
    if (dbUser?.role !== "ADMIN") {
      throw createError({ statusCode: 403, message: "Доступ заборонено" });
    }

    const rawId = event.context.params?.event;
    const eventId = Number(rawId);
    if (!rawId || Number.isNaN(eventId)) {
      throw createError({ statusCode: 400, message: "Невірний ID події" });
    }

    const [eventRow] = await sql<EventDbRow[]>`
      SELECT id, name, location, starts_at, max_slots, status
      FROM events
      WHERE id = ${eventId}
    `;
    if (!eventRow) {
      throw createError({ statusCode: 404, message: "Подія не знайдена" });
    }

    const visitorRows = await sql<VisitorDbRow[]>`
      SELECT
        r.id                                                                         AS registration_id,
        u.full_name,
        u.username,
        u.role                                                                       AS user_role,
        r.checked_in_at,
        r.created_at,
        (SELECT COUNT(*)::int FROM friends f WHERE f.registration_id = r.id)        AS friends_count,
        p.file_id                                                                    AS payment_file_id,
        p.mimetype                                                                   AS payment_mimetype,
        p.status                                                                     AS payment_status,
        p.amount                                                                     AS payment_amount
      FROM registrations r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT file_id, mimetype, status, amount
        FROM payments
        WHERE registration_id = r.id
        ORDER BY created_at DESC
        LIMIT 1
      ) p ON true
      WHERE r.event_id = ${eventId}
      ORDER BY r.created_at ASC
    `;

    const friendRows = await sql<FriendDbRow[]>`
      SELECT f.registration_id, f.name, f.username
      FROM friends f
      JOIN registrations r ON f.registration_id = r.id
      WHERE r.event_id = ${eventId}
      ORDER BY f.id
    `;

    // Group friends by registration_id
    const friendsByReg = new Map<number, FriendRow[]>();
    for (const f of friendRows) {
      const list = friendsByReg.get(f.registration_id) ?? [];
      list.push({ name: f.name, username: f.username });
      friendsByReg.set(f.registration_id, list);
    }

    const registrationsCount = visitorRows.length;
    const checkedInCount = visitorRows.filter((v) => v.checked_in_at).length;

    const visitors: VisitorRow[] = visitorRows.map((v) => ({
      registrationId: v.registration_id,
      fullName: v.full_name,
      username: v.username,
      userRole: v.user_role,
      checkedInAt: v.checked_in_at ? String(v.checked_in_at) : null,
      registeredAt: v.created_at ? String(v.created_at) : null,
      friendsCount: v.friends_count,
      friends: friendsByReg.get(v.registration_id) ?? [],
      payment:
        v.payment_status == null
          ? null
          : {
              fileId: v.payment_file_id,
              mimetype: v.payment_mimetype,
              status: v.payment_status as PaymentInfo["status"],
              amount: v.payment_amount ?? 0,
            },
    }));

    return {
      event: {
        id: eventRow.id,
        name: eventRow.name,
        location: eventRow.location,
        startsAt: String(eventRow.starts_at),
        maxSlots: eventRow.max_slots,
        status: eventRow.status as StatsEventResponse["event"]["status"],
        registrationsCount,
        checkedInCount,
      },
      visitors,
    };
  },
);
