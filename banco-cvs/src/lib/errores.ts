/** Error de regla de negocio cuyo mensaje se puede mostrar al usuario tal cual. */
export class ErrorNegocio extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorNegocio";
  }
}

/** Error de negocio que puede resolverse al reintentar (IA saturada o sin respuesta, límite por minuto). */
export class ErrorTransitorio extends ErrorNegocio {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorTransitorio";
  }
}

/**
 * Carga de CVs: ¿vale la pena reintentar? 400 (formato, archivo vacío o dañado), 403 y 413 (más de 10 MB) son
 * permanentes; la sesión (401), la saturación (429) y los errores del servidor (5xx) pueden resolverse al reintentar.
 */
export function errorTransitorio(estadoHttp: number) {
  return estadoHttp === 401 || estadoHttp === 408 || estadoHttp === 429 || estadoHttp >= 500;
}
