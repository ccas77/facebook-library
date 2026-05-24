import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('u');
  if (!url) {
    return new NextResponse('Missing url', { status: 400 });
  }

  // Whitelist: only Facebook CDN hosts
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse('Invalid url', { status: 400 });
  }
  if (!/(^|\.)(fbcdn\.net|facebook\.com)$/.test(parsed.hostname)) {
    return new NextResponse('Host not allowed', { status: 403 });
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.facebook.com/',
      },
    });

    if (!upstream.ok) {
      return new NextResponse(`Upstream ${upstream.status}`, { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') || 'image/jpeg';
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (e: any) {
    return new NextResponse(`Fetch failed: ${e?.message ?? 'unknown'}`, { status: 502 });
  }
}
