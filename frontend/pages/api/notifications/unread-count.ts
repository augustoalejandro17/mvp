import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000';
    const url = `${backendUrl}/api/notifications/unread-count`;
    
    console.log('🔧 Frontend API: Unread count request');
    console.log('🔧 Backend URL:', url);
    console.log('🔧 Authorization header:', req.headers.authorization ? 'Present' : 'Missing');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': req.headers.authorization || '',
      },
    });

    const data = await response.json();
    console.log('🔧 Backend response status:', response.status);
    console.log('🔧 Backend response data:', data);

    if (!response.ok) {
      console.error('🔧 Backend error:', data);
      return res.status(response.status).json(data);
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('🔧 Unread count API error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
} 