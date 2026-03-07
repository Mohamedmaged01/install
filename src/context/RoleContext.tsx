'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AuthUser } from '@/types';
import { getToken, removeToken, setToken } from '@/lib/api';

// ─── Permission helpers ───────────────────────────────────────────────
/** All known permission strings from the backend */
export const PERMS = {
    // Orders
    ORDERS_VIEW_BRANCH: 'Permissions.Orders.ViewBranch',
    ORDERS_VIEW_ALL: 'Permissions.Orders.ViewAll',
    ORDERS_CREATE: 'Permissions.Orders.Create',
    ORDERS_APPROVE_SALES: 'Permissions.Orders.ApproveSales',
    ORDERS_APPROVE_SUPERVISOR: 'Permissions.Orders.ApproveSupervisor',
    ORDERS_RETURN: 'Permissions.Orders.Return',
    // Tasks
    TASKS_VIEW: 'Permissions.Tasks.View',
    TASKS_MANAGE: 'Permissions.Tasks.Manage',
    TASKS_ASSIGN: 'Permissions.Tasks.Assign',
    // Admin
    USERS_MANAGE: 'Permissions.Users.Manage',
    ROLES_MANAGE: 'Permissions.Roles.Manage',
    SETTINGS_MANAGE: 'Permissions.Settings.Manage',
} as const;

// ─── Context type ─────────────────────────────────────────────────────
interface AuthContextType {
    user: AuthUser | null;
    setUser: (user: AuthUser | null) => void;
    loginUser: (authUser: any) => void;
    logoutUser: () => void;
    isAuthenticated: boolean;
    isLoading: boolean;
    /** Returns true if the current user has the specified permission (super admins always return true) */
    hasPermission: (perm: string) => boolean;
    /** Returns true if the current user has ANY of the given permissions */
    hasAnyPermission: (...perms: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    setUser: () => { },
    loginUser: () => { },
    logoutUser: () => { },
    isAuthenticated: false,
    isLoading: true,
    hasPermission: () => false,
    hasAnyPermission: () => false,
});

// ─── JWT decoder ──────────────────────────────────────────────────────
function decodeJwt(token: string): Record<string, any> | null {
    try {
        const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(b64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    } catch {
        return null;
    }
}

function parsePermissions(raw: any): string[] {
    const p = raw?.Permission ?? raw?.Permissions ?? raw?.permission ?? raw?.permissions ?? [];
    if (Array.isArray(p)) return p;
    if (typeof p === 'string') return [p];
    return [];
}

function buildUserFromJwt(token: string): AuthUser {
    const p = decodeJwt(token) ?? {};

    const isSuperAdminRaw = p.IsSuperAdmin ?? p.isSuperAdmin ?? p.SuperAdmin ?? false;
    const roleString = p.Role ?? p.role ?? p.RoleName ?? p.roleName ?? p['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ?? '';
    const typeString = String(p.Type ?? p.type ?? '');

    const isSuperAdmin =
        isSuperAdminRaw === true ||
        String(isSuperAdminRaw).toLowerCase() === 'true' ||
        roleString === 'سوبر أدمن' ||
        roleString?.toLowerCase() === 'super admin' ||
        typeString === 'SuperAdmin' ||
        typeString === '0'; // 0 is sometimes the enum value for SuperAdmin

    return {
        id: Number(p.Id ?? p.id ?? p.sub ?? 0),
        name: p.Name ?? p.name ?? p['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ?? 'User',
        email: p.Email ?? p.email ?? p['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] ?? '',
        phone: p.Phone ?? p.phone ?? '',
        roleId: Number(p.RoleId ?? p.roleId ?? 0),
        roleName: roleString,
        departmentId: p.DepartmentId ? Number(p.DepartmentId) : undefined,
        departmentName: p.DepartmentName ?? p.departmentName,
        branchId: p.BranchId ? Number(p.BranchId) : undefined,
        branchName: p.BranchName ?? p.branchName,
        isSuperAdmin,
        token,
        image: p.ImagePath ?? p.Image ?? p.image,
        permissions: parsePermissions(p),
    };
}

function normaliseUser(raw: any): AuthUser {
    if (!raw || typeof raw !== 'object') return raw;
    return {
        id: raw.id ?? raw.Id ?? 0,
        name: raw.name ?? raw.Name ?? 'User',
        email: raw.email ?? raw.Email ?? '',
        phone: raw.phone ?? raw.Phone ?? '',
        roleId: raw.roleId ?? raw.RoleId ?? 0,
        roleName: raw.roleName ?? raw.RoleName ?? '',
        departmentId: raw.departmentId ?? raw.DepartmentId,
        departmentName: raw.departmentName ?? raw.DepartmentName,
        branchId: raw.branchId ?? raw.BranchId,
        branchName: raw.branchName ?? raw.BranchName,
        isSuperAdmin: !!(
            raw.isSuperAdmin ||
            raw.IsSuperAdmin ||
            raw.roleName === 'سوبر أدمن' ||
            raw.RoleName === 'سوبر أدمن' ||
            String(raw.type) === 'SuperAdmin' ||
            String(raw.Type) === 'SuperAdmin' ||
            String(raw.type) === '0' ||
            String(raw.Type) === '0'
        ),
        token: raw.token ?? raw.Token ?? '',
        image: raw.image ?? raw.Image ?? raw.ImagePath,
        permissions: parsePermissions(raw),
    };
}

// ─── Provider ─────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const token = getToken();
        if (token && token !== 'undefined' && token !== 'null') {
            try {
                const stored = localStorage.getItem('auth_user');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    // If stored data has no permissions, re-decode from token
                    if (!parsed.permissions?.length && token.split('.').length === 3) {
                        setUser(buildUserFromJwt(token));
                    } else {
                        setUser(normaliseUser(parsed));
                    }
                }
            } catch {
                removeToken();
                localStorage.removeItem('auth_user');
            }
        }
        setIsLoading(false);
    }, []);

    const loginUser = (raw: any) => {
        let authUser: AuthUser;

        if (typeof raw === 'string' && raw.split('.').length === 3) {
            // Backend returned the JWT token string directly
            setToken(raw);
            authUser = buildUserFromJwt(raw);
        } else {
            authUser = normaliseUser(raw);
            if (authUser.token) setToken(authUser.token);
        }

        localStorage.setItem('auth_user', JSON.stringify(authUser));
        setUser(authUser);
    };

    const logoutUser = () => {
        removeToken();
        localStorage.removeItem('auth_user');
        setUser(null);
        if (typeof window !== 'undefined') {
            window.location.href = '/login';
        }
    };

    const hasPermission = useCallback((perm: string): boolean => {
        if (!user) return false;
        if (user.isSuperAdmin) return true;
        return user.permissions.includes(perm);
    }, [user]);

    const hasAnyPermission = useCallback((...perms: string[]): boolean => {
        if (!user) return false;
        if (user.isSuperAdmin) return true;
        return perms.some(p => user.permissions.includes(p));
    }, [user]);

    return (
        <AuthContext.Provider
            value={{
                user,
                setUser,
                loginUser,
                logoutUser,
                isAuthenticated: !!user && !!getToken(),
                isLoading,
                hasPermission,
                hasAnyPermission,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
