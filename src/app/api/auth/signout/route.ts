import { NextRequest, NextResponse } from 'next/server';

const BACKEND = 'https://crmback.erp-apex.com';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const token = body.token;
        if (token) {
            await fetch(`${BACKEND}/api/Auth/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
            });
        }
    } catch { /* ignore */ }
    return NextResponse.json({ ok: true });
}
