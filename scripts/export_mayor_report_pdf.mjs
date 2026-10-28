/**
 * Exportador determinista de informe para alcaldía a formato PDF / HTML.
 * Uso:
 *   node --experimental-strip-types scripts/export_mayor_report_pdf.mjs [experimento.json] [--output salida.pdf] [--html-only]
 */
import { readFile, writeFile, stat, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { spawnSync } from 'node:child_process'
import { homedir } from 'node:os'
import { globSync } from 'node:fs'
import { buildMayorReportHtml } from '../frontend/src/lib/mayor-report.ts'

function findChromiumExecutable() {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN
  }
  if (process.env.CHROMIUM_BIN && existsSync(process.env.CHROMIUM_BIN)) {
    return process.env.CHROMIUM_BIN
  }

  const playwrightDir = resolve(homedir(), '.cache', 'ms-playwright')
  if (existsSync(playwrightDir)) {
    // Buscar en builds de playwright chromium-linux64
    const candidates = [
      ...globSync(`${playwrightDir}/chromium-*/chrome-linux64/chrome`),
      ...globSync(`${playwrightDir}/chromium-*/chrome-linux/chrome`),
      ...globSync(`${playwrightDir}/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell`),
    ]
    if (candidates.length > 0 && existsSync(candidates[0])) {
      return candidates[0]
    }
  }

  // Comprobar binarios del sistema
  const systemCandidates = ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']
  for (const name of systemCandidates) {
    const result = spawnSync('which', [name], { encoding: 'utf8' })
    if (result.status === 0 && result.stdout.trim()) {
      const bin = result.stdout.trim()
      if (existsSync(bin)) return bin
    }
  }

  return null
}

const help = `Uso:
  node --experimental-strip-types scripts/export_mayor_report_pdf.mjs [experimento.json] [--output salida.pdf] [--html-only]

Argumentos:
  experimento.json    Ruta al archivo JSON de CompareResponse (por defecto usa schemas/examples/compare-response-vaccines.json).
  --output, -o ARCH   Ruta del archivo PDF (o HTML) a generar.
  --html-only         Genera únicamente el archivo HTML sin convertir a PDF.
  --help, -h          Muestra esta ayuda.
`

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(help)
    return
  }

  let inputPath = resolve('schemas/examples/compare-response-vaccines.json')
  let outputPath = null
  let htmlOnly = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--html-only') {
      htmlOnly = true
    } else if (arg === '--output' || arg === '-o') {
      if (!args[i + 1] || args[i + 1].startsWith('-')) {
        throw new Error('Falta el valor para el argumento --output')
      }
      outputPath = resolve(args[++i])
    } else if (!arg.startsWith('-')) {
      inputPath = resolve(arg)
    } else {
      throw new Error(`Argumento no reconocido: ${arg}. Usa --help para consultar opciones.`)
    }
  }

  const rawJson = await readFile(inputPath, 'utf8')
  const experiment = JSON.parse(rawJson)

  if (!experiment || typeof experiment !== 'object' || !experiment.manifest || !experiment.configuration) {
    throw new Error(`El archivo ${inputPath} no contiene una respuesta CompareResponse válida.`)
  }

  const html = buildMayorReportHtml(experiment, { autoPrint: false })

  const seed = experiment.configuration?.rootSeed ?? 'demo'
  const hashPrefix = experiment.manifest?.experimentHash ? experiment.manifest.experimentHash.slice(7, 15) : 'unknown'

  if (htmlOnly) {
    const finalHtmlPath = outputPath ?? resolve(`.tools/informe-alcaldia-${seed}-${hashPrefix}.html`)
    await writeFile(finalHtmlPath, html, 'utf8')
    process.stdout.write(`HTML generado exitosamente:\n  Ruta: ${finalHtmlPath}\n  Experimento: ${experiment.manifest.experimentHash}\n`)
    return
  }

  const finalPdfPath = outputPath ?? resolve(`.tools/informe-alcaldia-${seed}-${hashPrefix}.pdf`)
  const chromeBin = findChromiumExecutable()

  if (!chromeBin) {
    // Si no se dispone de Chromium, exportar HTML y avisar al operador
    const fallbackHtmlPath = finalPdfPath.replace(/\.pdf$/i, '.html')
    await writeFile(fallbackHtmlPath, html, 'utf8')
    process.stderr.write(`Aviso: No se encontró un binario de Chromium en el entorno.\nSe guardó el informe HTML en:\n  ${fallbackHtmlPath}\nÁbrelo en un navegador para imprimirlo o guardarlo como PDF.\n`)
    return
  }

  // Guardar HTML temporal para renderizar el PDF
  const tempHtmlPath = resolve(dirname(finalPdfPath), `.temp-${basename(finalPdfPath)}.html`)
  await writeFile(tempHtmlPath, html, 'utf8')

  try {
    const chromeArgs = [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--no-pdf-header-footer',
      `--print-to-pdf=${finalPdfPath}`,
      tempHtmlPath,
    ]

    const proc = spawnSync(chromeBin, chromeArgs, { encoding: 'utf8', timeout: 30000 })
    if (proc.status !== 0) {
      throw new Error(`Fallo al generar PDF con Chromium (código ${proc.status}):\n${proc.stderr || proc.stdout}`)
    }

    const pdfStat = await stat(finalPdfPath)
    if (pdfStat.size === 0) {
      throw new Error('El archivo PDF generado está vacío.')
    }

    // Verificar cabecera %PDF-
    const handle = await readFile(finalPdfPath)
    const header = handle.subarray(0, 5).toString('ascii')
    if (!header.startsWith('%PDF-')) {
      throw new Error(`El archivo generado no tiene cabecera PDF válida (obtenido: "${header}")`)
    }

    process.stdout.write(`PDF generado exitosamente:\n  Ruta: ${finalPdfPath}\n  Tamaño: ${pdfStat.size} bytes\n  Semilla: ${seed}\n  Hash: ${experiment.manifest.experimentHash}\n  Estrategia evaluada: ${experiment.recommendation.winner}\n`)
  } finally {
    if (existsSync(tempHtmlPath)) {
      await unlink(tempHtmlPath).catch(() => {})
    }
  }
}

main().catch(err => {
  process.stderr.write(`Error: ${err.message}\n`)
  process.exit(1)
})
