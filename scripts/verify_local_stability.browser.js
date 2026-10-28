// Ejecutar con playwright-cli run-code --filename=..., con UI/API locales iniciadas.
async page => {
  const errors = []
  const listener = error => errors.push(error.message)
  page.on('pageerror', listener)
  const responseFor = suffix => page.waitForResponse(response => response.url().endsWith(suffix) && response.request().method() === 'POST')
  try {
    await page.goto('http://127.0.0.1:5174')
    await page.getByRole('button', { name: 'Consultar red', exact: true }).waitFor()
    const population = page.getByRole('spinbutton', { name: 'Población (personas)', exact: true })
    await population.fill('60')
    await page.getByRole('spinbutton', { name: 'Duración (días)', exact: true }).fill('7')
    await page.getByRole('spinbutton', { name: 'Dosis disponibles (dosis)', exact: true }).fill('10')
    const preview = responseFor('/v1/scenarios/preview')
    await page.getByRole('button', { name: 'Consultar red', exact: true }).click()
    if ((await preview).status() !== 200) throw new Error('No se generó la red real')
    const comparison = responseFor('/v1/simulations/compare')
    await page.getByRole('button', { name: 'Comparar estrategias', exact: true }).click()
    const response = await comparison
    const result = await response.json()
    if (response.status() !== 200 || !result.representative.frames) throw new Error('Comparación incompleta')
    const downloads = []
    for (const name of ['Descargar experimento JSON', 'Descargar ZIP con CSV', 'Descargar informe para alcaldía (PDF)', 'Descargar informe (HTML)']) {
      const pending = page.waitForEvent('download')
      await page.getByRole('button', { name, exact: true }).click()
      const file = await pending
      if (await file.failure()) throw new Error('Falló una descarga')
      downloads.push(file.suggestedFilename())
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(200)
    const mobile = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }))
    if (mobile.scrollWidth > mobile.width) throw new Error('Desbordamiento horizontal en comparación')
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.getByRole('button', { name: 'Explorar red', exact: true }).click()
    await page.getByText('Reproducción y estrategia', { exact: true }).click()
    await page.getByRole('button', { name: 'Avanzar un día', exact: true }).click()
    await page.getByRole('button', { name: 'Retroceder un día', exact: true }).click()
    if (await page.getByRole('slider', { name: 'Día de la réplica', exact: true }).inputValue() !== '0') throw new Error('Día desincronizado')
    await page.getByRole('button', { name: 'PRO', exact: true }).click()
    const seed = page.getByRole('spinbutton', { name: 'Semilla raíz', exact: true })
    if ((await seed.getAttribute('readonly')) === null) throw new Error('La semilla puede desincronizarse de la red')
    await page.getByRole('button', { name: '2', exact: true }).click()
    const create = responseFor('/v1/jobs')
    await page.getByRole('button', { name: 'Iniciar trabajo', exact: true }).click()
    if ((await create).status() !== 202) throw new Error('Trabajo rechazado')
    const jobResult = page.waitForResponse(r => r.url().endsWith('/result') && r.request().method() === 'GET')
    await page.getByRole('button', { name: 'Leer resultado completo', exact: true }).click({ timeout: 60000 })
    if ((await jobResult).status() !== 200) throw new Error('Sin resultado completo de trabajo')
    await page.getByRole('button', { name: 'Explorar red', exact: true }).click()
    await population.fill('49')
    await page.getByRole('button', { name: 'Consultar red', exact: true }).click()
    if (await population.inputValue() !== '49' || !await page.getByRole('button', { name: 'Comparar estrategias', exact: true }).isDisabled()) throw new Error('Entrada perdida o comparación obsoleta habilitada')
    if (errors.length) throw new Error(JSON.stringify(errors))
    return { comparisonHash: result.manifest.experimentHash, downloads, mobile, jobCompleted: true, invalidInputPreserved: true, pageErrors: errors }
  } finally {
    page.off('pageerror', listener)
    await page.setViewportSize({ width: 1280, height: 900 })
  }
}
