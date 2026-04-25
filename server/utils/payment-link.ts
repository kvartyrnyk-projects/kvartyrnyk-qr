export function generatePaymentLink(amountHryvnia: number): string {
  // TODO: integrate real payment processor (LiqPay / Monobank)
  return `https://pay.example.com/?amount=${amountHryvnia}`;
}
