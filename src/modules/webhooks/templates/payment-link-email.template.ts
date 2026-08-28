import { HtmlEscapeUtil } from 'src/shared/utils/html-escape.util';

/**
 * Plantilla HTML del correo "Regulariza tu pago - Isapre Nueva Masvida",
 * enviado por WebhooksService#sendPaymentLinkEmail vía SendGrid.
 *
 * Los placeholders `{{recipientName}}`, `{{debtAmount}}` y `{{paymentLink}}`
 * se sustituyen en runtime con renderPaymentLinkEmailHtml().
 */
export const PAYMENT_LINK_EMAIL_HTML_TEMPLATE = `
<!doctype html>
<html>
<head>
<meta charset="UTF-8">
<title>Regularización de deuda - Nueva Masvida</title>
<style>
  body, table, td, p, a { font-family: Arial, Helvetica, sans-serif; }
  img { border:0; outline:none; text-decoration:none; }
  table { border-collapse:collapse; }
  a { text-decoration:none; }
</style>
</head>

<body style="margin:0; padding:0; background-color:#ffffff; width:100%;">

<table
  width="600"
  border="0"
  align="center"
  cellpadding="0"
  cellspacing="0"
  style="
    width:600px;
    max-width:600px;
    margin:0 auto;
    background-color:#ffffff;
  "
>

<tbody>

<!-- BANNER -->
<tr>
  <td width="600" align="center">

    <img
      src="https://www.nuevamasvida.cl/wp-content/uploads/2026/05/banner-Devolucion-TFU-03.png"
      alt="Nueva Masvida"
      width="600"
      style="
        display:block;
        border:0;
        width:600px;
        height:auto;
      "
    >

  </td>
</tr>


<!-- TEXTO PRINCIPAL -->
<tr>
  <td align="center">

    <table
      width="550"
      border="0"
      cellpadding="0"
      cellspacing="0"
      align="center"
      style="width:550px;"
    >

      <tbody>

        <tr>
          <td style="padding:28px 0 25px 0;">

            <!-- SALUDO -->
            <p style="
              margin:0 0 20px 0;
              font-family:Arial, Helvetica, sans-serif;
              font-size:15px;
              line-height:20px;
              color:#0085CA;
              font-weight:bold;
              text-align:left;
            ">
              Estimado(a) {{recipientName}},
            </p>


            <!-- PRESENTACIÓN -->
            <p style="
              margin:0 0 16px 0;
              font-family:Arial, Helvetica, sans-serif;
              font-size:13px;
              line-height:20px;
              color:#5E5E5E;
              text-align:justify;
            ">
              En <strong>Nueva Masvida</strong> queremos ayudarte a mantener tus cotizaciones
              al día y facilitarte el proceso de regularización, poniendo a tu disposición
              distintas alternativas para que puedas gestionar tu deuda de manera simple
              y segura.
            </p>


            <!-- DEUDA -->
            <p style="
              margin:0 0 16px 0;
              font-family:Arial, Helvetica, sans-serif;
              font-size:13px;
              line-height:20px;
              color:#5E5E5E;
              text-align:justify;
            ">
              De acuerdo con la información disponible, actualmente registras un saldo
              pendiente de <strong>\${{debtAmount}}</strong>.
            </p>


            <!-- INVITACIÓN -->
            <p style="
              margin:0;
              font-family:Arial, Helvetica, sans-serif;
              font-size:13px;
              line-height:20px;
              color:#5E5E5E;
              text-align:justify;
            ">
              Para facilitar esta gestión, puedes realizar el pago directamente mediante
              el link que encontrarás a continuación o, si lo prefieres, utilizar alguna
              de las alternativas de transferencia bancaria disponibles.
            </p>

          </td>
        </tr>

      </tbody>

    </table>

  </td>
</tr>


<!-- BLOQUE CELESTE -->
<tr>

  <td
    bgcolor="#EAF5FB"
    align="center"
    style="
      background-color:#EAF5FB;
      padding:25px 35px 13px 35px;
    "
  >

    <p style="
      margin:0 0 5px 0;
      font-family:Arial, Helvetica, sans-serif;
      font-size:15px;
      line-height:21px;
      color:#0085CA;
      font-weight:bold;
      text-align:center;
    ">
      Regulariza tu deuda de forma rápida y sencilla
    </p>

    <p style="
      margin:0;
      font-family:Arial, Helvetica, sans-serif;
      font-size:12px;
      line-height:18px;
      color:#5E5E5E;
      text-align:center;
    ">
      Ingresa al siguiente link para continuar con el proceso de pago.
    </p>

  </td>

</tr>


<!-- BOTÓN LINK DE PAGO -->
<tr>

  <td
    bgcolor="#EAF5FB"
    align="center"
    style="
      background-color:#EAF5FB;
      padding:5px 0 28px 0;
    "
  >

    <table
      border="0"
      cellpadding="0"
      cellspacing="0"
      align="center"
    >

      <tbody>

        <tr>

          <td
            align="center"
            bgcolor="#0085CA"
            style="
              background-color:#0085CA;
              border-radius:22px;
            "
          >

            <a
              href="{{paymentLink}}"
              target="_blank"
              style="
                display:inline-block;
                padding:13px 38px;
                font-family:Arial, Helvetica, sans-serif;
                font-size:14px;
                line-height:18px;
                color:#ffffff;
                text-decoration:none;
                font-weight:bold;
                background-color:#0085CA;
                border-radius:22px;
              "
            >
              PAGAR DEUDA
            </a>

          </td>

        </tr>

      </tbody>

    </table>

  </td>

</tr>


<!-- TRANSFERENCIAS -->
<tr>

  <td align="center">

    <table
      width="550"
      border="0"
      cellpadding="0"
      cellspacing="0"
      align="center"
      style="width:550px;"
    >

      <tbody>

        <tr>

          <td style="padding:27px 0 20px 0;">

            <!-- TITULO -->
            <p style="
              margin:0 0 8px 0;
              font-family:Arial, Helvetica, sans-serif;
              font-size:14px;
              line-height:20px;
              color:#0085CA;
              font-weight:bold;
              text-align:left;
            ">
              Otras alternativas para regularizar tu deuda
            </p>


            <!-- INTRO TRANSFERENCIA -->
            <p style="
              margin:0 0 20px 0;
              font-family:Arial, Helvetica, sans-serif;
              font-size:12px;
              line-height:18px;
              color:#5E5E5E;
              text-align:left;
            ">
              Si prefieres realizar una transferencia bancaria, puedes realizarla a la siguiente cuenta de Nueva Masvida:
            </p>


            <!-- SANTANDER -->
            <p style="
              margin:0 0 5px 0;
              font-family:Arial, Helvetica, sans-serif;
              font-size:13px;
              line-height:19px;
              color:#0085CA;
              font-weight:bold;
            ">
              Banco Santander
            </p>

            <p style="
              margin:0 0 20px 0;
              font-family:Arial, Helvetica, sans-serif;
              font-size:12px;
              line-height:19px;
              color:#5E5E5E;
            ">
              <strong>Nombre:</strong> Nueva Mas Vida S.A.<br>
              <strong>RUT:</strong> 96.504.160-5<br>
              <strong>Cuenta Corriente N.°:</strong> 4380614
            </p>

          </td>

        </tr>

      </tbody>

    </table>

  </td>

</tr>


<!-- RECOMENDACIÓN COMPROBANTE -->
<tr>

  <td align="center">

    <table
      width="550"
      border="0"
      cellpadding="0"
      cellspacing="0"
      align="center"
      style="width:550px;"
    >

      <tbody>

        <tr>

          <td style="
            padding:5px 0 20px 0;
            border-top:1px solid #E5E5E5;
          ">

            <p style="
              margin:18px 0 12px 0;
              font-family:Arial, Helvetica, sans-serif;
              font-size:12px;
              line-height:18px;
              color:#5E5E5E;
              text-align:justify;
            ">
              Una vez realizado el pago, te recomendamos conservar el comprobante
              de la operación como respaldo.
            </p>

            <p style="
              margin:0;
              font-family:Arial, Helvetica, sans-serif;
              font-size:12px;
              line-height:18px;
              color:#5E5E5E;
              text-align:justify;
            ">
              Si necesitas revisar antecedentes adicionales sobre tu deuda,
              cotizaciones o proceso de regularización, puedes comunicarte con
              nuestro equipo de Cobranza al
              <strong>600 600 0262, opción 4.</strong>
            </p>

          </td>

        </tr>

      </tbody>

    </table>

  </td>

</tr>


<!-- CIERRE -->
<tr>

  <td align="center">

    <table
      width="550"
      border="0"
      cellpadding="0"
      cellspacing="0"
      align="center"
      style="width:550px;"
    >

      <tbody>

        <tr>

          <td style="padding:5px 0 20px 0;">

            <p style="
              margin:0;
              font-family:Arial, Helvetica, sans-serif;
              font-size:12px;
              line-height:18px;
              color:#5E5E5E;
              text-align:justify;
            ">
              En Nueva Masvida estamos disponibles para orientarte y facilitar
              las alternativas necesarias para que puedas mantener tu situación
              al día.
            </p>

          </td>

        </tr>

      </tbody>

    </table>

  </td>

</tr>


<!-- FRASE FINAL -->
<tr>

  <td
    height="80"
    align="center"
    style="
      padding:10px 25px 22px 25px;
    "
  >

    <p style="
      margin:0;
      font-family:Arial, Helvetica, sans-serif;
      font-size:12px;
      line-height:18px;
      color:#0085CA;
      font-weight:bold;
      text-align:center;
    ">
      Porque mereces más compromiso,<br>
      mereces Nueva Masvida.
    </p>

  </td>

</tr>


<!-- FOOTER -->
<tr>

  <td align="center">

    <img
      src="https://www.nuevamasvida.cl/wp-content/uploads/2026/01/Devolucion_excedentes_Footer_.png"
      alt="Nueva Masvida"
      width="600"
      usemap="#Map"
      style="
        display:block;
        border:0;
        width:600px;
        height:auto;
      "
    >

    <map name="Map">

      <area
        shape="circle"
        coords="516,19,12"
        href="https://twitter.com/nuevamasvida_/"
        target="_blank"
      >

      <area
        shape="rect"
        coords="154,9,287,29"
        href="https://api.whatsapp.com/send?phone=56969015876&amp;text=%C2%A1Hola!%20Necesito%20informaci%C3%B3n%2C%20por%20favor"
        target="_blank"
      >

      <area
        shape="circle"
        coords="551,18,11"
        href="https://www.instagram.com/isapre.nuevamasvida/?hl=es"
        target="_blank"
      >

      <area
        shape="rect"
        coords="50,8,132,31"
        href="https://www.nuevamasvida.cl"
        target="_blank"
      >

      <area
        shape="circle"
        coords="481,18,14"
        href="https://www.facebook.com/NuevaMasvida"
        target="_blank"
      >

    </map>

  </td>

</tr>

</tbody>
</table>

</body>
</html>

`.trim();

/**
 * Sustituye los placeholders `{{recipientName}}`, `{{debtAmount}}` y
 * `{{paymentLink}}` de PAYMENT_LINK_EMAIL_HTML_TEMPLATE por los valores
 * dinámicos recibidos.
 *
 * Los tres valores se HTML-escapan (`HtmlEscapeUtil.escape`) antes de
 * interpolarse: `recipientName` y `debtAmount` porque llegan sin sanitizar
 * desde el webhook externo de ElevenLabs (ver
 * `specs/hardening-html-injection-payment-link-email/`), y `paymentLink`
 * porque, aunque el caller ya lo validó como URL `https://` bien formada,
 * su representación normalizada puede contener `&` en el querystring
 * (p. ej. `?ref=1&foo=2`), que es HTML-unsafe si no se convierte a
 * `&amp;`.
 */
export function renderPaymentLinkEmailHtml(
  recipientName: string,
  paymentLink: string,
  debtAmount: string,
): string {
  return PAYMENT_LINK_EMAIL_HTML_TEMPLATE.replace(
    /{{recipientName}}/g,
    HtmlEscapeUtil.escape(recipientName),
  )
    .replace(/{{paymentLink}}/g, HtmlEscapeUtil.escape(paymentLink))
    .replace(/{{debtAmount}}/g, HtmlEscapeUtil.escape(debtAmount));
}
