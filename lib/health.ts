/**
 * Health metric formulas (sourced from standard references):
 *  - BMI = weight(kg) / height(m)^2. WHO categories: 18.5 / 25 / 30.
 *  - Devine ideal body weight (kg):
 *      men:   50   + 2.3 * (heightInches - 60)
 *      women: 45.5 + 2.3 * (heightInches - 60)
 * These are used only for reference lines and are shown only when the user has
 * entered the metrics each formula needs (height for BMI; height + gender for IBW).
 */

export type Gender = 'male' | 'female';

export function cmToInches(cm: number): number {
  return cm / 2.54;
}

/** Body Mass Index from weight (kg) and height (cm). */
export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/** Weight (kg) that corresponds to a given BMI at a height (cm). Inverse of bmi(). */
export function weightForBmi(targetBmi: number, heightCm: number): number {
  const m = heightCm / 100;
  return targetBmi * m * m;
}

/** WHO BMI category thresholds (the boundaries between bands). */
export const BMI_THRESHOLDS: { value: number; label: string }[] = [
  { value: 18.5, label: 'Underweight' }, // below this = underweight
  { value: 25, label: 'Normal' }, // 18.5–25 = normal
  { value: 30, label: 'Overweight' }, // 25–30 = overweight, above = obese
];

export function bmiCategory(value: number): string {
  if (value < 18.5) return 'Underweight';
  if (value < 25) return 'Normal';
  if (value < 30) return 'Overweight';
  return 'Obese';
}

/** Devine ideal body weight in kg. Requires height (cm) and gender. */
export function idealBodyWeight(heightCm: number, gender: Gender): number {
  const inches = cmToInches(heightCm);
  const base = gender === 'male' ? 50 : 45.5;
  return base + 2.3 * (inches - 60);
}
