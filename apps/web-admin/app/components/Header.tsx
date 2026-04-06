'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Container } from './ui/Container';
import { CONTACT_MAILTO, LANDING_BRAND, NAVIGATION } from '@/lib/copy';
import { trackCTAClick } from '@/lib/analytics';

export const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSignupClick = () => {
    trackCTAClick('header', NAVIGATION.signup);
  };

  return (
    <motion.header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        isScrolled 
          ? 'bg-white/95 backdrop-blur-sm shadow-sm' 
          : 'bg-transparent'
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <Container>
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center space-x-2 group"
            aria-label={`${LANDING_BRAND.name} - Inicio`}
          >
            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">I</span>
            </div>
            <span className="text-xl font-bold text-gray-900 group-hover:text-amber-600 transition-colors">
              {LANDING_BRAND.name}
            </span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link 
              href="#features" 
              className="text-gray-600 hover:text-gray-900 transition-colors font-medium"
            >
              Características
            </Link>
            <Link 
              href="#pricing" 
              className="text-gray-600 hover:text-gray-900 transition-colors font-medium"
            >
              Precios
            </Link>
            <Link 
              href="#faq" 
              className="text-gray-600 hover:text-gray-900 transition-colors font-medium"
            >
              FAQ
            </Link>
          </nav>

          {/* CTA Buttons */}
          <div className="flex items-center space-x-4">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <a
                href={CONTACT_MAILTO}
                onClick={handleSignupClick}
                className="btn-primary text-sm"
              >
                {NAVIGATION.signup}
              </a>
            </motion.div>
          </div>
        </div>
      </Container>
    </motion.header>
  );
};


