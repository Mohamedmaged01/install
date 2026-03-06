'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, PERMS } from '@/context/RoleContext';
import { useLang } from '@/context/LanguageContext';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();
    const { user, logoutUser, hasAnyPermission, hasPermission } = useAuth();
    const { lang, toggleLang, t } = useLang();

    // Super-admin shorthand
    const isSuper = user?.isSuperAdmin ?? false;

    const navItems = [
        {
            href: '/',
            label: t('Dashboard', 'لوحة التحكم'),
            icon: '🏠',
            show: true,
        },
        {
            href: '/sales/orders',
            label: t('My Orders', 'طلباتي'),
            icon: '📋',
            show: hasAnyPermission(PERMS.ORDERS_VIEW_BRANCH, PERMS.ORDERS_VIEW_ALL, PERMS.ORDERS_CREATE),
        },
        {
            href: '/sales/orders/new',
            label: t('New Order', 'طلب جديد'),
            icon: '➕',
            show: hasPermission(PERMS.ORDERS_CREATE),
        },
        {
            href: '/manager',
            label: t('Pending Approvals', 'موافقات معلقة'),
            icon: '✅',
            show: hasPermission(PERMS.ORDERS_APPROVE_SALES),
        },
        {
            href: '/supervisor',
            label: t('Supervisor Dashboard', 'لوحة المشرف'),
            icon: '👷',
            show: hasPermission(PERMS.ORDERS_APPROVE_SUPERVISOR),
        },
        {
            href: '/technician',
            label: t('My Tasks', 'مهامي'),
            icon: '🔧',
            show: hasAnyPermission(PERMS.TASKS_VIEW, PERMS.TASKS_MANAGE),
        },
        {
            href: '/admin/users',
            label: t('Users & Permissions', 'المستخدمون والصلاحيات'),
            icon: '🔑',
            show: isSuper || hasPermission(PERMS.USERS_MANAGE),
        },
        {
            href: '/admin',
            label: t('Settings', 'الإعدادات'),
            icon: '⚙️',
            show: isSuper || hasAnyPermission(PERMS.ROLES_MANAGE, PERMS.SETTINGS_MANAGE),
        },
    ];

    const quickItems = [
        {
            href: '/qr/verify',
            label: t('QR Verification', 'التحقق من QR'),
            icon: '📱',
            show: true,
        },
    ];

    const filteredNav = navItems.filter(i => i.show);
    const filteredQuick = quickItems.filter(i => i.show);

    return (
        <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
            {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

            <div className="sidebar-brand">
                <Link href="/" style={{ textDecoration: 'none' }}>
                    <h1>⚡ InstallFlow</h1>
                    <p>{t('Installation Order Management', 'إدارة أوامر التركيب')}</p>
                </Link>
            </div>

            <nav className="sidebar-nav">
                <div className="sidebar-section-title">{t('NAVIGATION', 'التنقل')}</div>
                {filteredNav.map(item => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
                        onClick={onClose}
                    >
                        <span className="icon">{item.icon}</span>
                        <span>{item.label}</span>
                    </Link>
                ))}

                {filteredQuick.length > 0 && (
                    <>
                        <div className="sidebar-section-title" style={{ marginTop: 24 }}>{t('QUICK ACCESS', 'وصول سريع')}</div>
                        {filteredQuick.map(item => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
                                onClick={onClose}
                            >
                                <span className="icon">{item.icon}</span>
                                <span>{item.label}</span>
                            </Link>
                        ))}
                    </>
                )}
            </nav>

            {/* User info */}
            <div className="sidebar-user">
                <div className="sidebar-user-avatar">
                    {user?.image ? (
                        <img src={user.image} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                        <span>{user?.name?.charAt(0) || 'U'}</span>
                    )}
                </div>
                <div className="sidebar-user-info">
                    <div className="name">{user?.name || 'User'}</div>
                    <div className="role">
                        {user?.isSuperAdmin
                            ? (lang === 'ar' ? '⭐ سوبر أدمن' : '⭐ Super Admin')
                            : (user?.roleName || (lang === 'ar' ? 'بدون دور' : 'No Role'))}
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                    <button
                        onClick={toggleLang}
                        title="Toggle Language"
                        style={{
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--text-muted)',
                            padding: '2px 6px',
                            fontSize: 11,
                            cursor: 'pointer',
                            fontWeight: 700,
                        }}
                    >
                        {lang === 'en' ? 'AR' : 'EN'}
                    </button>
                    <button
                        onClick={logoutUser}
                        title={t('Logout', 'تسجيل خروج')}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 16,
                            padding: 4,
                            color: 'var(--text-muted)',
                        }}
                    >
                        🚪
                    </button>
                </div>
            </div>
        </aside>
    );
}
