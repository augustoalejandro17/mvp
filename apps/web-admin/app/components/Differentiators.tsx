'use client';

import { motion } from 'framer-motion';
import { useInView } from 'framer-motion';
import { useRef } from 'react';
import { Container } from './ui/Container';
import { SectionHeading } from './ui/SectionHeading';
import { DIFFERENTIATORS } from '@/lib/copy';

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

export const Differentiators = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  return (
    <section ref={ref} className="py-16 lg:py-24 bg-white">
      <Container>
        <SectionHeading
          subtitle="Por qué empezar aquí"
          title="Una base simple para vender y operar mejor"
          description="Empieza con una forma más simple de publicar tus cursos, organizar tu contenido y acompañar a tus alumnos desde el celular."
          className="mb-16"
        />

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? 'visible' : 'hidden'}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
        >
          {DIFFERENTIATORS.map((item, index) => (
            <motion.div
              key={index}
              variants={cardVariants}
              transition={{
                duration: 0.6,
                delay: index * 0.1,
                ease: 'easeOut',
              }}
              whileHover={{
                y: -8,
                transition: { type: 'spring', stiffness: 300, damping: 24 },
              }}
              className="group"
            >
              <div className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 h-full">
                {/* Icon */}
                <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-3xl">{item.icon}</span>
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-gray-900 mb-4 group-hover:text-amber-600 transition-colors">
                  {item.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {item.description}
                </p>

                {/* Hover accent */}
                <div className="w-0 group-hover:w-12 h-1 bg-gradient-to-r from-amber-500 to-amber-600 rounded-full mt-6 transition-all duration-300"></div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </section>
  );
};
