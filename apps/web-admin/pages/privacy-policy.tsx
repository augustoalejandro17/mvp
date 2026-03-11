export default function PrivacyPolicyPage() {
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px', color: '#111827' }}>
      <h1 style={{ fontSize: 32, marginBottom: 10 }}>Política de Privacidad</h1>
      <p style={{ color: '#4b5563', marginBottom: 24 }}>
        Última actualización: 7 de marzo de 2026.
      </p>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20 }}>1. Datos que recopilamos</h2>
        <p>
          Recopilamos datos de cuenta (nombre, correo, rol), datos de uso académico
          (avance, asistencia y actividad), y datos técnicos de seguridad (sesiones,
          IP aproximada, dispositivo y registros de errores).
        </p>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20 }}>2. Finalidades de uso</h2>
        <p>
          Usamos los datos para autenticar usuarios, habilitar funciones educativas,
          personalizar experiencia, moderar contenido, resolver incidencias y mejorar
          la confiabilidad del servicio.
        </p>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20 }}>3. Base legal y consentimiento</h2>
        <p>
          Tratamos datos según la ejecución del servicio, intereses legítimos de
          seguridad y cumplimiento legal. Cuando corresponda, solicitamos consentimiento.
        </p>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20 }}>4. Compartición de datos</h2>
        <p>
          Compartimos datos solo con proveedores técnicos necesarios para operar la
          plataforma (infraestructura, almacenamiento y monitoreo) y cuando exista
          obligación legal.
        </p>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20 }}>5. Retención y eliminación</h2>
        <p>
          Conservamos datos durante el tiempo necesario para prestación del servicio,
          prevención de fraude, auditoría y cumplimiento normativo. Puedes solicitar
          eliminación de cuenta desde la app o por soporte.
        </p>
      </section>

      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20 }}>6. Tus derechos</h2>
        <p>
          Puedes solicitar acceso, rectificación, eliminación y limitación del
          tratamiento conforme a la normativa aplicable en tu jurisdicción.
        </p>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20 }}>7. Seguridad</h2>
        <p>
          Aplicamos controles de autenticación, cifrado en tránsito y mecanismos de
          monitoreo para proteger la información frente a accesos no autorizados.
        </p>
      </section>

      <p>
        Contacto: <a href="mailto:support@intihubs.com">support@intihubs.com</a>
      </p>
    </main>
  );
}
