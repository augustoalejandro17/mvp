export default function ContactPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px', color: '#111827' }}>
      <h1 style={{ fontSize: 32, marginBottom: 12 }}>Contacto y Soporte</h1>
      <p style={{ color: '#4b5563', marginBottom: 20 }}>
        Si necesitas ayuda con cuenta, pagos, contenido o moderación, contáctanos
        por los siguientes canales.
      </p>

      <section style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Soporte general</h2>
        <p>
          Email: <a href="mailto:support@intihubs.com">support@intihubs.com</a>
        </p>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Abuso y seguridad</h2>
        <p>
          Reportes de contenido o conducta: <a href="mailto:support@intihubs.com">support@intihubs.com</a>
        </p>
      </section>

      <section style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Privacidad y datos personales</h2>
        <p>
          Solicitudes de acceso, corrección o eliminación: <a href="mailto:support@intihubs.com">support@intihubs.com</a>
        </p>
      </section>

      <p>Horario de atención: Lunes a Viernes, 09:00 - 18:00 (GMT-5).</p>
    </main>
  );
}
