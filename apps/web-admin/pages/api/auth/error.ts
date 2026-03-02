import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { error } = req.query;
  
  // Redirect to our custom error page with the error parameter
  const errorParam = typeof error === 'string' ? error : 'Default';
  res.redirect(302, `/auth/error?error=${encodeURIComponent(errorParam)}`);
} 