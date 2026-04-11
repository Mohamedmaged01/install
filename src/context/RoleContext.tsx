'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AuthUser } from '@/types';
import { getToken, removeToken, setToken } from '@/lib/api';

// ─── Permission helpers ───────────────────────────────────────────────
export const PERMS = {
    // Orders
    ORDERS_VIEW_ALL: 'ViewAllOrders',
    ORDERS_VIEW_BRANCH: 'ViewBranchOrders',
    ORDERS_VIEW_MINE: 'ViewMyOrders',
    ORDERS_CREATE: 'CreateOrder',
    ORDERS_EDIT: 'EditOrders',
    ORDERS_DELETE: 'DeleteOrders',

    // Approvals
    ORDERS_APPROVE_SALES: 'SalesApprove',
    ORDERS_APPROVE_SUPERVISOR: 'SupervisorApprove',
    ORDERS_RETURN: 'ReturnOrders',

    // Tasks & Technical
    ORDERS_VIEW_HISTORY: 'ViewOrdersHistory',
    TASKS_ASSIGN: 'InstallOrders',
    TASKS_VIEW_ALL: 'ViewAllTasks',
    TASKS_VIEW: 'ViewMyTasks',
    TASKS_MANAGE: 'UpdateTaskStatus',
    TASKS_EVIDENCE: 'UploadEvidence',

    // Admin (fallback or expected future)
    USERS_MANAGE: 'ManageUsers',
    ROLES_MANAGE: 'ManageRoles',
    SETTINGS_MANAGE: 'ManageSettings',
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
        const obj = JSON.parse(jsonPayload);

        // (.NET JWTs sometimes serialize multiple roles/permissions as duplicate keys which JSON.parse drops. Extract manually:)
        const permRegex = /"Permission[s]?"\s*:\s*"([^"]+)"/gi;
        const permMatches = [...jsonPayload.matchAll(permRegex)].map(m => m[1]);

        const roleRegex = /"(?:http:\/\/schemas\.microsoft\.com\/ws\/2008\/06\/identity\/claims\/role|role|Role)"\s*:\s*"([^"]+)"/gi;
        const roleMatches = [...jsonPayload.matchAll(roleRegex)].map(m => m[1]);

        if (permMatches.length > 0) {
            obj._extractedPermissions = permMatches;
        }
        if (roleMatches.length > 0) {
            obj._extractedRoles = roleMatches;
        }

        return obj;
    } catch {
        return null;
    }
}

function parsePermissions(raw: any): string[] {
    const list = [
        ...(raw?._extractedPermissions || []),
        ...(Array.isArray(raw?.Permission) ? raw.Permission : [raw?.Permission]),
        ...(Array.isArray(raw?.Permissions) ? raw.Permissions : [raw?.Permissions]),
        ...(Array.isArray(raw?.permission) ? raw.permission : [raw?.permission]),
        ...(Array.isArray(raw?.permissions) ? raw.permissions : [raw?.permissions])
    ].filter(Boolean);

    return Array.from(new Set(list));
}

function buildUserFromJwt(token: string): AuthUser {
    const p = decodeJwt(token) ?? {};

    const isSuperAdminRaw = p.IsSuperAdmin ?? p.isSuperAdmin ?? p.SuperAdmin ?? false;
    const roleString = p.Role ?? p.role ?? p.RoleName ?? p.roleName ?? p['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ?? '';
    const typeString = String(p.Type ?? p.type ?? '');

    const allRoles = [roleString, ...(p._extractedRoles || [])].map(r => String(r).toLowerCase());

    const isSuperAdmin =
        isSuperAdminRaw === true ||
        String(isSuperAdminRaw).toLowerCase() === 'true' ||
        allRoles.includes('سوبر أدمن') ||
        allRoles.includes('super admin') ||
        typeString === 'SuperAdmin';

    const isTechnician = allRoles.includes('فني') || allRoles.includes('technician') || typeString === 'Technician' || typeString === '6';

    const permissions = parsePermissions(p);

    // Baseline fallback permissions if they are a known role but missing explicit claims
    if (isTechnician) {
        if (!permissions.includes(PERMS.TASKS_VIEW)) permissions.push(PERMS.TASKS_VIEW);
        if (!permissions.includes(PERMS.TASKS_MANAGE)) permissions.push(PERMS.TASKS_MANAGE);
    }

    const isActiveRaw = p.IsActive ?? p.isActive ?? p.isactive;
    const isActive = isActiveRaw === undefined
        ? true // not in token → assume active
        : isActiveRaw === true || String(isActiveRaw).toLowerCase() === 'true';

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
        isActive,
        token,
        image: toImageUrl(p.ImagePath ?? p.imagePath ?? p.Image ?? p.image),
        type: typeString,
        permissions,
    };
}

function toImageUrl(path?: string | null): string | undefined {
    if (!path) return undefined;
    const normalized = path.replace(/\\/g, '/');
    if (normalized.startsWith('http')) return normalized;
    return `https://apiorders.runasp.net/${normalized.replace(/^\//, '')}`;
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
            String(raw.Type) === 'SuperAdmin'
        ),
        isActive: raw.isActive !== undefined ? !!raw.isActive : (raw.IsActive !== undefined ? !!raw.IsActive : true),
        token: raw.token ?? raw.Token ?? '',
        image: toImageUrl(raw.imagePath ?? raw.ImagePath ?? raw.image ?? raw.Image),
        type: String(raw.type || raw.Type || ''),
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
                // Always try to re-decode from token to get fresh permissions
                if (token.split('.').length === 3) {
                    const freshUser = buildUserFromJwt(token);
                    // Preserve any image the user updated — the JWT still has the old one until re-login
                    const storedRaw = localStorage.getItem('auth_user');
                    if (storedRaw) {
                        try {
                            const storedUser = JSON.parse(storedRaw);
                            if (storedUser.id === freshUser.id && storedUser.image) {
                                freshUser.image = toImageUrl(storedUser.image) ?? freshUser.image;
                            }
                        } catch { /* ignore parse errors */ }
                    }
                    // Block inactive users immediately
                    if (freshUser.isActive === false) {
                        removeToken();
                        localStorage.removeItem('auth_user');
                        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                            window.location.href = '/login?reason=inactive';
                        }
                        setIsLoading(false);
                        return;
                    }
                    setUser(freshUser);
                    // Update localStorage with fresh data
                    localStorage.setItem('auth_user', JSON.stringify(freshUser));
                } else {
                    // Fallback to localStorage if token is not a standard JWT
                    const stored = localStorage.getItem('auth_user');
                    if (stored) {
                        setUser(normaliseUser(JSON.parse(stored)));
                    }
                }
            } catch (err) {
                console.error('Auth restore failed:', err);
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

        if (authUser.isActive === false) {
            removeToken();
            throw new Error('Account is inactive. Please contact your administrator.');
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
