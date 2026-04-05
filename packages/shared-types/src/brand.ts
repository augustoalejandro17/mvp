export const BRAND = {
  name: 'IntiHubs',
  appName: 'Inti',
  slogan: 'Conecta. Aprende. Crece.',
  email: 'hola@intihubs.com',
  url: 'https://intihubs.com',
} as const;

export type BrandConfig = typeof BRAND;
