import { BRAND } from '@inti/shared-types';

export { BRAND };

export const HERO = {
  headline: 'Convierte tu celular en tu academia',
  subtext:
    'Crea cursos, sube clases, organiza tu contenido, recibe entregas y acompana a tus alumnos desde una sola app. Hecho para profesores que hoy operan con WhatsApp, Drive y herramientas sueltas.',
  pill: 'Beta privada para profesores fundadores',
  primaryCTA: 'Solicitar acceso',
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
    title: 'Hecho para operar desde el movil',
    description:
      'No necesitas montar una operacion compleja en desktop para empezar. La experiencia principal vive en la app.',
    icon: '📱',
  },
  {
    title: 'Menos caos operativo',
    description:
      'Centraliza contenido, alumnos y seguimiento para dejar de depender de WhatsApp, Drive y links sueltos.',
    icon: '🧭',
  },
  {
    title: 'Contenido mas profesional',
    description:
      'Tus clases quedan organizadas y tu material se entrega en una experiencia mas cuidada para el alumno.',
    icon: '🎥',
  },
  {
    title: 'Base para crecer',
    description:
      'Empieza con profesores y microacademias. Cuando el negocio crezca, la plataforma puede crecer contigo.',
    icon: '🌱',
  },
] as const;

export const FEATURES = [
  {
    title: 'Crea cursos desde el celular',
    description: 'Publica titulo, descripcion, portada y visibilidad sin salir de la app',
    icon: '🎥',
  },
  {
    title: 'Sube clases en video',
    description: 'Carga contenido desde el movil y deja el procesamiento en segundo plano',
    icon: '⬆️',
  },
  {
    title: 'Organiza el contenido',
    description: 'Ordena clases y playlists para que el alumno encuentre todo mas facil',
    icon: '🗂️',
  },
  {
    title: 'Entrega privada de contenido',
    description: 'Comparte tus videos y materiales en una experiencia mas profesional y controlada',
    icon: '🔒',
  },
  {
    title: 'Recibe tareas y entregas',
    description: 'Tus alumnos pueden enviar trabajos y tu revisar desde la misma plataforma',
    icon: '📝',
  },
  {
    title: 'Da feedback al alumno',
    description: 'Revisa entregas, comenta y acompana el progreso sin procesos manuales',
    icon: '💬',
  },
  {
    title: 'Notificaciones y avisos',
    description: 'Mantente en contacto con alumnos cuando hay novedades o acciones pendientes',
    icon: '🔔',
  },
  {
    title: 'Experiencia para profesor y alumno',
    description: 'Cada quien entra a una app clara, simple y lista para usar desde el primer dia',
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
      'Cursos y clases desde la app movil',
      'Entregas, feedback y notificaciones',
      'Precio preferencial de beta',
    ],
    cta: 'Solicitar acceso',
    popular: false,
  },
  {
    name: 'Crecimiento',
    price: 99,
    period: 'mes',
    description: 'Para profesores que ya venden y necesitan mas capacidad',
    features: [
      'Hasta 30 alumnos activos',
      '1 profesor',
      '25 GB de almacenamiento',
      'Cursos, clases y playlists',
      'Entregas, feedback y notificaciones',
      'Soporte prioritario de onboarding',
    ],
    cta: 'Solicitar acceso',
    popular: true,
  },
  {
    name: 'Pro',
    price: 179,
    period: 'mes',
    description: 'Para profesores con operacion estable o microacademias',
    features: [
      'Hasta 60 alumnos activos',
      'Hasta 2 profesores',
      '60 GB de almacenamiento',
      'Mayor capacidad para cursos y contenido',
      'Entregas, feedback y notificaciones',
      'Acompanamiento de activacion',
    ],
    cta: 'Hablar con nosotros',
    popular: false,
  },
] as const;

export const PRICING_NOTE =
  'Cupos limitados para profesores fundadores. El precio se mantiene mientras participes en la beta activa. Puedes sumar alumnos extra y packs de almacenamiento segun tu crecimiento.' as const;

export const CTA = {
  headline: 'Empieza con tu academia desde el celular',
  subtext:
    'Si hoy vendes cursos, clases o tutorias y sientes que todo esta disperso, aqui puedes ordenar tu operacion sin montar una plataforma gigante.',
  primaryText:
    'Estamos abriendo cupos limitados para profesores fundadores con onboarding cercano y precio preferencial.',
  primaryButton: 'Solicitar acceso',
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
      'Hoy estamos enfocados primero en profesores independientes y microacademias. La idea es validar con operaciones pequenas antes de expandirnos a planes premium para academias mas complejas.',
  },
  {
    question: '¿Necesito usar la web para operar?',
    answer:
      'No como base principal. Lo mejor trabajado hoy es la experiencia mobile, y esa es justamente la que estamos vendiendo para el inicio.',
  },
  {
    question: '¿Puedo vender aunque hoy cobre por transferencia o efectivo?',
    answer:
      'Si. La plataforma no depende de pagos online para que puedas empezar a operar, publicar contenido y dar seguimiento a tus alumnos.',
  },
  {
    question: '¿Que tan protegidos estan mis videos?',
    answer:
      'Tus clases se suben, procesan y entregan desde una infraestructura controlada por la plataforma para dar una experiencia mas privada y profesional que compartir archivos sueltos.',
  },
  {
    question: '¿Puedo recibir tareas o entregas de mis alumnos?',
    answer:
      'Si. La app ya contempla entregas y revision para que puedas acompanar el avance del alumno desde el mismo flujo.',
  },
  {
    question: '¿Que pasa si despues crezco y necesito mas herramientas?',
    answer:
      'Ese es justamente el plan. Primero resolvemos operacion mobile para profesores; despues iremos incorporando planes premium para academias con modulos mas avanzados.',
  },
] as const;

export const SOCIAL_PROOF = {
  headline: 'Ideal para profesores que ya venden, pero todavia operan con herramientas sueltas',
  items: [
    {
      title: 'Profesores independientes',
      description:
        'Si vendes cursos, clases o tutorias y quieres dejar de depender de WhatsApp, Drive y procesos manuales.',
    },
    {
      title: 'Microacademias',
      description:
        'Si tu operacion todavia es pequena y necesitas una base clara para publicar contenido y acompanar alumnos.',
    },
    {
      title: 'Creadores educativos',
      description:
        'Si ya tienes videos y materiales, pero quieres darles una experiencia mas ordenada y profesional.',
    },
  ],
  noteTitle: 'Estamos validando con profesores fundadores',
  noteDescription:
    'Todavia no queremos prometer una plataforma institucional enorme. Queremos ayudarte a resolver lo esencial hoy: contenido, alumnos y operacion desde el movil.',
} as const;

export const ANALYTICS_SHOWCASE = {
  headline: 'Menos herramientas sueltas, mas control diario',
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
      label: 'Operacion principal',
      value: 'Movil',
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
      value: 'Mas claro',
      trend: 'con entregas y avisos',
      positive: true,
    },
  ],
} as const;

export const NAVIGATION = {
  login: 'Iniciar sesion',
  signup: 'Solicitar acceso',
} as const;

export const FOOTER = {
  description:
    'La app para que profesores y microacademias operen cursos, clases y seguimiento desde el celular.',
  links: {
    product: [
      { label: 'Caracteristicas', href: '#features' },
      { label: 'Precios', href: '#pricing' },
      { label: 'Demo', href: '#demo' },
    ],
    company: [
      { label: 'Sobre nosotros', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contacto', href: '/contact' },
    ],
    legal: [
      { label: 'Privacidad', href: '/privacy' },
      { label: 'Terminos', href: '/terms' },
      { label: 'Cookies', href: '/cookies' },
    ],
  },
  copyright: `© ${new Date().getFullYear()} ${BRAND.name}. Todos los derechos reservados.`,
} as const;
