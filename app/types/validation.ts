export type ValidationStatus = "OK" | "NOT_REGISTERED" | "NOT_FOUND" | "INVALID" | "ERROR";

export interface ValidationResponse {
    status: ValidationStatus;
    fullName: string;
    message?: string;
}
