import { IsEmail, IsOptional, IsUrl } from 'class-validator';

export class CreateCheckoutSessionDto {
  @IsOptional()
  @IsUrl(
    {
      require_tld: false,
      protocols: ['http', 'https'],
    },
    { message: 'successUrl debe ser una URL válida' },
  )
  successUrl?: string;

  @IsOptional()
  @IsUrl(
    {
      require_tld: false,
      protocols: ['http', 'https'],
    },
    { message: 'cancelUrl debe ser una URL válida' },
  )
  cancelUrl?: string;

  @IsOptional()
  @IsEmail({}, { message: 'customerEmail debe ser un email válido' })
  customerEmail?: string;
}
