export function generatePaymentLink(amountcents: number): string {
  // TODO: integrate real payment processor (LiqPay / Monobank)
  return `https://pay.example.com/?amount=${amountcents}`;
}
