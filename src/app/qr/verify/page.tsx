'use client';

import { useState } from 'react';
import Link from 'next/link';
import { verifyQr } from '@/lib/endpoints';

type VerifyStep = 'scan' | 'verifying' | 'success' | 'error';

export default function QRVerifyPage() {
    const [step, setStep] = useState<VerifyStep>('scan');
    const [orderId, setOrderId] = useState('');
    const [token, setToken] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [resultData, setResultData] = useState<Record<string, unknown> | null>(null);

    const handleVerify = async () => {
        if (!orderId || !token) {
            setErrorMsg('Please enter both Order ID and QR Token');
            return;
        }

        setStep('verifying');
        setErrorMsg('');

        try {
            const result = await verifyQr({ orderId: Number(orderId), token });
            setResultData(result as Record<string, unknown>);
            setStep('success');
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Verification failed');
            setStep('error');
        }
    };

    const handleScanSimulate = () => {
        // Simulate camera scan — in production this would use a QR scanner library
        setStep('verifying');
        setTimeout(() => {
            if (orderId && token) {
                handleVerify();
            } else {
                setErrorMsg('Please enter Order ID and Token to verify');
                setStep('error');
            }
        }, 1500);
    };

    return (
        <div className="animate-in" style={{ maxWidth: 500, margin: '0 auto' }}>
            <div className="page-header" style={{ textAlign: 'center' }}>
                <h1>📱 QR Verification</h1>
                <p>Verify installation completion via QR code</p>
            </div>

            {step === 'scan' && (
                <div className="card" style={{ textAlign: 'center' }}>
                    {/* Scanner Area */}
                    <div className="qr-container">
                        <div className="qr-scanner-area" onClick={handleScanSimulate} style={{ cursor: 'pointer' }}>
                            <span style={{ fontSize: 48, zIndex: 1 }}>📷</span>
                            <span style={{ fontSize: 14, color: 'var(--text-muted)', zIndex: 1 }}>Tap to scan QR code</span>
                        </div>
                    </div>

                    <div style={{ margin: '24px 0', display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>or enter manually</span>
                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    </div>

                    {errorMsg && (
                        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
                            {errorMsg}
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Order ID</label>
                        <input
                            className="form-input"
                            placeholder="e.g. 5"
                            value={orderId}
                            onChange={e => setOrderId(e.target.value)}
                            type="number"
                            style={{ textAlign: 'center', fontSize: 16 }}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">QR Token</label>
                        <input
                            className="form-input"
                            placeholder="Enter QR token"
                            value={token}
                            onChange={e => setToken(e.target.value)}
                            style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 16 }}
                        />
                    </div>
                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleVerify} disabled={!orderId || !token}>
                        Verify Token
                    </button>
                </div>
            )}

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
                            <span style={{ fontWeight: 600 }}>{orderId}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>QR Token</span>
                            <span style={{ fontFamily: 'monospace' }}>{token}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Verified At</span>
                            <span>{new Date().toLocaleString()}</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                        <Link href={`/orders/${orderId}`} className="btn btn-secondary" style={{ flex: 1 }}>View Order</Link>
                        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setStep('scan'); setOrderId(''); setToken(''); setResultData(null); }}>
                            Scan Another
                        </button>
                    </div>
                </div>
            )}

            {step === 'error' && (
                <div className="card" style={{ textAlign: 'center' }}>
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 36 }}>
                        ❌
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: '#ef4444' }}>Verification Failed</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>{errorMsg || 'The QR code could not be verified.'}</p>
                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { setStep('scan'); setErrorMsg(''); }}>
                        Try Again
                    </button>
                </div>
            )}
        </div>
    );
}
