import type { EventStatus } from "./event";

// Shared

export interface FriendRow {
  name: string;
  username: string | null;
}

export interface PaymentInfo {
  fileId: string | null;
  mimetype: string | null;
  status: "PENDING" | "CONFIRMED" | "FAILED" | "REFUNDED";
  amount: number;
}

export interface VisitorRow {
  registrationId: number;
  fullName: string | null;
  username: string | null;
  userRole: string;
  checkedInAt: string | null;
  registeredAt: string | null;
  friendsCount: number;
  friends: FriendRow[];
  payment: PaymentInfo | null;
}

// /api/stats (index)

export interface EventSummaryRow {
  id: number;
  name: string;
  status: EventStatus;
  startsAt: string;
  maxSlots: number;
  registrationsCount: number;
  checkedInCount: number;
  confirmedPayments: number;
  friendsCount: number;
}

export interface StatsIndexResponse {
  totalEvents: number;
  totalRegistrations: number;
  totalCheckedIn: number;
  events: EventSummaryRow[];
}

// /api/stats/[event]

export interface EventDetail {
  id: number;
  name: string;
  location: string | null;
  startsAt: string;
  maxSlots: number;
  status: EventStatus;
  registrationsCount: number;
  checkedInCount: number;
  friendsCount: number;
  checkedInFriendsCount: number;
}

export interface StatsEventResponse {
  event: EventDetail;
  visitors: VisitorRow[];
}

// /api/me

export interface MeResponse {
  role: string;
  fullName: string;
}
