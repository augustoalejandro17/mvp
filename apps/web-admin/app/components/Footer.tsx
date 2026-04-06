import Link from 'next/link';
import { Container } from './ui/Container';
import { FOOTER, LANDING_BRAND } from '@/lib/copy';

export const Footer = () => {
  return (
    <footer className="bg-gray-50 border-t border-gray-200">
      <Container>
        <div className="py-12 lg:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Brand */}
            <div className="lg:col-span-2">
              <Link href="/" className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">I</span>
                </div>
                <span className="text-xl font-bold text-gray-900">
                  {LANDING_BRAND.name}
                </span>
              </Link>
              <p className="text-gray-600 mb-4 max-w-md">
                {FOOTER.description}
              </p>
              <p className="text-sm text-gray-500">
                Contacto: {' '}
                <a 
                  href={`mailto:${LANDING_BRAND.contactEmail}`}
                  className="text-amber-600 hover:text-amber-700 transition-colors"
                >
                  {LANDING_BRAND.contactEmail}
                </a>
              </p>
            </div>

            {/* Product Links */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Producto</h3>
              <ul className="space-y-3">
                {FOOTER.links.product.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-12 pt-8 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center">
            <p className="text-sm text-gray-500 mb-4 sm:mb-0">
              {FOOTER.copyright}
            </p>
            <div className="flex space-x-6">
              {FOOTER.links.legal.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </footer>
  );
};

