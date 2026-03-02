'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef, useState } from 'react';
import { Container } from './ui/Container';
import { SectionHeading } from './ui/SectionHeading';

const mockDashboardData = [
  {
    title: 'Dashboard Principal',
    description: 'Vista general de tu academia',
    metrics: [
      { label: 'Estudiantes activos', value: '247' },
      { label: 'Cursos en progreso', value: '12' },
      { label: 'Asistencia promedio', value: '87%' },
    ],
  },
  {
    title: 'Analítica Avanzada',
    description: 'Métricas que impulsan decisiones',
    metrics: [
      { label: 'Retención', value: '92%' },
      { label: 'Progreso promedio', value: '78%' },
      { label: 'Satisfacción', value: '4.8/5' },
    ],
  },
  {
    title: 'Gestión de Videos',
    description: 'Contenido seguro y optimizado',
    metrics: [
      { label: 'Videos subidos', value: '156' },
      { label: 'Horas de contenido', value: '89h' },
      { label: 'Reproducciones', value: '2.1k' },
    ],
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,
    },
  },
};

export const MiniDemo = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const [activeCard, setActiveCard] = useState(0);

  return (
    <section id="demo" ref={ref} className="py-16 lg:py-24 bg-white">
      <Container>
        <SectionHeading
          subtitle="Demo en vivo"
          title="Siente el poder de IntiHubs"
          description="Explora las interfaces que transformarán tu academia"
          className="mb-16"
        />

        <div className="max-w-6xl mx-auto">
          {/* Tab Navigation */}
          <div className="flex justify-center mb-12">
            <div className="bg-gray-100 p-1 rounded-xl">
              {mockDashboardData.map((item, index) => (
                <button
                  key={index}
                  onClick={() => setActiveCard(index)}
                  className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
                    activeCard === index
                      ? 'bg-white text-amber-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {item.title}
                </button>
              ))}
            </div>
          </div>

          {/* Demo Cards */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {mockDashboardData.map((card, index) => (
              <motion.div
                key={index}
                variants={cardVariants}
                transition={{
                  duration: 0.6,
                  delay: index * 0.15,
                  ease: 'easeOut',
                }}
                whileHover={{
                  y: -8,
                  scale: 1.02,
                  transition: { type: 'spring', stiffness: 300, damping: 24 },
                }}
                className={`group cursor-pointer ${
                  activeCard === index ? 'ring-2 ring-amber-500' : ''
                }`}
                onClick={() => setActiveCard(index)}
              >
                <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl p-8 border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 h-full">
                  {/* Header */}
                  <div className="mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center mb-4">
                      <span className="text-white text-xl">
                        {index === 0 ? '📊' : index === 1 ? '📈' : '🎥'}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {card.title}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      {card.description}
                    </p>
                  </div>

                  {/* Mock Metrics */}
                  <div className="space-y-4">
                    {card.metrics.map((metric, metricIndex) => (
                      <div
                        key={metricIndex}
                        className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-100"
                      >
                        <span className="text-sm text-gray-600">
                          {metric.label}
                        </span>
                        <span className="font-semibold text-gray-900">
                          {metric.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-6">
                    <div className="flex justify-between text-xs text-gray-500 mb-2">
                      <span>Progreso</span>
                      <span>{85 + index * 5}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <motion.div
                        className="bg-gradient-to-r from-amber-500 to-amber-600 h-2 rounded-full"
                        initial={{ width: 0 }}
                        animate={
                          isInView ? { width: `${85 + index * 5}%` } : { width: 0 }
                        }
                        transition={{ duration: 1, delay: 0.5 + index * 0.2 }}
                      />
                    </div>
                  </div>

                  {/* Hover Effect */}
                  <div className="w-0 group-hover:w-full h-1 bg-gradient-to-r from-amber-500 to-amber-600 rounded-full mt-6 transition-all duration-500"></div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Bottom CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="text-center mt-12"
          >
            <p className="text-gray-600 mb-6">
              ¿Quieres ver más? Solicita una demo personalizada
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn-primary"
            >
              Solicitar demo completa
            </motion.button>
          </motion.div>
        </div>
      </Container>
    </section>
  );
};



