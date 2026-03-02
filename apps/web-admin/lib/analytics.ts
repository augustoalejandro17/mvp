type AnalyticsEvent = 
  | 'cta_clicked'
  | 'demo_requested'
  | 'signup_started'
  | 'pricing_viewed'
  | 'video_played'
  | 'form_submitted'
  | 'page_viewed';

interface AnalyticsPayload {
  [key: string]: string | number | boolean | undefined;
}

export const track = (event: AnalyticsEvent, payload?: AnalyticsPayload): void => {
  // Google Analytics 4
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', event, {
      ...payload,
      timestamp: Date.now(),
    });
  }

  // Facebook Pixel
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', event, payload);
  }

  // Console log for development
  if (process.env.NODE_ENV === 'development') {
    console.log('Analytics Event:', event, payload);
  }
};

export const trackPageView = (path: string): void => {
  track('page_viewed', { path });
};

export const trackCTAClick = (location: string, text: string): void => {
  track('cta_clicked', { location, text });
};

export const trackDemoRequest = (source: string): void => {
  track('demo_requested', { source });
};

export const trackSignupStart = (plan?: string): void => {
  track('signup_started', { plan });
};

export const trackPricingView = (tier: string): void => {
  track('pricing_viewed', { tier });
};

// Extend window type for TypeScript
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    fbq?: (...args: any[]) => void;
  }
}



