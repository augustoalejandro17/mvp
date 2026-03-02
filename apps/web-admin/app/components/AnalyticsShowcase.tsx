'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { Container } from './ui/Container';
import { SectionHeading } from './ui/SectionHeading';
import { ANALYTICS_SHOWCASE } from '@/lib/copy';

const SparklineChart = ({ data, color = '#f59e0b' }: { data: number[]; color?: string }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min;
  
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="w-full h-12" viewBox="0 0 100 100" preserveAspectRatio="none">
      <motion.polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2, ease: 'easeInOut' }}
      />
      <defs>
        <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.polygon
        fill={`url(#gradient-${color.replace('#', '')})`}
        points={`0,100 ${points} 100,100`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, delay: 0.5 }}
      />
    </svg>
  );
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

export const AnalyticsShowcase = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  // Mock data for sparklines
  const sparklineData = [
    [65, 70, 68, 75, 80, 85, 87, 90, 87, 92],
    [70, 75, 73, 80, 85, 88, 92, 95, 92, 96],
    [60, 65, 70, 75, 78, 82, 78, 85, 88, 90],
    [75, 78, 80, 82, 85, 88, 85, 90, 92, 95],
  ];

  return (
    <section ref={ref} className="py-16 lg:py-24 bg-gradient-to-br from-amber-50 via-white to-orange-50">
      <Container>
        <SectionHeading
          subtitle="Analítica Inteligente"
          title={ANALYTICS_SHOWCASE.headline}
          description={ANALYTICS_SHOWCASE.subtext}
          className="mb-16"
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16"
        >
          {ANALYTICS_SHOWCASE.metrics.map((metric, index) => (
            <motion.div
              key={index}
              variants={cardVariants}
              transition={{
                duration: 0.6,
                delay: index * 0.1,
                ease: 'easeOut',
              }}
              whileHover={{
                y: -4,
                transition: { type: 'spring', stiffness: 300, damping: 24 },
              }}
              className="group"
            >
              <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300">
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{metric.label}</p>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-3xl font-bold text-gray-900">
                        {metric.value}
                      </span>
                      <span
                        className={`text-sm font-medium ${
                          metric.positive ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {metric.trend}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      metric.positive ? 'bg-green-100' : 'bg-red-100'
                    }`}
                  >
                    <span className="text-sm">
                      {metric.positive ? '📈' : '📉'}
                    </span>
                  </div>
                </div>

                {/* Sparkline */}
                <div className="h-12 mb-4">
                  <SparklineChart 
                    data={sparklineData[index]} 
                    color={metric.positive ? '#10b981' : '#ef4444'} 
                  />
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>Últimos 30 días</span>
                  <span className="group-hover:text-amber-600 transition-colors">
                    Ver detalles →
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Additional Analytics Preview */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="bg-white rounded-3xl p-8 lg:p-12 border border-gray-100 shadow-lg"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div>
              <h3 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-6">
                Dashboards que cuentan historias
              </h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-amber-600 text-xs">✓</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Segmentación avanzada</p>
                    <p className="text-gray-600 text-sm">Analiza por cohortes, edad, ubicación y más</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-amber-600 text-xs">✓</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Alertas inteligentes</p>
                    <p className="text-gray-600 text-sm">Recibe notificaciones cuando algo requiere atención</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-amber-600 text-xs">✓</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Exportación BI-ready</p>
                    <p className="text-gray-600 text-sm">Conecta con Power BI, Tableau o tu herramienta favorita</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Visual */}
            <div className="relative">
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 border border-gray-200">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Rendimiento por curso</span>
                    <span className="text-xs text-gray-500">Esta semana</span>
                  </div>
                  
                  {/* Mock Chart Bars */}
                  <div className="space-y-3">
                    {[
                      { name: 'JavaScript Avanzado', value: 92, color: 'bg-amber-500' },
                      { name: 'React Fundamentals', value: 87, color: 'bg-blue-500' },
                      { name: 'Node.js Backend', value: 78, color: 'bg-green-500' },
                      { name: 'UI/UX Design', value: 95, color: 'bg-purple-500' },
                    ].map((course, index) => (
                      <div key={index} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">{course.name}</span>
                          <span className="font-medium">{course.value}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <motion.div
                            className={`h-2 rounded-full ${course.color}`}
                            initial={{ width: 0 }}
                            animate={isInView ? { width: `${course.value}%` } : { width: 0 }}
                            transition={{ duration: 1.5, delay: 0.8 + index * 0.1 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </Container>
    </section>
  );
};



