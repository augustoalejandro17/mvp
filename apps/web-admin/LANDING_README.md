# IntiHubs Landing Page

A high-performance, conversion-optimized landing page built with Next.js App Router, TypeScript, TailwindCSS, and Framer Motion.

## 🚀 Features

- **Next.js App Router**: Modern routing with server components
- **TypeScript**: Type-safe development
- **TailwindCSS**: Utility-first styling with custom design system
- **Framer Motion**: Smooth animations and microinteractions
- **SEO Optimized**: Meta tags, JSON-LD, Open Graph
- **Performance First**: Optimized for Core Web Vitals
- **Mobile Responsive**: Mobile-first design approach
- **Accessibility**: WCAG AA compliant

## 📁 Structure

```
app/
├── layout.tsx              # Root layout with SEO
├── page.tsx               # Main landing page
├── globals.css            # Global styles
├── api/
│   └── lead/
│       └── route.ts       # Lead form API endpoint
└── components/
    ├── Header.tsx         # Sticky navigation
    ├── Hero.tsx           # Hero section with CTAs
    ├── SocialProof.tsx    # Testimonials and stats
    ├── Differentiators.tsx # What makes us different
    ├── Features.tsx       # Feature grid
    ├── MiniDemo.tsx       # Interactive demo
    ├── AnalyticsShowcase.tsx # Analytics preview
    ├── Pricing.tsx        # Pricing tiers
    ├── CTA.tsx           # Final call-to-action
    ├── FAQ.tsx           # Frequently asked questions
    ├── Footer.tsx        # Site footer
    └── ui/
        ├── Container.tsx  # Layout container
        └── SectionHeading.tsx # Reusable section headers

lib/
├── copy.ts               # All content and copy
├── analytics.ts          # Analytics tracking
└── utils.ts             # Utility functions
```

## 🎨 Design System

### Colors
- **Primary**: Amber (#f59e0b) - CTAs and accents
- **Background**: White with subtle gradients
- **Text**: Gray scale for hierarchy
- **Success**: Green for positive metrics
- **Error**: Red for negative metrics

### Typography
- **Font**: Inter (system fallback)
- **Headings**: Bold, large scale
- **Body**: Regular, readable sizes
- **UI**: Medium weight for buttons/labels

### Components
- **Buttons**: Primary (amber) and secondary (white/gray)
- **Cards**: White with subtle shadows and hover effects
- **Animations**: Subtle fade/slide/scale with spring physics

## 📝 Content Management

All content is centralized in `lib/copy.ts`:

### Updating Copy
```typescript
// Edit brand information
export const BRAND = {
  name: 'IntiHubs',
  slogan: 'Conecta. Aprende. Crece.',
  // ...
};

// Update hero section
export const HERO = {
  headline: 'Your new headline',
  subtext: 'Your new subtext',
  // ...
};
```

### Updating Features
```typescript
export const FEATURES = [
  {
    title: 'New Feature',
    description: 'Feature description',
    icon: '🎯', // Emoji icon
  },
  // ...
];
```

### Updating Pricing
```typescript
export const PRICING_TIERS = [
  {
    name: 'Plan Name',
    price: 99,
    period: 'mes',
    description: 'Plan description',
    features: ['Feature 1', 'Feature 2'],
    popular: true, // Highlights the tier
  },
  // ...
];
```

## 🔧 Configuration

### Analytics
Update `lib/analytics.ts` to configure tracking:
```typescript
// Add your Google Analytics ID
// Add your Facebook Pixel ID
// Customize event tracking
```

### SEO
Update `app/layout.tsx` for SEO settings:
```typescript
export const metadata: Metadata = {
  title: 'Your Title',
  description: 'Your Description',
  // Update Open Graph images
  // Update verification codes
};
```

## 🎯 Performance Optimizations

- **Image Optimization**: Next.js Image component with lazy loading
- **Font Loading**: Preloaded Inter font with display: swap
- **Code Splitting**: Automatic with Next.js App Router
- **Animation Performance**: CSS transforms, avoid layout thrash
- **Bundle Size**: Tree-shaking, minimal dependencies

## 📱 Responsive Design

- **Mobile First**: Designed for mobile, enhanced for desktop
- **Breakpoints**: sm (640px), md (768px), lg (1024px), xl (1280px)
- **Touch Friendly**: Adequate touch targets, hover states
- **Performance**: Optimized animations for mobile devices

## 🧪 Testing

### Lighthouse Targets
- **Performance**: ≥ 90
- **Accessibility**: ≥ 95
- **Best Practices**: ≥ 90
- **SEO**: ≥ 90

### Manual Testing
- [ ] All CTAs work correctly
- [ ] Forms submit successfully
- [ ] Animations are smooth on mobile
- [ ] Content is readable at all screen sizes
- [ ] Navigation works properly

## 🚀 Deployment

### Environment Variables
```bash
NEXT_PUBLIC_API_URL=your_api_url
NEXT_PUBLIC_GA_ID=your_google_analytics_id
NEXT_PUBLIC_FB_PIXEL_ID=your_facebook_pixel_id
```

### Build Commands
```bash
npm run build    # Build for production
npm run start    # Start production server
npm run dev      # Development server
```

## 🔄 Updates and Maintenance

### Adding New Sections
1. Create component in `app/components/`
2. Add content to `lib/copy.ts`
3. Import and add to `app/page.tsx`
4. Update navigation if needed

### Updating Images
- Replace files in `public/landing/`
- Maintain aspect ratios for best results
- Optimize images before upload (WebP recommended)

### A/B Testing
- Use feature flags or environment variables
- Test different headlines, CTAs, pricing
- Monitor conversion rates and user behavior

## 📞 Support

For questions about the landing page implementation:
- Check this README first
- Review component documentation
- Test changes in development environment
- Monitor performance after updates

---

Built with ❤️ for IntiHubs - Conecta. Aprende. Crece.



