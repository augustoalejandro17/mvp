import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { metric, from, to, academyId } = req.query;

    // Mock data for professors - replace with actual backend API call
    const mockProfessors = [
      {
        id: 'prof1',
        name: 'Maria Rodriguez',
        value: metric === 'revenue' ? 45000 : 0.92,
        context: {
          present: 120,
          absent: 10,
          maxSeats: 150,
          revenueCents: 45000,
          active: 85,
          dropped: 3
        }
      },
      {
        id: 'prof2',
        name: 'Carlos Mendez',
        value: metric === 'revenue' ? 38000 : 0.88,
        context: {
          present: 95,
          absent: 12,
          maxSeats: 120,
          revenueCents: 38000,
          active: 70,
          dropped: 5
        }
      },
      {
        id: 'prof3',
        name: 'Ana Silva',
        value: metric === 'revenue' ? 42000 : 0.95,
        context: {
          present: 110,
          absent: 5,
          maxSeats: 130,
          revenueCents: 42000,
          active: 78,
          dropped: 2
        }
      }
    ];

    res.status(200).json(mockProfessors);
  } catch (error) {
    console.error('Error fetching professor metrics:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
} 