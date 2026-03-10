'use client';

import { useAuth } from '@/context/RoleContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useLang } from '@/context/LanguageContext';

interface PermissionGuardProps {
    children: React.ReactNode;
    requiredPerms: string[];
    requireAll?: boolean; // If true, user must have ALL requiredPerms. If false, ANY.
}

export default function PermissionGuard({ children, requiredPerms, requireAll = false }: PermissionGuardProps) {
    const { isAuthenticated, isLoading, hasPermission, hasAnyPermission, user } = useAuth();
    const router = useRouter();
    const { t } = useLang();
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

    useEffect(() => {
        if (isLoading) return;

        if (!isAuthenticated) {
            router.push('/login');
            return;
        }

        let authCheck = false;

        if (requireAll) {
            // Must have every single permission
            authCheck = requiredPerms.every(p => hasPermission(p));
        } else {
            // Must have at least one of the permissions
            authCheck = hasAnyPermission(...requiredPerms);
        }

        // SuperAdmins bypass implicitly in RoleContext functions, 
        // but we double check logic is respected properly via the hooks.
        setIsAuthorized(authCheck);

        if (!authCheck) {
            router.replace('/'); // Redirect to dashboard if unauthorized
        }

    }, [isLoading, isAuthenticated, hasPermission, hasAnyPermission, requiredPerms, requireAll, router]);

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
