import Link from 'next/link';

const TERMS_VERSION = process.env.NEXT_PUBLIC_CREATOR_TERMS_VERSION || '2026-03-01';

export default function CreatorTermsPage() {
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px', color: '#111827' }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>Términos para creadores</h1>
      <p style={{ color: '#4b5563', marginBottom: 24 }}>
        Versión vigente: <strong>{TERMS_VERSION}</strong>
      </p>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20 }}>1. Contenido permitido</h2>
        <p>Solo se permite contenido educativo que no viole leyes locales, derechos de autor ni normas comunitarias.</p>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20 }}>2. Conducta del creador</h2>
        <p>No se permite acoso, discurso de odio, suplantación, estafas, explotación sexual o promoción de violencia.</p>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20 }}>3. Propiedad intelectual</h2>
        <p>Debes tener derechos de uso sobre videos, audio, imágenes y materiales que subes a la plataforma.</p>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20 }}>4. Moderación y medidas</h2>
        <p>Podemos revisar, limitar, retirar contenido o suspender cuentas ante incumplimientos o reportes validados.</p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20 }}>5. Reportes y apelaciones</h2>
        <p>Los usuarios pueden denunciar contenido o cuentas. Si recibes una acción, puedes solicitar revisión por soporte.</p>
      </section>

      <p style={{ color: '#374151' }}>
        Soporte: <a href="mailto:support@intihubs.com">support@intihubs.com</a>
      </p>
      <p style={{ marginTop: 8 }}>
        <Link href="/community">Ver comunidad</Link>
      </p>
    </main>
  );
}
