'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/RoleContext';
import { useToast } from '@/context/ToastContext';
import { useLang } from '@/context/LanguageContext';
import { login } from '@/lib/endpoints';

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isInactiveRedirect = searchParams.get('reason') === 'inactive';
    const { loginUser } = useAuth();
    const toast = useToast();
    const { lang, toggleLang } = useLang();
    const [phoneOrEmail, setPhoneOrEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const authUser = await login({ phoneOrEmail, password });
            loginUser(authUser);
            router.push('/');
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-primary)',
            padding: 20,
        }}>
            <div style={{
                width: '100%',
                maxWidth: 420,
                animation: 'slideUp var(--transition-base)',
            }}>
                {/* Language toggle */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                    <div
                        style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            borderRadius: 28,
                            padding: 4,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        }}
                    >
                        <button
                            onClick={() => lang !== 'en' && toggleLang()}
                            style={{
                                padding: '7px 18px',
                                borderRadius: 24,
                                border: 'none',
                                background: lang === 'en' ? 'var(--primary)' : 'transparent',
                                color: lang === 'en' ? '#fff' : 'var(--text-muted)',
                                fontWeight: 600,
                                fontSize: 13,
                                cursor: lang === 'en' ? 'default' : 'pointer',
                                transition: 'all 0.25s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                boxShadow: lang === 'en' ? '0 2px 6px rgba(var(--primary-rgb, 59,130,246), 0.35)' : 'none',
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                            </svg>
                            English
                        </button>
                        <button
                            onClick={() => lang !== 'ar' && toggleLang()}
                            style={{
                                padding: '7px 18px',
                                borderRadius: 24,
                                border: 'none',
                                background: lang === 'ar' ? 'var(--primary)' : 'transparent',
                                color: lang === 'ar' ? '#fff' : 'var(--text-muted)',
                                fontWeight: 600,
                                fontSize: 13,
                                cursor: lang === 'ar' ? 'default' : 'pointer',
                                transition: 'all 0.25s ease',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                boxShadow: lang === 'ar' ? '0 2px 6px rgba(var(--primary-rgb, 59,130,246), 0.35)' : 'none',
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                            </svg>
                            العربية
                        </button>
                    </div>
                </div>

                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <img src="/logo.jpeg" alt="Logo" style={{ maxWidth: 180, maxHeight: 80, objectFit: 'contain', marginBottom: 12 }} />
                    <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                        {lang === 'ar' ? 'نظام إدارة أوامر التركيب' : 'Installation Order Management System'}
                    </p>
                </div>

                {/* Inactive account notice */}
                {isInactiveRedirect && (
                    <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 'var(--radius-md)', padding: '10px 16px', marginBottom: 16, color: '#dc2626', fontSize: 14, fontWeight: 600, textAlign: 'center' }}>
                        {lang === 'ar' ? 'حسابك غير نشط. تواصل مع المسؤول.' : 'Your account is inactive. Contact your administrator.'}
                    </div>
                )}

                {/* Login Card */}
                <div className="card" style={{ padding: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, textAlign: 'center' }}>
                        {lang === 'ar' ? 'أهلاً بعودتك' : 'Welcome Back'}
                    </h2>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 28, textAlign: 'center' }}>
                        {lang === 'ar' ? 'تسجيل الدخول إلى حسابك' : 'Sign in to your account'}
                    </p>

                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label className="form-label">{lang === 'ar' ? 'الهاتف أو البريد' : 'Phone or Email'}</label>
                            <input
                                className="form-input"
                                type="text"
                                placeholder={lang === 'ar' ? 'أدخل هاتفك أو بريدك' : 'Enter your phone or email'}
                                value={phoneOrEmail}
                                onChange={e => setPhoneOrEmail(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">{lang === 'ar' ? 'كلمة المرور' : 'Password'}</label>
                            <input
                                className="form-input"
                                type="password"
                                placeholder={lang === 'ar' ? 'أدخل كلمة المرور' : 'Enter your password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading}
                            style={{
                                width: '100%',
                                marginTop: 8,
                                padding: '12px',
                                fontSize: 15,
                                fontWeight: 600,
                                opacity: loading ? 0.7 : 1,
                            }}
                        >
                            {loading ? `⏳ ${lang === 'ar' ? 'جارٍ تسجيل الدخول...' : 'Signing in...'}` : (lang === 'ar' ? 'تسجيل الدخول' : 'Sign In')}
                        </button>
                    </form>
                </div>

                <p style={{
                    textAlign: 'center',
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    marginTop: 24,
                }}>
                    © 2026 InstallFlow. All rights reserved.
                </p>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense>
            <LoginForm />
        </Suspense>
    );
}
