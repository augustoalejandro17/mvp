import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { from, to, academyId } = req.query;

    // Mock data for now - replace with actual backend API call
    const mockOverview = {
      dateRange: { 
        from: from as string || '2024-01-01', 
        to: to as string || '2024-01-31' 
      },
      totalRevenueCents: 125000, // $1,250.00
      totalPresent: 450,
      totalAbsent: 50,
      attendanceRate: 0.9, // 90%
      occupancyRate: 0.75, // 75%
      noShowRate: 0.1, // 10%
      avgRetentionDays: 120,
      totalActive: 200,
      totalDropped: 15,
      churnRate: 0.075 // 7.5%
    };

    res.status(200).json(mockOverview);
  } catch (error) {
    console.error('Error fetching overview stats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
} 