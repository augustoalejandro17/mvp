# Web Admin (`@inti/web-admin`)

Panel web administrativo de Inti construido con Next.js.

## Requisitos

- Node.js 18+
- Variables de entorno en `.env` de la raíz:
  - `NEXT_PUBLIC_API_URL` (ejemplo: `http://localhost:4000/api`)

## Desarrollo

Desde la raíz del monorepo:

```bash
npm run web:dev
```

O desde esta carpeta:

```bash
npm run dev
```

## Build

```bash
npm run build --workspace=apps/web-admin
```

## Notas de arquitectura

- Framework: Next.js (Pages Router + App Router coexistiendo durante migración).
- Cliente HTTP principal: `utils/api-client.ts`.
- Autenticación web: NextAuth + JWT/cookies.
- Componentes compartidos internos en `components/`.
