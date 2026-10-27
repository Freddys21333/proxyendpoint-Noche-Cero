import type { ApiError } from './api.ts'

export type ApiOperation = 'startup' | 'preview' | 'comparison'
export type ApiErrorAction = 'retry' | 'parameters' | 'repreview' | null
export type ApiErrorView = { title: string; description: string; action: ApiErrorAction; actionLabel: string }

export function apiErrorView(error: ApiError, operation: ApiOperation): ApiErrorView {
  if (error.status === 0 || error.code === 'NETWORK_ERROR') return {
    title: 'No se pudo conectar con el servidor',
    description: operation === 'startup'
      ? 'No recibimos la configuración necesaria para iniciar. Tus parámetros escritos siguen en pantalla.'
      : 'La solicitud no llegó al motor. Tus parámetros siguen disponibles para volver a intentarlo.',
    action: operation === 'startup' ? 'retry' : 'parameters',
    actionLabel: operation === 'startup' ? 'Reintentar conexión' : 'Volver a parámetros',
  }

  if (error.status === 409 || error.code === 'GRAPH_HASH_MISMATCH') return {
    title: 'La red cambió antes de completar la comparación',
    description: 'La vista previa ya no coincide con el escenario enviado. Consulta la red otra vez para generar una comparación con la configuración actual.',
    action: 'repreview',
    actionLabel: 'Consultar la red de nuevo',
  }

  if (error.status === 422 || error.code === 'VALIDATION_ERROR' || error.code === 'ORIGIN_EMPTY') return {
    title: 'Revisa los parámetros del escenario',
    description: error.code === 'ORIGIN_EMPTY'
      ? 'No hay personas disponibles en ese tipo de origen. Elige otro origen o ajusta la población.'
      : 'El motor encontró una combinación que no puede ejecutar. Conservamos tus valores para que puedas corregirlos.',
    action: 'parameters',
    actionLabel: 'Revisar parámetros',
  }

  if (error.status === 413) {
    const description = error.code === 'REQUEST_TOO_LARGE'
      ? 'La configuración supera el tamaño permitido para una solicitud.'
      : error.code === 'GRAPH_TOO_LARGE'
        ? 'La red de este escenario supera el límite que puede procesar el servicio.'
        : error.code === 'FRAMES_TOO_LARGE'
          ? 'La comparación no puede incluir la trayectoria animada con estos parámetros.'
          : 'El resultado es demasiado grande para enviarlo completo.'
    return { title: 'El escenario supera un límite de procesamiento', description: `${description} Reduce población, horizonte o réplicas y vuelve a intentarlo.`, action: 'parameters', actionLabel: 'Ajustar escenario' }
  }

  if (error.status === 429 || error.code === 'RATE_LIMITED') return {
    title: 'El servicio recibió muchas solicitudes',
    description: error.retryAfterSeconds === null
      ? 'Espera un momento antes de volver a enviar la solicitud.'
      : `El servicio recomienda esperar ${error.retryAfterSeconds} segundos antes de volver a intentarlo.`,
    action: 'retry',
    actionLabel: operation === 'comparison' ? 'Reintentar comparación' : 'Reintentar solicitud',
  }

  if (error.status === 503 || error.code === 'COMPUTE_UNAVAILABLE') return {
    title: 'El motor no está disponible por ahora',
    description: 'El servicio no puede procesar este escenario en este momento. Tus parámetros se conservaron; puedes volver a intentarlo más tarde.',
    action: 'retry',
    actionLabel: operation === 'comparison' ? 'Reintentar comparación' : 'Reintentar',
  }

  if (error.status >= 500 || error.code === 'SIMULATION_FAILED' || error.code === 'INTERNAL_ERROR') return {
    title: operation === 'comparison' ? 'No se pudo completar la comparación' : 'No se pudo preparar la vista previa',
    description: 'El servidor encontró un problema al procesar la solicitud. Tus parámetros siguen disponibles y puedes intentar de nuevo.',
    action: 'retry',
    actionLabel: operation === 'comparison' ? 'Reintentar comparación' : 'Intentar de nuevo',
  }

  if (error.status === 404) return {
    title: 'Esta operación no está disponible',
    description: 'El servicio no encontró la operación solicitada. Comprueba que la API local esté en la misma versión que el frontend.',
    action: 'retry',
    actionLabel: 'Intentar de nuevo',
  }

  return {
    title: operation === 'comparison' ? 'No se pudo completar la comparación' : 'No se pudo consultar la red',
    description: 'La respuesta del servicio no pudo procesarse. Tus parámetros se conservaron; revisa el escenario o vuelve a intentarlo.',
    action: operation === 'comparison' ? 'parameters' : 'retry',
    actionLabel: operation === 'comparison' ? 'Revisar escenario' : 'Intentar de nuevo',
  }
}
