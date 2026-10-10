/** Small bundled rotating set of gym / motivation quotes for the shareable card. */
export const GYM_QUOTES: string[] = [
  'The only bad workout is the one that didn’t happen.',
  'Discipline is choosing what you want most over what you want now.',
  'Little by little, a little becomes a lot.',
  'You don’t have to be extreme, just consistent.',
  'The pain you feel today is the strength you feel tomorrow.',
  'Show up. Even on the days you don’t feel like it.',
  'Stronger than yesterday.',
  'Sweat is just fat crying.',
  'Don’t count the days — make the days count.',
  'Success starts with self-discipline.',
  'Your only competition is who you were yesterday.',
  'Fall in love with the process and the results will come.',
];

export function randomQuote(): string {
  return GYM_QUOTES[Math.floor(Math.random() * GYM_QUOTES.length)];
}
