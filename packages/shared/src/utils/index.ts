/** Return value clamped between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Delay for n milliseconds (useful in retry logic) */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Type-safe Object.entries */
export function typedEntries<T extends object>(obj: T): [keyof T, T[keyof T]][] {
  return Object.entries(obj) as [keyof T, T[keyof T]][]
}

/** Check if a string is a valid Ethereum address */
export function isEthAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

/** Shorten an Ethereum address for display: 0xAbCd...EfGh */
export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}
