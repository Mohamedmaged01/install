'use client';

import { AuthProvider, useAuth } from '@/context/RoleContext';
import { LanguageProvider, useLang } from '@/context/LanguageContext';
import Sidebar from '@/components/Sidebar';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

function ProtectedLayout({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();
    const { lang, toggleLang } = useLang();
    const pathname = usePathname();
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        if (!isLoading && !isAuthenticated && pathname !== '/login') {
            router.push('/login');
        }
    }, [isAuthenticated, isLoading, pathname, router]);

    // Login page — no layout
    if (pathname === '/login') {
        return <>{children}</>;
    }

    // Loading state
    if (isLoading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-primary)',
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 40, marginBottom: 16, animation: 'pulse 1.5s ease-in-out infinite' }}>⚡</div>
                    <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
                </div>
            </div>
        );
    }

    // Not authenticated — redirect handled by useEffect
    if (!isAuthenticated) {
        return null;
    }

    return (
        <div className="layout">
            <div className="mobile-header">
                <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>☰</button>
                <span className="mobile-title">⚡ InstallFlow</span>
                {/* Language toggle */}
                <button
                    onClick={toggleLang}
                    title="Toggle Language / تغيير اللغة"
                    style={{
                        marginInlineStart: 'auto',
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        padding: '4px 10px',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                    }}
                >
                    {lang === 'en' ? '🌐 AR' : '🌐 EN'}
                </button>
            </div>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <main className="main-content">
                {children}
            </main>
        </div>
    );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <LanguageProvider>
                <ProtectedLayout>{children}</ProtectedLayout>
            </LanguageProvider>
        </AuthProvider>
    );
}
