export const PASSWORD_MIN_LENGTH = 8;

export function isPasswordLongEnough(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH;
}
