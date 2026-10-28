import type { CompareResponse } from './api.ts'

export async function fetchMayorReport(result: CompareResponse, signal?: AbortSignal, fetcher: typeof fetch = fetch, baseUrl = '/v1'): Promise<Blob> {
  let response: Response
  try {
    response = await fetcher(`${baseUrl.replace(/\/+$/, '')}/reports/mayor`, {
      method: 'POST', credentials: 'omit', signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/pdf' },
      body: JSON.stringify(result),
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new Error('No se pudo conectar para generar el informe. Intenta nuevamente.')
  }
  if (!response.ok) {
    let message = 'No se pudo generar el informe. Intenta nuevamente.'
    try {
      const data = await response.json()
      if (typeof data?.error?.message === 'string') message = data.error.message
    } catch { /* A proxy may return a non-JSON failure. */ }
    throw new Error(message)
  }
  if (response.headers.get('Content-Type')?.split(';')[0] !== 'application/pdf') throw new Error('El servidor no devolvió un PDF válido.')
  const blob = await response.blob()
  if (blob.size > 5_242_880 || await blob.slice(0, 5).text() !== '%PDF-') throw new Error('El servidor no devolvió un PDF válido.')
  return blob
}
