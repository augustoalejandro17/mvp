const getImageUrl = (imagePath: string): string => {
  if (!imagePath) return '';
  
  // Remove leading slash if present
  const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
  
  // In development, use the proxied path to avoid CORS issues
  if (process.env.NODE_ENV === 'development') {
    return `/${cleanPath}`;
  }
  
  // In production, use the CloudFront URL directly
  return `https://digooy7d0nfl3.cloudfront.net/${cleanPath}`;
};

export { getImageUrl }; 