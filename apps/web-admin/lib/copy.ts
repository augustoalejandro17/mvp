export const BRAND = {
  name: 'IntiHubs',
  slogan: 'Conecta. Aprende. Crece.',
  email: 'hola@intihubs.com',
  url: 'https://intihubs.com',
} as const;

export const HERO = {
  headline: 'CRM educativo + plataforma de clases híbridas',
  subtext: 'Gestión de alumnos, video seguro, asistencia, analítica y gamificación en un solo lugar. Para academias y profesores que quieren crecer.',
  pill: 'MVP listo para academias y profesores',
  primaryCTA: 'Probar gratis',
  secondaryCTA: 'Solicitar demo',
} as const;

export const DIFFERENTIATORS = [
  {
    title: 'Video seguro integrado',
    description: 'S3+CDN, URLs firmadas, procesamiento en background. Tus contenidos protegidos y optimizados.',
    icon: '🔒',
  },
  {
    title: 'Analítica pedagógica',
    description: 'Asistencia, retención, progreso, participación, cohortes. Datos que impulsan el aprendizaje.',
    icon: '📊',
  },
  {
    title: 'Gamificación nativa',
    description: 'Badges, niveles, leaderboard. Mantén a tus estudiantes motivados y comprometidos.',
    icon: '🏆',
  },
  {
    title: 'CRM ligero',
    description: 'Leads → alumno, notas 360°, automatizaciones básicas. Todo el ciclo de vida del estudiante.',
    icon: '👥',
  },
] as const;

export const FEATURES = [
  {
    title: 'Subida y streaming seguro de video',
    description: 'Protege tu contenido con URLs firmadas y CDN global',
    icon: '🎥',
  },
  {
    title: 'Asistencia inteligente',
    description: 'Recordatorios automáticos + QR self check-in',
    icon: '✅',
  },
  {
    title: 'Dashboards por rol',
    description: 'Vistas personalizadas para profesor, alumno y admin',
    icon: '📱',
  },
  {
    title: 'Retención y progreso',
    description: 'Métricas de participación, ocupación y avance',
    icon: '📈',
  },
  {
    title: 'Certificados automáticos',
    description: 'PDF + QR de verificación al completar cursos',
    icon: '🎓',
  },
  {
    title: 'Gestión de leads',
    description: 'CRM lite con notas y seguimiento 360°',
    icon: '🎯',
  },
  {
    title: 'Notificaciones automáticas',
    description: 'Inactividad, cumpleaños, recordatorios personalizados',
    icon: '🔔',
  },
  {
    title: 'Export BI-ready',
    description: 'CSV/Excel para análisis avanzado en tu herramienta favorita',
    icon: '📊',
  },
] as const;

export const PRICING_TIERS = [
  {
    name: 'Micro',
    price: 49,
    period: 'mes',
    description: 'Perfecto para empezar',
    features: [
      '10 alumnos activos',
      '1 profesor',
      '1 curso por alumno',
      '10 GB almacenamiento',
      '10 horas streaming/mes',
      'Asistencia + certificados',
    ],
    cta: 'Empezar',
    popular: false,
  },
  {
    name: 'Básico',
    price: 100,
    period: 'mes',
    description: 'Para academias pequeñas',
    features: [
      '20 alumnos activos',
      '2 profesores',
      '1 curso por alumno',
      '20 GB almacenamiento',
      '20 horas streaming/mes',
      'Progreso + cupones',
    ],
    cta: 'Empezar',
    popular: false,
  },
  {
    name: 'Intermedio',
    price: 300,
    period: 'mes',
    description: 'El más elegido',
    features: [
      '60 alumnos activos',
      '5 profesores',
      '2 cursos por alumno',
      '60 GB almacenamiento',
      '60 horas streaming/mes',
      'BI + leads + notificaciones',
    ],
    cta: 'Empezar',
    popular: true,
  },
  {
    name: 'Avanzado',
    price: 600,
    period: 'mes',
    description: 'Para academias establecidas',
    features: [
      '120 alumnos activos',
      '10 profesores',
      '3 cursos por alumno',
      '120 GB almacenamiento',
      '120 horas streaming/mes',
      'Multiaula + segmentación + branding',
    ],
    cta: 'Empezar',
    popular: false,
  },
] as const;

export const PRICING_NOTE = '2 meses gratis pagando anual. ¿Necesitas 500+ alumnos o white-label? Contáctanos.' as const;

export const CTA = {
  headline: 'Transforma tu academia hoy',
  subtext: 'Únete a cientos de profesores que ya están creciendo con IntiHubs',
  primaryText: 'Prueba gratuita 14 días. Sin tarjeta.',
  primaryButton: 'Crear cuenta',
  secondaryButton: 'Solicitar demo',
} as const;

export const FAQ_ITEMS = [
  {
    question: '¿Puedo empezar como profesor individual y luego escalar?',
    answer: 'Absolutamente. Muchos de nuestros clientes empezaron con el plan Micro y fueron creciendo. Puedes cambiar de plan en cualquier momento sin perder datos.',
  },
  {
    question: '¿Funciona sin pagos online?',
    answer: 'Sí, IntiHubs funciona perfectamente para academias que manejan pagos presenciales o por transferencia. El CRM te ayuda a llevar el control de pagos pendientes.',
  },
  {
    question: '¿Qué tan seguros están mis videos?',
    answer: 'Usamos URLs firmadas con expiración, almacenamiento en S3 con cifrado, y CDN global. Tus videos no se pueden descargar ni compartir sin autorización.',
  },
  {
    question: '¿Puedo exportar mis datos?',
    answer: 'Sí, todos tus datos se pueden exportar en CSV/Excel en cualquier momento. No hay lock-in, tus datos son tuyos.',
  },
  {
    question: '¿Qué tipo de soporte ofrecen?',
    answer: 'Soporte por email en todos los planes, con tiempo de respuesta de 24h. Los planes Intermedio y Avanzado incluyen soporte prioritario y llamadas de onboarding.',
  },
  {
    question: '¿Hay límite en el número de cursos?',
    answer: 'No hay límite en cursos creados, solo en cursos activos por alumno según tu plan. Puedes crear tantos cursos como necesites.',
  },
] as const;

export const SOCIAL_PROOF = {
  headline: 'Confiado por academias líderes',
  testimonials: [
    {
      quote: 'IntiHubs nos ayudó a digitalizar nuestra academia en semanas, no meses.',
      author: 'María González',
      role: 'Directora, Academia Futuro',
      avatar: '/landing/testimonial-1.jpg',
    },
    {
      quote: 'La analítica pedagógica cambió completamente cómo entendemos a nuestros estudiantes.',
      author: 'Carlos Ruiz',
      role: 'Fundador, TechAcademy',
      avatar: '/landing/testimonial-2.jpg',
    },
    {
      quote: 'Finalmente una plataforma que entiende las necesidades reales de los profesores.',
      author: 'Ana Martínez',
      role: 'Profesora Independiente',
      avatar: '/landing/testimonial-3.jpg',
    },
  ],
} as const;

export const ANALYTICS_SHOWCASE = {
  headline: 'Analítica que impulsa resultados',
  subtext: 'Toma decisiones basadas en datos reales de tu academia',
  metrics: [
    {
      label: 'Asistencia promedio',
      value: '87%',
      trend: '+5%',
      positive: true,
    },
    {
      label: 'Retención estudiantes',
      value: '92%',
      trend: '+12%',
      positive: true,
    },
    {
      label: 'Progreso cursos',
      value: '78%',
      trend: '+8%',
      positive: true,
    },
    {
      label: 'Ocupación aulas',
      value: '85%',
      trend: '+3%',
      positive: true,
    },
  ],
} as const;

export const NAVIGATION = {
  login: 'Iniciar sesión',
  signup: 'Probar gratis',
} as const;

export const FOOTER = {
  description: 'CRM educativo + plataforma de clases híbridas para academias y profesores.',
  links: {
    product: [
      { label: 'Características', href: '#features' },
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
      { label: 'Términos', href: '/terms' },
      { label: 'Cookies', href: '/cookies' },
    ],
  },
  copyright: `© ${new Date().getFullYear()} ${BRAND.name}. Todos los derechos reservados.`,
} as const;



