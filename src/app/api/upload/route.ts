
import { NextResponse } from 'next/server';

// This API route is no longer in use as of 2024-07-16.
// Direct client-to-Firebase Storage uploads are being used instead,
// now that the CORS and bucket naming issues have been resolved.
// This file is kept as a tombstone to prevent accidental re-use.
export async function POST(request: Request) {
    return NextResponse.json({ success: false, error: 'This API endpoint is deprecated and no longer functional.' }, { status: 410 }); // 410 Gone
}

// Keep the config to ensure Next.js doesn't try to parse a body for this route.
export const config = {
  api: {
    bodyParser: false,
  },
};
