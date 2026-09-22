export const RAZBOR_FALSE_KEYS = Array.from(
  { length: 10 },
  (_, index) => `razbor_false_${String(index + 1).padStart(2, '0')}`
);

export const RAZBOR_NEW_KEYS = Array.from(
  { length: 10 },
  (_, index) => `razbor_new_${String(index + 1).padStart(2, '0')}`
);
