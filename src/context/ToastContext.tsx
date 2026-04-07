'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ToastType = 'success' | 'error';

interface Toast {
    id: number;
    type: ToastType;
    msg: string;
}

interface ToastContextValue {
    success: (msg: string) => void;
    error: (msg: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const add = useCallback((type: ToastType, msg: string) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, type, msg }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    const value: ToastContextValue = {
        success: (msg) => add('success', msg),
        error: (msg) => add('error', msg),
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div style={{
                position: 'fixed',
                top: 20,
                right: 20,
                zIndex: 99999,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                pointerEvents: 'none',
            }}>
                {toasts.map(t => (
                    <div key={t.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '12px 16px',
                        borderRadius: 10,
                        background: t.type === 'success' ? 'rgba(16,185,129,0.97)' : 'rgba(239,68,68,0.97)',
                        color: '#fff',
                        fontSize: 14,
                        fontWeight: 500,
                        minWidth: 260,
                        maxWidth: 400,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                        backdropFilter: 'blur(8px)',
                        pointerEvents: 'all',
                        animation: 'toast-in 0.2s ease',
                    }}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>
                            {t.type === 'success' ? '✅' : '❌'}
                        </span>
                        <span style={{ flex: 1, lineHeight: 1.4 }}>{t.msg}</span>
                        <button
                            onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: 18,
                                lineHeight: 1,
                                padding: 0,
                                opacity: 0.75,
                                flexShrink: 0,
                            }}
                        >×</button>
                    </div>
                ))}
            </div>
            <style>{`@keyframes toast-in { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }`}</style>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}
