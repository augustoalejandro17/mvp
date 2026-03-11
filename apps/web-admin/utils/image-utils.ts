const getImageUrl = (imagePath: string): string => {
  if (!imagePath) return '';

  // Remove leading slash if present
  const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;

  const assetDomainRaw =
    process.env.NEXT_PUBLIC_ASSET_DOMAIN ||
    process.env.NEXT_PUBLIC_ASSET_BASE_URL;
  const normalizedAssetDomain = assetDomainRaw
    ? assetDomainRaw.replace(/^https?:\/\//, '').replace(/\/$/, '')
    : '';

  // In development, use the proxied path to avoid CORS issues
  if (process.env.NODE_ENV === 'development') {
    return `/${cleanPath}`;
  }

  // In production, use configured CDN/public domain (R2 custom domain).
  if (normalizedAssetDomain) {
    return `https://${normalizedAssetDomain}/${cleanPath}`;
  }

  // Legacy fallback to avoid breaking existing deployments that still use CloudFront.
  return `https://digooy7d0nfl3.cloudfront.net/${cleanPath}`;
};

export { getImageUrl }; 
