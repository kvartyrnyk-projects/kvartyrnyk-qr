import type { EventDetails } from "./event";

export type ValidationStatus =
  | "OK"
  | "ALREADY_SCANNED"
  | "NOT_OPEN"
  | "BANNED"
  | "NOT_FOUND"
  | "ERROR";

export interface ValidationResponse {
  status: ValidationStatus;
  message: string;
}

export type SuccesfulValidationResponse = ValidationResponse & {
  fullName: string;
  event: EventDetails;
  visitedEvents: number;
  friendsCount: number;
  paymentFileId?: string | null;
};

export type OKValidationResponse = SuccesfulValidationResponse & {
  status: "OK";
};

export type AlreadyScannedResponse = SuccesfulValidationResponse & {
  status: "ALREADY_SCANNED";
  scannedAt: string;
};

export type NotOpenResponse = ValidationResponse & {
  status: "NOT_OPEN";
  event: EventDetails;
};

export type BannedResponse = ValidationResponse & {
  status: "BANNED";
  fullName: string;
  visitedEvents: number;
  friendsCount: number;
};

export type NotFoundResponse = ValidationResponse & {
  status: "NOT_FOUND";
};

export type ErrorResponse = ValidationResponse & {
  status: "ERROR";
  message: string;
};

/** Discriminated union of all possible scan outcomes */
export type FullValidationResponse =
  | OKValidationResponse
  | AlreadyScannedResponse
  | NotOpenResponse
  | BannedResponse
  | NotFoundResponse
  | ErrorResponse;
