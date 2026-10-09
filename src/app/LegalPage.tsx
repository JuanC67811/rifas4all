import { Card, Page, PageTitle } from '@/ui/layout'
import { useDocumentTitle } from '@/ui/useDocumentTitle'

/**
 * Privacidad y condiciones de uso, en lenguaje sencillo. Pensado para una app
 * gratuita y casera; no sustituye asesoría legal (en Costa Rica aplica la
 * Ley 8968 de Protección de Datos Personales).
 */
export function PrivacyPage() {
  useDocumentTitle('Privacidad y condiciones')

  return (
    <Page>
      <PageTitle title="Privacidad y condiciones" subtitle="Lo importante, en pocas palabras." />

      <Card>
        <h2 className="text-lg font-semibold">Qué datos se guardan</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Del organizador: su correo, su contraseña cifrada y, si los escribe, su nombre.</li>
          <li>De los colaboradores: el nombre y, si el organizador lo agrega, un teléfono.</li>
          <li>
            De los compradores: nombre, teléfono y, opcionalmente, un alias y una nota breve. No se
            piden documentos de identidad ni direcciones.
          </li>
          <li>Un registro de las acciones (quién vendió o cobró qué número y cuándo).</li>
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Quién los ve</h2>
        <p>
          El organizador ve todo lo de sus rifas. Cada colaborador ve el tablero completo, pero solo
          los compradores de sus propios números. Nadie más puede consultarlos: lo impide la base de
          datos, no solo la pantalla.
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Cuánto tiempo se guardan</h2>
        <p>
          Cada rifa se cierra 2 días después del sorteo y se borra por completo, con todos sus datos
          y su registro, 4 días después del sorteo. El organizador puede eliminarla antes.
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold">Responsabilidades</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            El organizador es responsable de los datos que registra y de contar con el permiso de
            los compradores para anotarlos.
          </li>
          <li>
            Cada enlace de colaborador es personal: las acciones hechas con él se registran a nombre
            de esa persona. La app no verifica quién sostiene el teléfono.
          </li>
          <li>
            Rifas4All no procesa pagos ni realiza sorteos: solo ayuda a coordinar la venta y el
            cobro. Es un servicio gratuito, sin garantías.
          </li>
        </ul>
      </Card>
    </Page>
  )
}
