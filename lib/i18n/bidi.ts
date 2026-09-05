const LTR_ISOLATE = "\u2066";
const POP_DIRECTIONAL_ISOLATE = "\u2069";

// Keep phone numbers, dates, times and decimal values in reading order when
// they appear inside Arabic copy. Unicode isolates avoid changing the
// direction of the surrounding translated sentence.
const numericRun = /(?<![\p{L}\p{N}_\u2066])(?:[+−-]?\p{N}(?:[\p{N}\s.,:/%°()×+−-]*\p{N})?)(?![\p{L}\p{N}_\u2069])/gu;

export function isolateNumericText(value: string) {
  return value.replace(numericRun, (match) => `${LTR_ISOLATE}${match}${POP_DIRECTIONAL_ISOLATE}`);
}
