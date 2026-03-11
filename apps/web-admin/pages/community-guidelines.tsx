export default function CommunityGuidelinesPage() {
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px', color: '#111827' }}>
      <h1 style={{ fontSize: 32, marginBottom: 10 }}>Normas de Contenido</h1>
      <p style={{ color: '#4b5563', marginBottom: 24 }}>
        Última actualización: 7 de marzo de 2026.
      </p>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20 }}>Contenido permitido</h2>
        <p>
          Inti está orientado a educación. El contenido debe ser pedagógico,
          profesional y respetuoso con estudiantes, docentes y comunidad.
        </p>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20 }}>Contenido prohibido</h2>
        <ul>
          <li>Discurso de odio, acoso, amenazas o violencia.</li>
          <li>Contenido sexual explícito o explotación.</li>
          <li>Fraudes, suplantación, spam o engaños.</li>
          <li>Desinformación que pueda causar daño.</li>
          <li>Violación de propiedad intelectual o derechos de autor.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20 }}>Cómo reportar</h2>
        <p>
          Los usuarios pueden reportar contenido y cuentas desde la app. Nuestro
          equipo revisa denuncias y clasifica cada caso según severidad y evidencia.
        </p>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20 }}>Acciones de moderación</h2>
        <p>
          Según el caso, podemos ocultar contenido, restringir funciones, suspender
          cuentas o aplicar bloqueo permanente.
        </p>
      </section>

      <p style={{ marginTop: 18 }}>
        Reportes y soporte: <a href="mailto:support@intihubs.com">support@intihubs.com</a>
      </p>
    </main>
  );
}
