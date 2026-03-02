export default function AccountDeletionPage() {
  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: '40px 20px', color: '#111827' }}>
      <h1 style={{ fontSize: 32, marginBottom: 10 }}>Eliminación de cuenta</h1>
      <p style={{ color: '#4b5563', marginBottom: 24 }}>
        Esta página describe cómo solicitar la baja de cuenta para Inti Education.
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
        <h2 style={{ fontSize: 20 }}>Qué datos se eliminan</h2>
        <ul>
          <li>Tu perfil y credenciales de acceso.</li>
          <li>Tus sesiones activas y relaciones principales de usuario.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20 }}>Qué datos pueden conservarse temporalmente</h2>
        <ul>
          <li>Registros técnicos necesarios para seguridad, prevención de fraude y cumplimiento legal.</li>
          <li>Datos mínimos requeridos por obligaciones regulatorias o fiscales.</li>
        </ul>
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
