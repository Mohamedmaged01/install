'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/RoleContext';
import { login } from '@/lib/endpoints';

export default function LoginPage() {
    const router = useRouter();
    const { loginUser } = useAuth();
    const [phoneOrEmail, setPhoneOrEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const authUser = await login({ phoneOrEmail, password });
            loginUser(authUser);
            router.push('/');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
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
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <img src="/logo.jpeg" alt="Logo" style={{ maxWidth: 180, maxHeight: 80, objectFit: 'contain', marginBottom: 12 }} />
                    <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                        Installation Order Management System
                    </p>
                </div>

                {/* Login Card */}
                <div className="card" style={{ padding: 32 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, textAlign: 'center' }}>
                        Welcome Back
                    </h2>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 28, textAlign: 'center' }}>
                        Sign in to your account
                    </p>

                    {error && (
                        <div style={{
                            padding: '12px 16px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: 'var(--radius-md)',
                            color: '#ef4444',
                            fontSize: 13,
                            marginBottom: 20,
                            textAlign: 'center',
                        }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin}>
                        <div className="form-group">
                            <label className="form-label">Phone or Email</label>
                            <input
                                className="form-input"
                                type="text"
                                placeholder="Enter your phone or email"
                                value={phoneOrEmail}
                                onChange={e => setPhoneOrEmail(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <input
                                className="form-input"
                                type="password"
                                placeholder="Enter your password"
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
                            {loading ? '⏳ Signing in...' : 'Sign In'}
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
