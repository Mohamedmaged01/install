'use client';

import { useAuth } from '@/context/RoleContext';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { useLang } from '@/context/LanguageContext';

interface PermissionGuardProps {
    children: React.ReactNode;
    requiredPerms: string[];
    requireAll?: boolean; // If true, user must have ALL requiredPerms. If false, ANY.
}

export default function PermissionGuard({ children, requiredPerms, requireAll = false }: PermissionGuardProps) {
    const { isAuthenticated, isLoading, hasPermission, hasAnyPermission } = useAuth();
    const router = useRouter();
    const { t } = useLang();

    // Compute authorization synchronously — avoids putting requiredPerms (new array each render)
    // into a useEffect dependency, which would cause an infinite redirect loop.
    const isAuthorized = useMemo<boolean | null>(() => {
        if (isLoading) return null;
        if (!isAuthenticated) return null;
        if (requireAll) return requiredPerms.every(p => hasPermission(p));
        return hasAnyPermission(...requiredPerms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading, isAuthenticated, hasPermission, hasAnyPermission, requireAll, JSON.stringify(requiredPerms)]);

    useEffect(() => {
        if (isLoading) return;
        if (!isAuthenticated) { router.push('/login'); return; }
        if (isAuthorized === false) router.replace('/');
    }, [isLoading, isAuthenticated, isAuthorized, router]);

    if (isLoading || isAuthorized === null) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <p style={{ color: 'var(--text-muted)' }}>{t('Checking access...', 'التحقق من الصلاحيات...')}</p>
            </div>
        );
    }

    if (isAuthorized === false) {
        return null; // Will be redirected by useEffect
    }

    return <>{children}</>;
}
