import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method, headers, body } = req;
  const { courseId } = req.query;
  
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    const url = `${backendUrl}/courses/${courseId}/schedule`;
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': headers.authorization || '',
      },
      body: method !== 'GET' ? JSON.stringify(body) : undefined,
    });

    if (response.status === 404 && method === 'GET') {
      // Return null for GET requests when schedule doesn't exist
      return res.status(200).json(null);
    }

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('Course schedule API error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
} 