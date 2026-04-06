import { BRAND } from '@inti/shared-types';

export { BRAND };

export const LANDING_BRAND = {
  name: 'Inti',
  contactEmail: 'augustoalejandro95@gmail.com',
} as const;

export const CONTACT_MAILTO = `mailto:${LANDING_BRAND.contactEmail}?subject=Quiero%20m%C3%A1s%20informaci%C3%B3n%20sobre%20Inti` as const;

export const HERO = {
  headline: 'Convierte tu celular en tu academia',
  subtext:
    'Crea cursos, sube clases, organiza tu contenido, recibe entregas y acompaña a tus alumnos desde una sola app. Hecho para profesores que hoy operan con WhatsApp, Drive y herramientas sueltas.',
  pill: 'Beta privada para profesores fundadores',
  primaryCTA: 'Escríbenos',
  secondaryCTA: 'Ver planes fundadores',
  highlights: [
    {
      title: 'Mobile-first',
      description: 'Pensado para que el profesor opere desde el celular.',
    },
    {
      title: 'Contenido ordenado',
      description: 'Cursos, clases y playlists en un solo lugar.',
    },
    {
      title: 'Seguimiento real',
      description: 'Entregas, feedback y avisos sin procesos manuales.',
    },
  ],
} as const;

export const DIFFERENTIATORS = [
  {
    title: 'Hecho para operar desde el móvil',
    description:
      'No necesitas montar una operación compleja en desktop para empezar. La experiencia principal vive en la app.',
    icon: '📱',
  },
  {
    title: 'Menos caos operativo',
    description:
      'Centraliza contenido, alumnos y seguimiento para dejar de depender de WhatsApp, Drive y links sueltos.',
    icon: '🧭',
  },
  {
    title: 'Contenido más profesional',
    description:
      'Tus clases quedan organizadas y tu material se entrega en una experiencia más cuidada para el alumno.',
    icon: '🎥',
  },
  {
    title: 'Empieza simple, sin verte improvisado',
    description:
      'Lanza tus cursos con una experiencia más ordenada y profesional, sin montar una operación complicada desde el día uno.',
    icon: '🌱',
  },
] as const;

export const FEATURES = [
  {
    title: 'Crea cursos desde el celular',
    description: 'Publica título, descripción, portada y visibilidad sin salir de la app',
    icon: '🎥',
  },
  {
    title: 'Sube clases en video',
    description: 'Carga contenido desde el móvil y deja el procesamiento en segundo plano',
    icon: '⬆️',
  },
  {
    title: 'Organiza el contenido',
    description: 'Ordena clases y playlists para que el alumno encuentre todo más fácil',
    icon: '🗂️',
  },
  {
    title: 'Entrega privada de contenido',
    description: 'Comparte tus videos y materiales en una experiencia más profesional y controlada',
    icon: '🔒',
  },
  {
    title: 'Recibe tareas y entregas',
    description: 'Tus alumnos pueden enviar trabajos y tu revisar desde la misma plataforma',
    icon: '📝',
  },
  {
    title: 'Da feedback al alumno',
    description: 'Revisa entregas, comenta y acompaña el progreso sin procesos manuales',
    icon: '💬',
  },
  {
    title: 'Notificaciones y avisos',
    description: 'Mantente en contacto con alumnos cuando hay novedades o acciones pendientes',
    icon: '🔔',
  },
  {
    title: 'Experiencia para profesor y alumno',
    description: 'Cada quien entra a una app clara, simple y lista para usar desde el primer día',
    icon: '🤝',
  },
] as const;

export const PRICING_TIERS = [
  {
    name: 'Fundador',
    price: 49,
    period: 'mes',
    description: 'Para profesores que quieren validar con sus primeros alumnos',
    features: [
      'Hasta 15 alumnos activos',
      '1 profesor',
      '10 GB de almacenamiento',
      'Cursos y clases desde la app móvil',
      'Entregas, feedback y notificaciones',
      'Precio preferencial de beta',
    ],
    cta: 'Escríbenos',
    popular: false,
  },
  {
    name: 'Crecimiento',
    price: 99,
    period: 'mes',
    description: 'Para profesores que ya venden y necesitan más capacidad',
    features: [
      'Hasta 30 alumnos activos',
      '1 profesor',
      '25 GB de almacenamiento',
      'Cursos, clases y playlists',
      'Entregas, feedback y notificaciones',
      'Soporte prioritario de onboarding',
    ],
    cta: 'Escríbenos',
    popular: true,
  },
  {
    name: 'Pro',
    price: 179,
    period: 'mes',
    description: 'Para profesores con operación estable o microacademias',
    features: [
      'Hasta 60 alumnos activos',
      'Hasta 2 profesores',
      '60 GB de almacenamiento',
      'Mayor capacidad para cursos y contenido',
      'Entregas, feedback y notificaciones',
      'Acompañamiento de activación',
    ],
    cta: 'Escríbenos',
    popular: false,
  },
] as const;

export const PRICING_NOTE =
  'Cupos limitados para profesores fundadores. El precio se mantiene mientras participes en la beta activa. Puedes sumar alumnos extra y packs de almacenamiento según tu crecimiento.' as const;

export const CTA = {
  headline: 'Empieza con tu academia desde el celular',
  subtext:
    'Si hoy vendes cursos, clases o tutorías y sientes que todo está disperso, aquí puedes ordenar tu operación sin montar una plataforma gigante.',
  primaryText:
    'Estamos abriendo cupos limitados para profesores fundadores con onboarding cercano y precio preferencial.',
  primaryButton: 'Escríbenos',
  secondaryButton: 'Ver planes',
  highlights: [
    {
      title: 'Precio fundador',
      description: 'Ideal para validar contigo y mejorar el producto.',
    },
    {
      title: 'Onboarding cercano',
      description: 'Te ayudamos a subir tu primer curso y ordenar tu contenido.',
    },
    {
      title: 'Enfoque mobile',
      description: 'Lo importante lo resuelves desde el celular.',
    },
  ],
} as const;

export const FAQ_ITEMS = [
  {
    question: '¿Esto es para profesores individuales o para academias?',
    answer:
      'Hoy estamos enfocados primero en profesores independientes y microacademias. La idea es validar con operaciones pequeñas antes de expandirnos a planes premium para academias más complejas.',
  },
  {
    question: '¿Necesito usar la web para operar?',
    answer:
      'No como base principal. Lo mejor trabajado hoy es la experiencia mobile, y esa es justamente la que estamos vendiendo para el inicio.',
  },
  {
    question: '¿Puedo vender aunque hoy cobre por transferencia o efectivo?',
    answer:
      'Sí. La plataforma no depende de pagos online para que puedas empezar a operar, publicar contenido y dar seguimiento a tus alumnos.',
  },
  {
    question: '¿Qué tan protegidos están mis videos?',
    answer:
      'Tus clases se suben, procesan y entregan desde una infraestructura controlada por la plataforma para dar una experiencia más privada y profesional que compartir archivos sueltos.',
  },
  {
    question: '¿Puedo recibir tareas o entregas de mis alumnos?',
    answer:
      'Sí. La app ya contempla entregas y revisión para que puedas acompañar el avance del alumno desde el mismo flujo.',
  },
  {
    question: '¿Qué pasa si después crezco y necesito más herramientas?',
    answer:
      'Ese es justamente el plan. Primero resolvemos operación mobile para profesores; después iremos incorporando planes premium para academias con módulos más avanzados.',
  },
] as const;

export const SOCIAL_PROOF = {
  headline: 'Ideal para profesores que quieren expandir su alcance sin perder el control de su contenido y sus alumnos',
  items: [
    {
      title: 'Profesores independientes',
      description:
        'Si vendes cursos, clases o tutorías y quieres dejar de depender de WhatsApp, Drive y procesos manuales.',
    },
    {
      title: 'Microacademias',
      description:
        'Si tu operación todavía es pequeña y necesitas una base clara para publicar contenido y acompañar alumnos.',
    },
    {
      title: 'Creadores educativos',
      description:
        'Si ya tienes videos y materiales, pero quieres darles una experiencia más ordenada y profesional.',
    },
  ],
  noteTitle: 'Estamos validando con profesores fundadores',
  noteDescription:
    'Todavía no queremos prometer una plataforma institucional enorme. Queremos ayudarte a resolver lo esencial hoy: contenido, alumnos y operación desde el móvil.',
} as const;

export const ANALYTICS_SHOWCASE = {
  headline: 'Menos herramientas sueltas, más control diario',
  subtext:
    'Lo importante en esta etapa no es tener dashboards gigantes. Es poder operar mejor cada semana.',
  metrics: [
    {
      label: 'Herramientas centrales',
      value: '1 app',
      trend: 'menos caos',
      positive: true,
    },
    {
      label: 'Operación principal',
      value: 'Móvil',
      trend: 'desde cualquier lugar',
      positive: true,
    },
    {
      label: 'Contenido',
      value: 'Ordenado',
      trend: 'sin links sueltos',
      positive: true,
    },
    {
      label: 'Seguimiento',
      value: 'Más claro',
      trend: 'con entregas y avisos',
      positive: true,
    },
  ],
} as const;

export const NAVIGATION = {
  signup: 'Escríbenos',
} as const;

export const FOOTER = {
  description:
    'La app para que profesores y microacademias operen cursos, clases y seguimiento desde el celular.',
  links: {
    product: [
      { label: 'Características', href: '#features' },
      { label: 'Precios', href: '#pricing' },
      { label: 'Demo', href: '#demo' },
    ],
    company: [
      { label: 'Sobre nosotros', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contacto', href: CONTACT_MAILTO },
    ],
    legal: [
      { label: 'Privacidad', href: '/privacy' },
      { label: 'Términos', href: '/terms' },
      { label: 'Cookies', href: '/cookies' },
    ],
  },
  copyright: `© ${new Date().getFullYear()} ${LANDING_BRAND.name}. Todos los derechos reservados.`,
} as const;
