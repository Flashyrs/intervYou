export function assertEmail(email: string) {
  const ok = /.+@.+\..+/.test(email);
  if (!ok) throw new Error('Invalid email');
}
