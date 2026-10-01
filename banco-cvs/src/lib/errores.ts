/** Error de regla de negocio cuyo mensaje se puede mostrar al usuario tal cual. */
export class ErrorNegocio extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorNegocio";
  }
}
