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

type SuccessfulValidationResponse = ValidationResponse & {
  fullName: string;
  event: EventDetails;
  visitedEvents: number;
  friendsCount: number;
  paymentFile?: {
    fileId: string;
    mimetype: string;
  } | null;
};

export type OKValidationResponse = SuccessfulValidationResponse & {
  status: "OK";
};

export type AlreadyScannedResponse = SuccessfulValidationResponse & {
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
