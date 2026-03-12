'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { verifyQr } from '@/lib/endpoints';

type Step = 'verifying' | 'success' | 'error';

export default function VerifyPage() {
    const { id } = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const token = searchParams.get('token') || '';

    const [step, setStep] = useState<Step>('verifying');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (!id || !token) {
            setErrorMsg('Missing order ID or token');
            setStep('error');
            return;
        }
        verifyQr({ orderId: Number(id), token })
            .then(() => setStep('success'))
            .catch(err => {
                setErrorMsg(err instanceof Error ? err.message : 'Verification failed');
                setStep('error');
            });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="animate-in" style={{ maxWidth: 500, margin: '0 auto' }}>
            <div className="page-header" style={{ textAlign: 'center' }}>
                <h1>📱 QR Verification</h1>
                <p>Verify installation completion via QR code</p>
            </div>

            {step === 'verifying' && (
                <div className="card" style={{ textAlign: 'center', padding: 64 }}>
                    <div style={{ fontSize: 48, animation: 'pulse 1.5s ease-in-out infinite', marginBottom: 16 }}>🔍</div>
                    <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Verifying...</h3>
                    <p style={{ color: 'var(--text-muted)' }}>Validating QR token with the server</p>
                </div>
            )}

            {step === 'success' && (
                <div className="card" style={{ textAlign: 'center' }}>
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 36 }}>
                        ✅
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: '#10b981' }}>Verification Successful!</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Installation has been verified and the order is now closed.</p>
                    <div style={{ textAlign: 'left', padding: '20px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, marginBottom: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Order ID</span>
                            <span style={{ fontWeight: 600 }}>#{id}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>QR Token</span>
                            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{token}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Verified At</span>
                            <span>{new Date().toLocaleString()}</span>
                        </div>
                    </div>
                    <Link href={`/orders/${id}`} className="btn btn-primary" style={{ width: '100%' }}>View Order</Link>
                </div>
            )}

            {step === 'error' && (
                <div className="card" style={{ textAlign: 'center' }}>
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 36 }}>
                        ❌
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: '#ef4444' }}>Verification Failed</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>{errorMsg || 'The QR code could not be verified.'}</p>
                    <Link href="/qr/verify" className="btn btn-primary" style={{ width: '100%' }}>Try Manual Verification</Link>
                </div>
            )}
        </div>
    );
}
