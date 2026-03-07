import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const APEX_BASE = process.env.APEX_BASE_URL ?? 'https://gate.erp-apex.com';
const PASS_KEY = process.env.APEX_PASS_KEY ?? '';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const PageNumber = searchParams.get('PageNumber') ?? '1';
    const PageSize = searchParams.get('PageSize') ?? '20';
    const DateFrom = searchParams.get('DateFrom') ?? '';
    const DateTo = searchParams.get('DateTo') ?? '';

    const params = new URLSearchParams({ PassKey: PASS_KEY, PageNumber, PageSize });
    if (DateFrom) params.set('DateFrom', DateFrom);
    if (DateTo) params.set('DateTo', DateTo);

    try {
        const res = await fetch(`${APEX_BASE}/InvoiceServices/GetInvoices?${params}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store'
        });

        const data = await res.json();

        if (!res.ok) {
            return NextResponse.json({ error: 'APEX error', detail: data }, { status: res.status });
        }

        return NextResponse.json(data);
    } catch (err) {
        console.error('[APEX invoices]', err);
        return NextResponse.json(
            { error: 'Failed to reach APEX gate', message: String(err) },
            { status: 502 }
        );
    }
}
