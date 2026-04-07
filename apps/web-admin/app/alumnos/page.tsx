'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Container } from '../components/ui/Container';
import { SectionHeading } from '../components/ui/SectionHeading';
import { trackCTAClick, trackPageView } from '@/lib/analytics';
import { LANDING_BRAND } from '@/lib/copy';

const highlights = [
  {
    title: 'Todo en un solo lugar',
    description: 'Encuentra clases, materiales, tareas y avisos sin depender de links sueltos.',
  },
  {
    title: 'Hecho para usar desde el celular',
    description: 'Revisa contenido, entrega tareas y sigue tus clases desde donde estés.',
  },
  {
    title: 'Más claridad en tu progreso',
    description: 'Sigue entregas, comentarios y novedades sin perderte en chats o archivos dispersos.',
  },
] as const;

const steps = [
  {
    title: 'Crea tu cuenta',
    description: 'Regístrate con tus datos para entrar a Inti y empezar a usar tu espacio de aprendizaje.',
    icon: '👋',
  },
  {
    title: 'Únete a tu curso',
    description: 'Accede al contenido y a las clases que tu profesor comparta dentro de la plataforma.',
    icon: '📚',
  },
  {
    title: 'Aprende y entrega',
    description: 'Mira clases, revisa materiales, envía tareas y mantente al día con los avisos.',
    icon: '✅',
  },
] as const;

const features = [
  {
    title: 'Clases y materiales ordenados',
    description: 'Accede a videos, playlists y recursos en una experiencia más clara y cuidada.',
    icon: '🎬',
  },
  {
    title: 'Entregas desde un solo flujo',
    description: 'Envía tareas o trabajos sin salirte a herramientas externas.',
    icon: '📝',
  },
  {
    title: 'Feedback más visible',
    description: 'Recibe comentarios de tu profesor y ten más claro qué revisar o mejorar.',
    icon: '💬',
  },
  {
    title: 'Avisos importantes',
    description: 'Mantente al día con cambios, recordatorios y novedades del curso.',
    icon: '🔔',
  },
] as const;

const faqItems = [
  {
    question: '¿Necesito pagar para crear mi cuenta como alumno?',
    answer:
      'No necesariamente. El acceso depende de cómo tu profesor gestione sus cursos, pero la idea es que puedas registrarte y entrar fácilmente a tu espacio dentro de Inti.',
  },
  {
    question: '¿Puedo usar Inti desde mi celular?',
    answer:
      'Sí. La experiencia está pensada para que puedas seguir tus cursos, revisar contenido y entregar tareas desde el móvil.',
  },
  {
    question: '¿Qué hago si mi profesor me invitó pero no sé cómo entrar?',
    answer:
      'Puedes crear tu cuenta desde esta página. Si todavía tienes dudas, puedes pedirle a tu profesor el enlace o las instrucciones para unirte.',
  },
  {
    question: '¿Puedo ver todo mi contenido en un solo lugar?',
    answer:
      'Sí. La idea es que clases, materiales, entregas y avisos estén organizados dentro de la misma plataforma.',
  },
] as const;

export default function StudentLandingPage() {
  useEffect(() => {
    trackPageView('/alumnos');
  }, []);

  return (
    <main className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
        <Container>
          <div className="flex h-16 items-center justify-between lg:h-20">
            <Link href="/landing" className="flex items-center space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600">
                <span className="text-lg font-bold text-white">I</span>
              </div>
              <span className="text-xl font-bold text-gray-900">{LANDING_BRAND.name}</span>
            </Link>

            <nav className="hidden items-center space-x-8 md:flex">
              <Link href="#como-funciona" className="font-medium text-gray-600 transition-colors hover:text-gray-900">
                Cómo funciona
              </Link>
              <Link href="#features" className="font-medium text-gray-600 transition-colors hover:text-gray-900">
                Qué puedes hacer
              </Link>
              <Link href="#faq" className="font-medium text-gray-600 transition-colors hover:text-gray-900">
                FAQ
              </Link>
              <Link href="/landing" className="font-medium text-amber-700 transition-colors hover:text-amber-800">
                Para profesores
              </Link>
            </nav>

            <div className="flex items-center space-x-3">
              <Link
                href="/register"
                onClick={() => trackCTAClick('student-header', 'Crear cuenta')}
                className="btn-primary text-sm"
              >
                Crear cuenta
              </Link>
            </div>
          </div>
        </Container>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-white to-orange-50 pb-16 pt-20 lg:pb-20 lg:pt-24">
        <div className="absolute inset-0">
          <div className="absolute right-0 top-0 h-1/3 w-1/3 rounded-full bg-gradient-to-bl from-amber-100 to-transparent opacity-60 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-1/4 w-1/4 rounded-full bg-gradient-to-tr from-orange-100 to-transparent opacity-40 blur-3xl" />
        </div>

        <Container className="relative">
          <div className="mx-auto max-w-5xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-6 inline-flex items-center rounded-full bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800"
            >
              <span className="mr-2 h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              Para alumnos que quieren aprender con más orden
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mb-6 text-4xl font-bold text-gray-900 sm:text-5xl lg:text-6xl"
            >
              Tus cursos, clases y tareas
              <br />
              <span className="gradient-text">en un solo lugar</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mx-auto mb-8 max-w-3xl text-lg text-gray-600 lg:text-xl"
            >
              Inti te ayuda a acceder al contenido que comparte tu profesor, revisar tus clases, entregar tareas y mantenerte al día sin depender de chats o archivos dispersos.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="flex items-center justify-center"
            >
              <Link
                href="/register"
                onClick={() => trackCTAClick('student-hero', 'Crear cuenta')}
                className="btn-primary w-full px-8 py-4 text-lg sm:w-auto"
              >
                Crear cuenta
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="mt-12 border-t border-gray-200 pt-8"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {highlights.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm">
                    <p className="mb-1 text-sm font-semibold text-gray-900">{item.title}</p>
                    <p className="text-sm text-gray-600">{item.description}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </Container>
      </section>

      <section id="como-funciona" className="py-16 lg:py-24">
        <Container>
          <SectionHeading
            subtitle="Cómo funciona"
            title="Empieza a usar Inti sin complicarte"
            description="Si tu profesor ya trabaja con Inti, aquí tienes una forma más simple de entrar, seguir tu contenido y mantener tus tareas al día."
            className="mb-16"
          />

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.title} className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl">
                  {step.icon}
                </div>
                <h3 className="mb-3 text-xl font-bold text-gray-900">{step.title}</h3>
                <p className="leading-relaxed text-gray-600">{step.description}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section id="features" className="bg-gray-50 py-16 lg:py-24">
        <Container>
          <SectionHeading
            subtitle="Qué puedes hacer"
            title="Una experiencia más clara para aprender"
            description="Inti busca que como alumno tengas menos fricción para estudiar y más claridad para seguir tus clases."
            className="mb-16"
          />

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl">
                  {feature.icon}
                </div>
                <h3 className="mb-3 text-xl font-bold text-gray-900">{feature.title}</h3>
                <p className="leading-relaxed text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-16 lg:py-24">
        <Container size="md">
          <div className="rounded-[2rem] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-8 shadow-[0_24px_80px_-32px_rgba(217,119,6,0.45)] lg:p-12">
            <SectionHeading
              subtitle="Pensado para el día a día"
              title="Menos desorden, más foco para aprender"
              description="Cuando el contenido está mejor organizado, estudiar se vuelve más simple. Esa es la experiencia que queremos construir también para los alumnos."
              className="mb-10"
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-amber-200 bg-white/80 p-5">
                <p className="text-sm font-semibold text-gray-900">Clases</p>
                <p className="mt-2 text-sm text-gray-600">Revisa videos y materiales sin buscar en varios lugares.</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-white/80 p-5">
                <p className="text-sm font-semibold text-gray-900">Tareas</p>
                <p className="mt-2 text-sm text-gray-600">Ten más claro qué debes entregar y cuándo.</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-white/80 p-5">
                <p className="text-sm font-semibold text-gray-900">Seguimiento</p>
                <p className="mt-2 text-sm text-gray-600">Mira avisos y feedback sin perderte en el proceso.</p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <section id="faq" className="bg-gray-50 py-16 lg:py-24">
        <Container size="md">
          <SectionHeading
            subtitle="FAQ"
            title="Preguntas frecuentes"
            description="Si estás entrando por primera vez, esto te ayuda a ubicarte rápido."
            className="mb-12"
          />

          <div className="space-y-4">
            {faqItems.map((item) => (
              <div key={item.question} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-3 text-lg font-semibold text-gray-900">{item.question}</h3>
                <p className="leading-relaxed text-gray-600">{item.answer}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-16 lg:py-24">
        <Container size="md">
          <div className="rounded-[2rem] border border-gray-200 bg-white p-8 text-center shadow-[0_24px_80px_-32px_rgba(15,23,42,0.22)] lg:p-12">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-600">Empieza hoy</p>
            <h2 className="mb-4 text-3xl font-bold text-gray-900 lg:text-4xl">
              Si tu profesor ya usa Inti, tu cuenta puede ser el primer paso
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-lg text-gray-600">
              Crea tu cuenta, entra a tus cursos y lleva tus clases, materiales y tareas en una experiencia más simple.
            </p>

            <div className="flex items-center justify-center">
              <Link
                href="/register"
                onClick={() => trackCTAClick('student-cta', 'Crear cuenta')}
                className="btn-primary w-full px-8 py-4 text-lg sm:w-auto"
              >
                Crear cuenta
              </Link>
            </div>
          </div>
        </Container>
      </section>

      <footer className="border-t border-gray-200 bg-gray-50">
        <Container>
          <div className="flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link href="/landing" className="mb-2 flex items-center space-x-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600">
                  <span className="text-lg font-bold text-white">I</span>
                </div>
                <span className="text-xl font-bold text-gray-900">{LANDING_BRAND.name}</span>
              </Link>
              <p className="max-w-md text-sm text-gray-600">
                Una experiencia pensada para que profesores y alumnos se encuentren en un solo lugar para aprender con más orden.
              </p>
            </div>

            <div className="flex flex-wrap gap-6 text-sm">
              <Link href="/landing" className="text-gray-600 transition-colors hover:text-gray-900">
                Para profesores
              </Link>
              <Link href="/register" className="text-gray-600 transition-colors hover:text-gray-900">
                Crear cuenta
              </Link>
            </div>
          </div>
        </Container>
      </footer>
    </main>
  );
}
