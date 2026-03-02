export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'not set',
  });
} 