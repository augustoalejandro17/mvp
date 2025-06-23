import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { courseId, studentId, paymentId } = req.query;
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: 'Authorization header required' });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  if (req.method === 'PUT') {
    // Update payment
    try {
      const response = await axios.put(
        `${apiUrl}/api/courses/${courseId}/enrollment/${studentId}/payments/${paymentId}`,
        req.body,
        {
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
        }
      );

      res.status(200).json(response.data);
    } catch (error) {
      console.error('Error updating payment:', error);
      
      if (axios.isAxiosError(error) && error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  } else if (req.method === 'DELETE') {
    // Delete payment
    try {
      const response = await axios.delete(
        `${apiUrl}/api/courses/${courseId}/enrollment/${studentId}/payments/${paymentId}`,
        {
          headers: {
            Authorization: authHeader,
          },
        }
      );

      res.status(200).json(response.data);
    } catch (error) {
      console.error('Error deleting payment:', error);
      
      if (axios.isAxiosError(error) && error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  } else {
    res.setHeader('Allow', ['PUT', 'DELETE']);
    res.status(405).json({ message: 'Method not allowed' });
  }
} 