export interface Product {
  id: number;
  name: string;
  description: string | null;
  unit: string;
  price: number; // cents
  tags: string[];
}

export interface ReceiptEntryDetail {
  productId: number;
  productName: string;
  unit: string;
  unitPrice: number; // cents
  unitCount: number;
  subtotal: number; // cents
}

export interface ReceiptResponse {
  id: number;
  status: "UNPAID" | "AWAITING_PAYMENT" | "PAID";
  total: number; // cents
  guestName: string;
  entries: ReceiptEntryDetail[];
  paymentFileId: string | null;
  paymentMimetype: string | null;
}

export interface UpdateEntriesBody {
  entries: { product_id: number; unit_count: number }[];
}

export interface CreateProductBody {
  name: string;
  unit: string;
  price: number; // cents
  description?: string | null;
  tags?: string[];
}
