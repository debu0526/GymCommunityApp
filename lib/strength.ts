/** Strength math. Epley estimated one-rep max: 1RM = weight × (1 + reps/30). */
export function epley1RM(weight: number, reps: number | null): number {
  const r = reps && reps > 0 ? reps : 1;
  return weight * (1 + r / 30);
}
