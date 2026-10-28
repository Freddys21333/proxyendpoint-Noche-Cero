import { useEffect, useRef, useState } from 'react'
import type { CompareResponse } from '@/lib/api'
import { buildMayorReportHtml, fetchMayorReport } from '@/lib/mayor-report'

export function MayorReportDownload({ result }: { result: CompareResponse }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const request = useRef<AbortController | null>(null)
  useEffect(() => {
    setBusy(false)
    setError('')
    setNote('')
    return () => { request.current?.abort(); request.current = null }
  }, [result])

  const download = async () => {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError('')
    setNote('')
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

  const htmlFile = (autoPrint: boolean) => {
    const html = buildMayorReportHtml(result, { autoPrint })
    return new Blob([html], { type: 'text/html;charset=utf-8' })
  }
  const fileSuffix = `${result.configuration.rootSeed}-${result.manifest.experimentHash.slice(7, 15)}`

  const openPrintable = () => {
    setError('')
    const url = URL.createObjectURL(htmlFile(true))
    const win = window.open(url, '_blank')
    if (win) {
      setNote('Ventana del informe abierta. Usa el diálogo de impresión para guardar como PDF.')
    } else {
      const link = document.createElement('a')
      link.href = url
      link.download = `informe-alcaldia-${fileSuffix}.html`
      link.click()
      setNote('El navegador bloqueó la ventana emergente. Se descargó el HTML para abrirlo e imprimir.')
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  const downloadHtml = () => {
    setError('')
    const url = URL.createObjectURL(htmlFile(false))
    const link = document.createElement('a')
    link.href = url
    link.download = `informe-alcaldia-${fileSuffix}.html`
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNote('Informe descargado en HTML. Ábrelo y usa «Imprimir o guardar como PDF» si necesitas el documento.')
  }

  return <div aria-label="Informe para alcaldía">
    <div className="export-downloads">
      <button type="button" className="plain-action" disabled={busy} onClick={() => { void download() }}>
        {busy ? 'Generando informe…' : 'Descargar informe para alcaldía (PDF)'}
      </button>
      <button type="button" className="plain-action" onClick={openPrintable}>Imprimir informe</button>
      <button type="button" className="plain-action" onClick={downloadHtml}>Descargar informe (HTML)</button>
    </div>
    <p role="status">{busy ? 'Validando el experimento y preparando el PDF.' : 'Resumen en lenguaje sencillo con comparación, recursos, incertidumbre y límites.'}</p>
    {note && <p role="status">{note}</p>}
    {error && <p role="alert">{error} Puedes volver a intentar la descarga.</p>}
  </div>
}
