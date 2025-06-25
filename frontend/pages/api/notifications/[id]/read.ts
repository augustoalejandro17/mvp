import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id } = req.query;

  try {
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL;
    const url = `${backendUrl}/api/notifications/${id}/read`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': req.headers.authorization || '',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('Mark as read API error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
} 