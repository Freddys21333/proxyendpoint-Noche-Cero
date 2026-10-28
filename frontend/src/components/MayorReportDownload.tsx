import { useEffect, useRef, useState } from 'react'
import type { CompareResponse } from '@/lib/api'
import { fetchMayorReport } from '@/lib/mayor-report'

export function MayorReportDownload({ result }: { result: CompareResponse }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  useEffect(() => {
    setBusy(false)
    setError('')
    return () => { request.current?.abort(); request.current = null }
  }, [result])

  const download = async () => {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError('')
    try {
      const blob = await fetchMayorReport(result, controller.signal, fetch, import.meta.env.VITE_API_BASE_URL || '/v1')
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `informe-alcaldia-${result.configuration.rootSeed}.pdf`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'No se pudo generar el informe.')
    } finally {
      if (request.current === controller) {
        request.current = null
        setBusy(false)
      }
    }
  }

  return <div aria-label="Informe para alcaldía">
    <button type="button" className="plain-action" disabled={busy} onClick={() => { void download() }}>
      {busy ? 'Generando informe…' : 'Descargar informe para alcaldía (PDF)'}
    </button>
    <p role="status">{busy ? 'Validando el experimento y preparando el PDF.' : 'Resumen en lenguaje sencillo con comparación, recursos, incertidumbre y límites.'}</p>
    {error && <p role="alert">{error} Puedes volver a intentar la descarga.</p>}
  </div>
}
