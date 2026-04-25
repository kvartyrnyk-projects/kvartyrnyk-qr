import { randomInt } from "node:crypto"

const jars = [
  "https://send.monobank.ua/jar/ag5d2jBa6",
  "https://send.monobank.ua/jar/KTt3mWCih"
] as const;

export function generatePaymentLink(amountHryvnia: number): string {
  const jar = jars[randomInt(0, jars.length)]
  return `${jar}?a=${amountHryvnia}`;
}
