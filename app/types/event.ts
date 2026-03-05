export type EventStatus =
  | "DRAFT"
  | "REGISTRATION_OPEN"
  | "REGISTRATION_CLOSED"
  | "ONGOING"
  | "FINISHED"
  | "CANCELLED";

export interface EventDetails {
  id: string;
  name: string;
  date: string;
  status?: EventStatus;
}
