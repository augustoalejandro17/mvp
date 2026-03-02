import { NextRequest, NextResponse } from 'next/server';

interface LeadFormData {
  name: string;
  email: string;
  academia: string;
  tamaño: string;
  mensaje?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: LeadFormData = await request.json();
    
    // Validate required fields
    if (!body.name || !body.email || !body.academia || !body.tamaño) {
      return NextResponse.json(
        { error: 'Todos los campos son requeridos' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      );
    }

    // Log the lead (in production, you'd save to database or send to CRM)
    console.log('New lead received:', {
      name: body.name,
      email: body.email,
      academia: body.academia,
      tamaño: body.tamaño,
      mensaje: body.mensaje,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    });

    // TODO: In production, implement:
    // 1. Save to database
    // 2. Send notification email to sales team
    // 3. Add to CRM/marketing automation
    // 4. Send welcome email to lead

    return NextResponse.json(
      { 
        success: true, 
        message: 'Solicitud recibida correctamente. Te contactaremos pronto.' 
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error processing lead:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}



