import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const formData = await request.formData();
    
    // Get message text
    const text = formData.get('text')?.toString()?.trim();

    // Get image file
    const imageFile = formData.get('image') as File | null;
    
    // Prepare FormData
    const newFormData = new FormData();
    
    // Add text if exists
    if (text) {
      newFormData.append('text', text);
    }
    
    // Add image if exists
    if (imageFile && imageFile instanceof File) {
      newFormData.append('image', imageFile);
    }
    
    // At least one field required
    if (!text && !imageFile) {
      return NextResponse.json(
        { error: 'Message text or image is required' },
        { status: 400 }
      );
    }
    
    // Get auth header
    const headersList = await headers();
    const authHeader = headersList.get('Authorization') || '';

    // Forward to API
    const apiUrl = process.env.API_BASE || 'http://localhost:3000';
    
    // Make POST request
    const response = await fetch(`${apiUrl}/api/messages/${params.id}`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
      },
      body: newFormData,
    });

    // Check response
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', errorText);
      return NextResponse.json(
        { error: errorText || 'Failed to send message' },
        { status: response.status }
      );
    }

    // Return successful response
    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Message send error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send message' },
      { status: 500 }
    );
  }
}