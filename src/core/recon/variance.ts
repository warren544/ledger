import { addCents, cents, subtractCents, type MoneyCents } from "../money.js";
import { reconMoneySchema, type ReconMoney } from "./record-types.js";
import { z } from "zod";

export const varianceSignSchema = z.enum(["negative", "zero", "positive"]);
export type VarianceSign = z.infer<typeof varianceSignSchema>;

export const varianceResultSchema = z.object({
  leftCents: reconMoneySchema,
  rightCents: reconMoneySchema,
  varianceCents: reconMoneySchema,
  toleranceCents: reconMoneySchema,
  sign: varianceSignSchema,
  withinTolerance: z.boolean()
}).strict();
export type VarianceResult = z.infer<typeof varianceResultSchema>;

function checkedTolerance(value: MoneyCents): ReconMoney {
  const checked = cents(value);
  if (checked < 0) throw new RangeError("variance tolerance must be non-negative");
  return checked;
}

/** Compute left minus right using exact integer cents; no rounding is performed. */
export function computeVariance(leftCents: MoneyCents, rightCents: MoneyCents, toleranceCents: MoneyCents = cents(0)): VarianceResult {
  const left = cents(leftCents);
  const right = cents(rightCents);
  const tolerance = checkedTolerance(toleranceCents);
  const variance = subtractCents(left, right);
  const sign: VarianceSign = variance < 0 ? "negative" : variance > 0 ? "positive" : "zero";
  return varianceResultSchema.parse({ leftCents: left, rightCents: right, varianceCents: variance, toleranceCents: tolerance, sign, withinTolerance: Math.abs(variance) <= tolerance });
}

/** Sum exact integer-cent amounts, rejecting safe-integer overflow. */
export function sumCents(values: readonly MoneyCents[]): ReconMoney {
  return values.reduce<MoneyCents>((total, value) => addCents(total, cents(value)), cents(0));
}
