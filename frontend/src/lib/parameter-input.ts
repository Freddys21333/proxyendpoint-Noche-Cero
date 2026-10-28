// Shift the decimal representation rather than introducing a multiply/divide round trip.
function shiftDecimal(value: number, places: number): number {
  const [coefficient, exponent = '0'] = String(value).split('e')
  return Number(`${coefficient}e${Number(exponent) + places}`)
}

export function percentInputValue(probability: number, editing: boolean): string {
  if (!Number.isFinite(probability)) return ''
  const percent = shiftDecimal(probability, 2)
  if (editing || probability < 0 || probability > 1) return String(percent)
  return String(Number(percent.toFixed(1)))
}

export function probabilityFromPercent(input: string): number {
  if (!input.trim()) return NaN
  return shiftDecimal(Number(input), -2)
}

export function numericInputError(value: number, min: number, max: number, integer: boolean, maxMessage?: string): string {
  if (!Number.isFinite(value)) return 'Completa este campo con un número válido.'
  if (integer && !Number.isInteger(value)) return `Introduce un número entero entre ${min} y ${max}.`
  if (value > max && maxMessage) return maxMessage
  if (value < min || value > max) return `Introduce un valor entre ${min} y ${max}.`
  return ''
}
