/** Browser / extension noise that is not an app bug. */
export const SENTRY_IGNORE_ERRORS: Array<string | RegExp> = [
  "Cannot read properties of null (reading 'parentNode')",
  "Cannot read property 'parentNode' of null",
];
