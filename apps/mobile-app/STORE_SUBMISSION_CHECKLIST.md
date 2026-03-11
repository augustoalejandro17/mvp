# Store Submission Checklist (Play Store + App Store)

## 1) Versionado (obligatorio en cada release)
- Incrementar `expo.version` en `/Users/augustovaca/mvp/apps/mobile-app/app.config.js` cuando haya nueva version publica.
- Android: `android.versionCode` debe aumentar en cada subida.
- iOS: `ios.buildNumber` debe aumentar en cada subida.
- Si usas EAS profile `production`, `autoIncrement` en `/Users/augustovaca/mvp/apps/mobile-app/eas.json` ayuda a evitar rechazos por version repetida.

## 2) Permisos y privacidad
- La app esta configurada sin permiso de microfono en Android (`blockedPermissions` para `RECORD_AUDIO`).
- En iOS se elimino `NSMicrophoneUsageDescription` para evitar declarar un permiso no usado.
- Confirmar que no se agreguen nuevas librerias que vuelvan a inyectar permisos sensibles sin uso real.

## 3) iOS (App Store Connect)
- Verificar que `ITSAppUsesNonExemptEncryption = false` siga presente en `Info.plist`.
- Completar App Privacy en App Store Connect segun los datos reales de tu backend (login, perfil, progreso, notificaciones, etc.).
- Cargar capturas correctas por dispositivo soportado (iPhone; iPad no requerido con `supportsTablet: false`).
- Confirmar categoria, edad, URL de soporte y URL de privacidad.
- Sign in with Apple:
  - Es obligatorio solo si la app ofrece login social de terceros en iOS.
  - Si el login en iOS es únicamente por email/contraseña (sin Google/Facebook/otros), no aplica obligación de botón Apple.

## 4) Android (Google Play Console)
- Publicar en formato AAB (`buildType: app-bundle` en profile `production`).
- Completar Data safety con el flujo real de datos (auth/token/perfil/notificaciones).
- Completar/validar Content rating y Target audience.
- Incluir politica de privacidad publica y accesible desde la ficha.

## 5) Calidad minima previa al envio
- Build limpia para ambos targets.
- Pruebas de login, reproduccion de video, logout y rutas principales.
- Sin crashes al abrir/cerrar app y al volver del background.
- Sin texto temporal ni endpoints de desarrollo.

## 6) Comandos sugeridos
```bash
# Desde /Users/augustovaca/mvp/apps/mobile-app
eas build --platform ios --profile production
eas build --platform android --profile production

# Opcional: envio automatizado cuando ya este todo configurado
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

## 7) UGC readiness (implementado)
- Denuncia desde app móvil:
  - Botón `Denunciar contenido` en el reproductor.
  - Pantalla dedicada: `/report-content`.
- Moderación backend:
  - `POST /api/content-reports` (usuario autenticado)
  - `GET /api/content-reports/mine` (usuario autenticado)
  - `GET /api/content-reports` (admin/super_admin/school_owner)
  - `PATCH /api/content-reports/:id/status` (admin/super_admin/school_owner)
  - `status=action_taken` aplica acción efectiva: desactiva contenido reportado (`class|course|school`).
- Moderación en app móvil:
  - Vista admin: `/manage/reports` para revisar y actualizar estado de denuncias.
- Denuncia de usuarios:
  - Pantalla dedicada: `/report-user`.
  - Backend: `POST /api/user-reports`, `GET /api/user-reports/mine`, `GET /api/user-reports`, `PATCH /api/user-reports/:id/status`.
  - `status=action_taken` suspende cuenta reportada (`isActive=false`) y revoca sesiones activas.
  - Vista admin: `/manage/user-reports`.
- Términos para creadores (antes de subir UGC):
  - Estado y aceptación: `GET /api/auth/creator-terms/status`, `PATCH /api/auth/creator-terms/accept`.
  - Enforcement backend al crear/reemplazar videos de clases.
- Baja de cuenta en app:
  - Opción visible en Perfil -> `Eliminar Cuenta` (usa `DELETE /api/users/me`).
  - URL pública para Play Console/App Store: `/account-deletion`.
- Enlaces legales y soporte en app:
  - Política de Privacidad
  - Términos y Condiciones
  - Normas de Contenido
  - Términos de creador
  - Centro de Ayuda / soporte
- Botones críticos con funcionalidad implementada:
  - Perfil: Editar Perfil, Cambiar Contraseña, Acerca de Inti.
  - Reproductor: Marcar como completado (evita CTA sin acción).
- Seguridad de cuentas moderadas:
  - Login/JWT bloquea cuentas inactivas para impedir acceso tras suspensión.
