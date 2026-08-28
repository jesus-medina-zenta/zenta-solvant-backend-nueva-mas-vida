/**
 * Utilidad de escaping HTML para valores dinámicos interpolados en
 * plantillas de correo (ver `specs/hardening-html-injection-payment-link-email/`).
 *
 * Escapa los 5 caracteres HTML-sensibles en un único pase (`.replace()`
 * con función de reemplazo por carácter, no varios `.replace()`
 * encadenados) para evitar colisiones entre reemplazos secuenciales.
 */
export class HtmlEscapeUtil {
  private static readonly ESCAPE_MAP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  static escape(value: string): string {
    return String(value).replace(
      /[&<>"']/g,
      (char) => HtmlEscapeUtil.ESCAPE_MAP[char],
    );
  }
}
