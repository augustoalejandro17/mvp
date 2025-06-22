import { NextApiRequest, NextApiResponse } from 'next';

function getTokenFromRequest(req: NextApiRequest): string | null {
  // Try to get token from Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Try to get token from cookies
  const token = req.cookies.token;
  return token || null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    let endpoint = '';
    let method = 'POST';

    if (req.method === 'GET') {
      // Get upcoming classes
      endpoint = `${process.env.NEXT_PUBLIC_API_URL}/notifications/debug/upcoming-classes`;
      method = 'GET';
    } else {
      const { action, courseId } = req.body;

      switch (action) {
        case 'trigger-check':
          endpoint = `${process.env.NEXT_PUBLIC_API_URL}/notifications/debug/trigger-check`;
          break;
        case 'send-test':
          if (!courseId) {
            return res.status(400).json({ message: 'Course ID required for test notification' });
          }
          endpoint = `${process.env.NEXT_PUBLIC_API_URL}/notifications/debug/send-test/${courseId}`;
          break;
        default:
          return res.status(400).json({ message: 'Invalid action' });
      }
    }

    const response = await fetch(endpoint, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Error en la petición');
    }

    res.status(200).json(data);
  } catch (error: any) {
    console.error('Debug API error:', error);
    res.status(500).json({ 
      message: 'Error interno del servidor',
      error: error.message 
    });
  }
} 