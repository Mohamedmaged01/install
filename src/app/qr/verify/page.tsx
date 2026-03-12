'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { verifyQr } from '@/lib/endpoints';

type VerifyStep = 'scan' | 'verifying' | 'success' | 'error';

export default function QRVerifyPage() {
    const searchParams = useSearchParams();
    const [step, setStep] = useState<VerifyStep>('scan');
    const [orderId, setOrderId] = useState('');
    const [token, setToken] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [resultData, setResultData] = useState<Record<string, unknown> | null>(null);
    const [scanning, setScanning] = useState(false);
    const [rawScan, setRawScan] = useState('');
    const scannerRef = useRef<any>(null);
    const scannerDivId = 'qr-reader';

    // Auto-verify if URL params are present (e.g. scanned from order page QR)
    useEffect(() => {
        const pOrderId = searchParams.get('orderId');
        const pToken = searchParams.get('token');
        if (pOrderId && pToken) {
            setOrderId(pOrderId);
            setToken(pToken);
            handleVerifyValues(pOrderId, pToken);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleVerifyValues = async (oid: string, tok: string) => {
        if (!oid || !tok) {
            setErrorMsg('Missing Order ID or token');
            setStep('error');
            return;
        }
        setStep('verifying');
        setErrorMsg('');
        try {
            const result = await verifyQr({ orderId: Number(oid), token: tok });
            setResultData(result as Record<string, unknown>);
            setStep('success');
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : 'Verification failed');
            setStep('error');
        }
    };

    const handleVerify = () => handleVerifyValues(orderId, token);

    const startScanner = async () => {
        setScanning(true);
        try {
            const { Html5Qrcode } = await import('html5-qrcode');
            const scanner = new Html5Qrcode(scannerDivId);
            scannerRef.current = scanner;
            await scanner.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText: string) => {
                    stopScanner();
                    setRawScan(decodedText);
                    let scannedOrderId = '';
                    let scannedToken = '';
                    try {
                        // Try as absolute URL
                        const url = new URL(decodedText);
                        scannedOrderId = url.searchParams.get('orderId') || '';
                        scannedToken = url.searchParams.get('token') || '';
                    } catch {
                        // Try extracting query params from relative URL or bare query string
                        try {
                            const qIndex = decodedText.indexOf('?');
                            const qs = qIndex !== -1 ? decodedText.slice(qIndex + 1) : decodedText;
                            const params = new URLSearchParams(qs);
                            scannedOrderId = params.get('orderId') || '';
                            scannedToken = params.get('token') || '';
                        } catch {
                            scannedToken = decodedText;
                        }
                    }
                    setOrderId(scannedOrderId);
                    setToken(scannedToken);
                    if (scannedOrderId && scannedToken) {
                        handleVerifyValues(scannedOrderId, scannedToken);
                    } else {
                        setErrorMsg('Could not extract Order ID and token from QR code');
                        setStep('error');
                    }
                },
                () => { /* ignore scan errors */ }
            );
        } catch {
            setScanning(false);
            setErrorMsg('Camera access denied or not available');
        }
    };

    const stopScanner = () => {
        if (scannerRef.current) {
            scannerRef.current.stop().catch(() => {});
            scannerRef.current = null;
        }
        setScanning(false);
    };

    // Cleanup on unmount
    useEffect(() => () => stopScanner(), []);

    return (
        <div className="animate-in" style={{ maxWidth: 500, margin: '0 auto' }}>
            <div className="page-header" style={{ textAlign: 'center' }}>
                <h1>📱 QR Verification</h1>
                <p>Verify installation completion via QR code</p>
            </div>

            {step === 'scan' && (
                <div className="card" style={{ textAlign: 'center' }}>
                    {/* Camera scanner area */}
                    <div id={scannerDivId} style={{ width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 12 }} />

                    {!scanning ? (
                        <button
                            className="btn btn-primary"
                            style={{ width: '100%', marginBottom: 16 }}
                            onClick={startScanner}
                        >
                            📷 Scan QR Code with Camera
                        </button>
                    ) : (
                        <button
                            className="btn btn-secondary"
                            style={{ width: '100%', marginBottom: 16 }}
                            onClick={stopScanner}
                        >
                            ✕ Stop Camera
                        </button>
                    )}

                    <div style={{ margin: '16px 0', display: 'flex', alignItems: 'center', gap: 16 }}>
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
                            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{token}</span>
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
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>{errorMsg || 'The QR code could not be verified.'}</p>
                    {rawScan && (
                        <div style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all', color: 'var(--text-muted)', marginBottom: 16, textAlign: 'left' }}>
                            <div style={{ marginBottom: 4, fontWeight: 600 }}>Raw scan:</div>
                            {rawScan}
                        </div>
                    )}
                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { setStep('scan'); setErrorMsg(''); setRawScan(''); }}>
                        Try Again
                    </button>
                </div>
            )}
        </div>
    );
}
