export default function AccountDeletionPage() {
  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '40px 20px', color: '#111827' }}>
      <h1 style={{ fontSize: 32, marginBottom: 10 }}>Eliminación de cuenta</h1>
      <p style={{ color: '#4b5563', marginBottom: 24 }}>
        Esta página describe cómo solicitar la baja de cuenta para Inti.
      </p>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20 }}>Cómo eliminar tu cuenta en la app</h2>
        <ol>
          <li>Inicia sesión en la app móvil.</li>
          <li>Ve a Perfil.</li>
          <li>Toca <strong>Eliminar Cuenta</strong> y confirma.</li>
        </ol>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20 }}>Qué ocurre al confirmar</h2>
        <ul>
          <li>Se desactiva el acceso y se cierran tus sesiones activas.</li>
          <li>Se eliminan datos principales de perfil y relaciones operativas.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20 }}>Qué datos pueden conservarse temporalmente</h2>
        <ul>
          <li>Registros técnicos necesarios para seguridad, prevención de fraude y cumplimiento legal.</li>
          <li>Datos mínimos requeridos por obligaciones regulatorias o fiscales.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20 }}>Plazos de atención</h2>
        <p>
          Las solicitudes de soporte para eliminación de cuenta (cuando no puedes
          iniciar sesión) se atienden normalmente en 3 a 7 días hábiles.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20 }}>Soporte</h2>
        <p>
          Si no puedes iniciar sesión, escribe a{' '}
          <a href="mailto:support@intihubs.com">support@intihubs.com</a> con el asunto
          &quot;Eliminar mi cuenta&quot;.
        </p>
      </section>
    </main>
  );
}
