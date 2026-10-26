export function checkName(name: string): void {
  if (name.trim().length === 0) throw new TypeError('Definition name must not be empty')
}
