/** URL-safe id. Uses crypto when available, falls back to Math.random. */
export function nanoid(size = 12): string {
  const alphabet =
    'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'
  let id = ''
  const bytes =
    typeof crypto !== 'undefined' && 'getRandomValues' in crypto
      ? crypto.getRandomValues(new Uint8Array(size))
      : Array.from({ length: size }, () => Math.floor(Math.random() * 256))
  for (let i = 0; i < size; i++) id += alphabet[bytes[i] & 63]
  return id
}
