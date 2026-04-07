'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
    getRoles, createRole, deleteRole,
    getPermissions, getRolePermissions, updateRolePermissions,
    getDepartmentUsers, createDepartmentUser, deleteDepartmentUser,
    getDepartments, updateDepartmentUser, updateRole,
} from '@/lib/endpoints';
import { Role, Permission, DepartmentUser, Department } from '@/types';
import PermissionGuard from '@/components/PermissionGuard';
import { PERMS } from '@/context/RoleContext';
import { useLang } from '@/context/LanguageContext';
import { useToast } from '@/context/ToastContext';
import Pagination from '@/components/Pagination';

/* ─── types ─── */
interface NewUserForm {
    Name: string;
    Email: string;
    Phone: string;
    Password: string;
    DepartmentId: number;
    RoleId: number;
    IsSuperAdmin: boolean;
}

type ModalType = 'addRole' | 'addUser' | 'permissions' | 'viewUsers' | 'editUser' | null;

/* ════════════════════════════════════════════════════════
   PAGE
════════════════════════════════════════════════════════ */
export default function AdminUsersPage() {
    const { t } = useLang();
    const toast = useToast();

    /* data */
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);

    /* modal state */
    const [modal, setModal] = useState<ModalType>(null);
    const [activeRole, setActiveRole] = useState<Role | null>(null);
    const [rolePerms, setRolePerms] = useState<number[]>([]);
    const [editRoleName, setEditRoleName] = useState('');
    const [roleUsers, setRoleUsers] = useState<DepartmentUser[]>([]);

    /* forms */
    const [newRoleName, setNewRoleName] = useState('');
    const [userForm, setUserForm] = useState<NewUserForm>({ Name: '', Email: '', Phone: '', Password: '', DepartmentId: 0, RoleId: 0, IsSuperAdmin: false });
    const [editUserTarget, setEditUserTarget] = useState<DepartmentUser | null>(null);
    const [editUserForm, setEditUserForm] = useState<{ Name: string; Email: string; Phone: string; Password: string; DepartmentId: number; RoleId: number }>({ Name: '', Email: '', Phone: '', Password: '', DepartmentId: 0, RoleId: 0 });
    const [searchQ, setSearchQ] = useState('');
    const [userSearch, setUserSearch] = useState('');

    /* ui */
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [permSearch, setPermSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    /* ── load all data ── */
    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            const [r, p, d] = await Promise.all([
                getRoles().catch(() => []),
                getPermissions().catch(() => []),
                getDepartments().catch(() => []),
            ]);
            setRoles(Array.isArray(r) ? r : []);
            setPermissions(Array.isArray(p) ? p : []);
            setDepartments(Array.isArray(d) ? d : []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    /* ── role actions ── */
    const handleCreateRole = async () => {
        if (!newRoleName.trim()) return;
        setActionLoading(true);
        try {
            await createRole(newRoleName.trim());
            setNewRoleName('');
            setModal(null);
            await loadAll();
        } catch (err) { toast.error(err instanceof Error ? err.message : t('Failed to create role', 'فشل إنشاء الدور')); }
        finally { setActionLoading(false); }
    };

    const handleDeleteRole = async (id: number, name: string) => {
        if (!confirm(`Delete role "${name}"? Users assigned to it will lose access.`)) return;
        try {
            await deleteRole(id);
            await loadAll();
            toast.success(t('Role deleted.', 'تم حذف الدور.'));
        } catch (err) { toast.error(err instanceof Error ? err.message : t('Failed to delete role', 'فشل حذف الدور')); }
    };

    /* ── permission actions ── */
    const openPerms = async (role: Role) => {
        setActiveRole(role);
        setEditRoleName(role.name);
        setPermSearch('');
        setModal('permissions');
        try {
            const p = await getRolePermissions(role.id);
            setRolePerms(Array.isArray(p) ? p.map((x: Permission) => x.id) : []);
        } catch { setRolePerms([]); }
    };

const handleSavePerms = async () => {
    if (!activeRole) return;
    setActionLoading(true);
    try {
        const nameChanged = editRoleName.trim() && editRoleName.trim() !== activeRole.name;

        await Promise.all([
            nameChanged ? updateRole(activeRole.id, editRoleName.trim()) : Promise.resolve(),
            updateRolePermissions(activeRole.id, rolePerms),
        ]);

        await loadAll();
        setModal(null);
        toast.success(t('Permissions saved!', 'تم حفظ الصلاحيات!'));
    } catch (err) { toast.error(err instanceof Error ? err.message : t('Failed to save permissions', 'فشل حفظ الصلاحيات')); }
    finally { setActionLoading(false); }
};
    /* ── view users in role ── */
    const openRoleUsers = async (role: Role) => {
        setActiveRole(role);
        setModal('viewUsers');
        setRoleUsers([]);
        setUserSearch('');
        try {
            const all = await getDepartmentUsers();
            setRoleUsers((Array.isArray(all) ? all : []).filter(u => 
                u.roleId === role.id || 
                u.roleName === role.name || 
                u.role === role.name || 
                (Array.isArray((u as any).roles) && (u as any).roles.includes(role.name))
            ));
        } catch { setRoleUsers([]); }
    };

    /* ── create user ── */
    const handleCreateUser = async () => {
        if (!userForm.Name || !userForm.Email || !userForm.Password) {
            toast.error(t('Name, email, and password are required.', 'الاسم والبريد وكلمة المرور مطلوبة.')); return;
        }
        setActionLoading(true);
        try {
            const fd = new FormData();
            Object.entries(userForm).forEach(([k, v]) => fd.append(k, String(v)));
            await createDepartmentUser(fd);
            setModal(null);
            setUserForm({ Name: '', Email: '', Phone: '', Password: '', DepartmentId: 0, RoleId: 0, IsSuperAdmin: false });
            await loadAll();
            toast.success(t('User created successfully!', 'تم إنشاء المستخدم بنجاح!'));
        } catch (err) { toast.error(err instanceof Error ? err.message : t('Failed to create user', 'فشل إنشاء المستخدم')); }
        finally { setActionLoading(false); }
    };

    const handleDeleteUser = async (id: number, name: string) => {
        if (!confirm(`Are you sure you want to delete user "${name}"?`)) return;
        try {
            await deleteDepartmentUser(id);
            setRoleUsers(prev => prev.filter(u => u.id !== id));
            await loadAll();
            toast.success(t('User deleted.', 'تم حذف المستخدم.'));
        } catch (err) { toast.error(err instanceof Error ? err.message : t('Failed to delete user', 'فشل حذف المستخدم')); }
    };

    const openEditUser = (u: DepartmentUser) => {
        setEditUserTarget(u);
        setEditUserForm({ Name: u.name, Email: u.email, Phone: u.phone || '', Password: '', DepartmentId: u.departmentId, RoleId: u.roleId });
        setModal('editUser');
    };

    const handleSaveEditUser = async () => {
        if (!editUserTarget) return;
        setActionLoading(true);
        try {
            await updateDepartmentUser(editUserTarget.id, editUserForm);
            await loadAll();
            setModal('viewUsers');
            toast.success(t('User updated successfully!', 'تم تحديث المستخدم بنجاح!'));
        } catch (err) { toast.error(err instanceof Error ? err.message : t('Failed to update user', 'فشل تحديث المستخدم')); }
        finally { setActionLoading(false); }
    };

    /* ── filter ── */
    const filteredRoles = roles.filter(r => r.name.toLowerCase().includes(searchQ.toLowerCase()));
    const filteredPerms = permissions.filter(p => p.name.toLowerCase().includes(permSearch.toLowerCase()));

    /* ════════════════════════════════════════════
       RENDER
    ════════════════════════════════════════════ */
    return (
        <PermissionGuard requiredPerms={[PERMS.USERS_MANAGE]}>
            <div className="animate-in">
                {/* ── Page Header ── */}
                <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <Link href="/admin" style={{ fontSize: 13, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 8, textDecoration: 'none' }}>
                            ← {t('Back to Admin', 'العودة للإدارة')}
                        </Link>
                        <h1>🔑 {t('Roles & Users', 'الأدوار والمستخدمون')}</h1>
                        <p>{t('Manage roles, assign permissions, and create users', 'إدارة الأدوار وتعيين الصلاحيات وإنشاء المستخدمين')}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-secondary" onClick={() => setModal('addRole')}>
                            + {t('Add Role', 'إضافة دور')}
                        </button>
                        <button className="btn btn-primary" onClick={() => setModal('addUser')}>
                            + {t('Add User', 'إضافة مستخدم')}
                        </button>
                    </div>
                </div>

                {/* ── Stats row ── */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 12, marginBottom: 24 }}>
                    <StatPill icon="🔑" label={t('Total Roles', 'إجمالي الأدوار')} value={roles.length} color="#6366f1" />
                    <StatPill icon="🛡️" label={t('Permissions', 'الصلاحيات')} value={permissions.length} color="#8b5cf6" />
                    <StatPill icon="👥" label={t('Total Users', 'إجمالي المستخدمين')} value={roles.reduce((acc, r) => acc + (r.usersCount || 0), 0)} color="#10b981" />
                </div>

                {/* ── Search ── */}
                <div className="table-toolbar" style={{ marginBottom: 12 }}>
                    <div className="table-search">
                        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>🔍</span>
                        <input
                            placeholder={t('Search roles...', 'ابحث عن الأدوار...')}
                            value={searchQ}
                            onChange={e => setSearchQ(e.target.value)}
                        />
                    </div>
                </div>

                {/* ── Roles Table ── */}
                <div className="table-container">
                    <table style={{ width: '100%', tableLayout: 'fixed' }}>
                        <colgroup>
                            <col style={{ width: 48 }} />
                            <col />
                            <col style={{ width: 160 }} />
                            <col style={{ width: 160 }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>{t('Role Name', 'اسم الدور')}</th>
                                <th>{t('Users', 'المستخدمون')}</th>
                                <th>{t('Actions', 'الإجراءات')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>{t('Loading...', 'جارٍ التحميل...')}</td>
                                </tr>
                            ) : filteredRoles.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', padding: 48 }}>
                                        <div style={{ fontSize: 32, marginBottom: 8 }}>🎭</div>
                                        <div style={{ fontWeight: 600 }}>{t('No roles found', 'لا توجد أدوار')}</div>
                                    </td>
                                </tr>
                            ) : (
                                filteredRoles.slice((page - 1) * pageSize, page * pageSize).map((role, idx) => (
                                    <tr key={role.id}>
                                        <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{(page - 1) * pageSize + idx + 1}</td>
                                        <td>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{role.name}</div>
                                        </td>
                                        <td>
                                            <button
                                                className="chip chip-blue"
                                                onClick={() => openRoleUsers(role)}
                                                style={{ cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}
                                            >
                                                👥 {role.usersCount ?? 0} {t('Users', 'مستخدم')}
                                            </button>
                                        </td>
                                        <td>
                                            <div className="btn-group">
                                                <button className="btn btn-secondary btn-sm" onClick={() => openPerms(role)}>✏️ {t('Edit', 'تعديل')}</button>
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteRole(role.id, role.name)}>🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {filteredRoles.length > 0 && (
                    <Pagination
                        currentPage={page}
                        totalItems={filteredRoles.length}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={setPageSize}
                    />
                )}

                {/* ════════════════════ MODALS ════════════════════ */}

                {/* Add Role Modal */}
                {modal === 'addRole' && (
                    <ModalShell title={`➕ ${t('Add Role', 'إضافة دور')}`} onClose={() => setModal(null)}>
                        <div className="form-group">
                            <label className="form-label">{t('Role Name', 'اسم الدور')} *</label>
                            <input
                                className="form-input"
                                placeholder={t('e.g. Installation Supervisor', 'مثال: مشرف تركيب')}
                                value={newRoleName}
                                onChange={e => setNewRoleName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreateRole()}
                                autoFocus
                            />
                        </div>
                        <div className="modal-footer" style={{ paddingTop: 16 }}>
                            <button className="btn btn-secondary" onClick={() => setModal(null)}>{t('Cancel', 'إلغاء')}</button>
                            <button className="btn btn-primary" disabled={actionLoading || !newRoleName.trim()} onClick={handleCreateRole}>
                                {actionLoading ? `⏳ ${t('Creating...', 'جارٍ الإنشاء...')}` : t('Create Role', 'إنشاء دور')}
                            </button>
                        </div>
                    </ModalShell>
                )}

                {/* Permissions Modal */}
                {modal === 'permissions' && activeRole && (
                    <ModalShell title={`✏️ ${t('Edit Role', 'تعديل الدور')} — ${activeRole.name}`} onClose={() => setModal(null)} wide>
                        <div className="form-group" style={{ marginBottom: 16 }}>
                            <label className="form-label">{t('Role Name', 'اسم الدور')}</label>
                            <input
                                className="form-input"
                                value={editRoleName}
                                onChange={e => setEditRoleName(e.target.value)}
                                placeholder={t('Role name', 'اسم الدور')}
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: 12 }}>
                            <label className="form-label">{t('Permissions', 'الصلاحيات')}</label>
                            <input
                                className="form-input"
                                placeholder={`🔍 ${t('Search permissions...', 'ابحث عن الصلاحيات...')}`}
                                value={permSearch}
                                onChange={e => setPermSearch(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setRolePerms(filteredPerms.map(p => p.id))}>{t('Select All', 'تحديد الكل')}</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setRolePerms([])}>{t('Clear All', 'مسح الكل')}</button>
                            <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>
                                {rolePerms.length} / {permissions.length} {t('selected', 'محدد')}
                            </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, maxHeight: 380, overflowY: 'auto', padding: '4px 0' }}>
                            {filteredPerms.map(perm => {
                                const checked = rolePerms.includes(perm.id);
                                return (
                                    <label
                                        key={perm.id}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '10px 14px',
                                            background: checked ? 'rgba(99,102,241,0.1)' : 'var(--bg-tertiary)',
                                            border: `1px solid ${checked ? 'rgba(99,102,241,0.35)' : 'var(--border)'}`,
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer', fontSize: 13,
                                            transition: 'all 150ms',
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => {
                                                if (checked) setRolePerms(prev => prev.filter(id => id !== perm.id));
                                                else setRolePerms(prev => [...prev, perm.id]);
                                            }}
                                            style={{ accentColor: '#6366f1' }}
                                        />
                                        <span style={{ fontWeight: checked ? 600 : 400, color: checked ? 'var(--accent-primary-hover)' : 'var(--text-secondary)' }}>
                                            {perm.name}
                                        </span>
                                    </label>
                                );
                            })}
                            {filteredPerms.length === 0 && (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                                    No permissions found
                                </div>
                            )}
                        </div>

                        <div className="modal-footer" style={{ paddingTop: 20, borderTop: '1px solid var(--border)', marginTop: 16 }}>
                            <button className="btn btn-secondary" onClick={() => setModal(null)}>{t('Cancel', 'إلغاء')}</button>
                            <button className="btn btn-primary" disabled={actionLoading} onClick={handleSavePerms}>
                                {actionLoading ? `⏳ ${t('Saving...', 'جارٍ الحفظ...')}` : `💾 ${t('Save Permissions', 'حفظ الصلاحيات')}`}
                            </button>
                        </div>
                    </ModalShell>
                )}

                {/* View Users in Role Modal */}
                {modal === 'viewUsers' && activeRole && (
                    <ModalShell title={`👥 ${t('Users in', 'المستخدمون في')} — ${activeRole.name}`} onClose={() => setModal(null)} wide>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={() => { setModal('addUser'); setUserForm(prev => ({ ...prev, RoleId: activeRole.id })); }}
                            >
                                + {t('Add User to this Role', 'إضافة مستخدم لهذا الدور')}
                            </button>
                            <div className="table-search" style={{ flex: 1, minWidth: 180 }}>
                                <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>🔍</span>
                                <input
                                    placeholder={t('Search by name, email, phone...', 'ابحث بالاسم أو البريد أو الهاتف...')}
                                    value={userSearch}
                                    onChange={e => setUserSearch(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="table-container" style={{ border: 'none', overflowX: 'auto' }}>
                            <table style={{ minWidth: 600 }}>
                                <thead>
                                    <tr>
                                        <th>{t('Name', 'الاسم')}</th>
                                        <th>{t('Email', 'البريد')}</th>
                                        <th>{t('Phone', 'الهاتف')}</th>
                                        <th>{t('Department', 'القسم')}</th>
                                        <th style={{ width: 100 }}>{t('Actions', 'الإجراءات')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {roleUsers.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                                                {t('No users assigned to this role yet', 'لا يوجد مستخدمون مُعيَّنون لهذا الدور بعد')}
                                            </td>
                                        </tr>
                                    ) : (
                                        roleUsers.filter(u => {
                                            const q = userSearch.toLowerCase();
                                            return !q || u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.phone?.toLowerCase().includes(q);
                                        }).map(u => (
                                            <tr key={u.id}>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#fff', flexShrink: 0 }}>
                                                            {u.name?.charAt(0) || 'U'}
                                                        </div>
                                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</span>
                                                    </div>
                                                </td>
                                                <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                                                <td style={{ color: 'var(--text-muted)' }}>{u.phone || '—'}</td>
                                                <td>{u.departmentName || `Dept #${u.departmentId}`}</td>
                                                <td>
                                                    <div className="btn-group">
                                                        <button className="btn btn-secondary btn-sm" onClick={() => openEditUser(u)}>✏️ {t('Edit', 'تعديل')}</button>
                                                        <button className="btn btn-danger btn-sm" title="Delete user" onClick={() => handleDeleteUser(u.id, u.name)}>🗑️</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </ModalShell>
                )}

                {/* Edit User Modal */}
                {modal === 'editUser' && editUserTarget && (
                    <ModalShell title={`✏️ ${t('Edit User', 'تعديل المستخدم')} — ${editUserTarget.name}`} onClose={() => setModal('viewUsers')} wide>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">{t('Full Name', 'الاسم الكامل')}</label>
                                <input className="form-input" value={editUserForm.Name} onChange={e => setEditUserForm(p => ({ ...p, Name: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Email', 'البريد الإلكتروني')}</label>
                                <input className="form-input" type="email" value={editUserForm.Email} onChange={e => setEditUserForm(p => ({ ...p, Email: e.target.value }))} />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">{t('Phone', 'الهاتف')}</label>
                                <input className="form-input" value={editUserForm.Phone} onChange={e => setEditUserForm(p => ({ ...p, Phone: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Password', 'كلمة المرور')} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 12 }}>({t('leave blank to keep current', 'اتركه فارغاً للإبقاء على الحالية')})</span></label>
                                <input className="form-input" type="password" placeholder="••••••••" value={editUserForm.Password} onChange={e => setEditUserForm(p => ({ ...p, Password: e.target.value }))} />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">{t('Role', 'الدور')}</label>
                                <select className="form-select" value={editUserForm.RoleId} onChange={e => setEditUserForm(p => ({ ...p, RoleId: Number(e.target.value) }))}>
                                    <option value={0}>— {t('Select Role', 'اختر الدور')} —</option>
                                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Department', 'القسم')}</label>
                                <select className="form-select" value={editUserForm.DepartmentId} onChange={e => setEditUserForm(p => ({ ...p, DepartmentId: Number(e.target.value) }))}>
                                    <option value={0}>— {t('Select Department', 'اختر القسم')} —</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="modal-footer" style={{ paddingTop: 16 }}>
                            <button className="btn btn-secondary" onClick={() => setModal('viewUsers')}>{t('Cancel', 'إلغاء')}</button>
                            <button className="btn btn-primary" disabled={actionLoading} onClick={handleSaveEditUser}>
                                {actionLoading ? `⏳ ${t('Saving...', 'جارٍ الحفظ...')}` : `💾 ${t('Save', 'حفظ')}`}
                            </button>
                        </div>
                    </ModalShell>
                )}

                {/* Add User Modal */}
                {modal === 'addUser' && (
                    <ModalShell title={`👤 ${t('Create New User', 'إنشاء مستخدم جديد')}`} onClose={() => setModal(null)} wide>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">{t('Full Name', 'الاسم الكامل')} *</label>
                                <input className="form-input" placeholder={t('Ahmed Al-Farsi', 'أحمد الفارسي')} value={userForm.Name} onChange={e => setUserForm(p => ({ ...p, Name: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Email', 'البريد الإلكتروني')} *</label>
                                <input className="form-input" type="email" placeholder="ahmed@company.com" value={userForm.Email} onChange={e => setUserForm(p => ({ ...p, Email: e.target.value }))} />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">{t('Phone', 'الهاتف')}</label>
                                <input className="form-input" placeholder="+966 5x xxx xxxx" value={userForm.Phone} onChange={e => setUserForm(p => ({ ...p, Phone: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Password', 'كلمة المرور')} *</label>
                                <input className="form-input" type="password" placeholder={t('Min 8 characters', 'الحد الأدنى 8 أحرف')} value={userForm.Password} onChange={e => setUserForm(p => ({ ...p, Password: e.target.value }))} />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">{t('Role', 'الدور')} *</label>
                                <select className="form-select" value={userForm.RoleId} onChange={e => setUserForm(p => ({ ...p, RoleId: Number(e.target.value) }))}>
                                    <option value={0}>— {t('Select Role', 'اختر الدور')} —</option>
                                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Department', 'القسم')}</label>
                                <select className="form-select" value={userForm.DepartmentId} onChange={e => setUserForm(p => ({ ...p, DepartmentId: Number(e.target.value) }))}>
                                    <option value={0}>— {t('Select Department', 'اختر القسم')} —</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Super Admin toggle */}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: userForm.IsSuperAdmin ? 'rgba(239,68,68,0.08)' : 'var(--bg-tertiary)', border: `1px solid ${userForm.IsSuperAdmin ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', marginBottom: 20 }}>
                            <input type="checkbox" style={{ accentColor: '#ef4444', width: 16, height: 16 }} checked={userForm.IsSuperAdmin} onChange={e => setUserForm(p => ({ ...p, IsSuperAdmin: e.target.checked }))} />
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>{t('Super Admin', 'مشرف عام')}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('Grants full access to all features', 'يمنح وصولاً كاملاً لجميع الميزات')}</div>
                            </div>
                        </label>

                        <div className="modal-footer" style={{ paddingTop: 0 }}>
                            <button className="btn btn-secondary" onClick={() => setModal(null)}>{t('Cancel', 'إلغاء')}</button>
                            <button className="btn btn-primary" disabled={actionLoading || !userForm.Name || !userForm.Email || !userForm.Password} onClick={handleCreateUser}>
                                {actionLoading ? `⏳ ${t('Creating...', 'جارٍ الإنشاء...')}` : `✅ ${t('Create User', 'إنشاء مستخدم')}`}
                            </button>
                        </div>
                    </ModalShell>
                )}
            </div>
        </PermissionGuard>
    );
}

/* ─── Reusable small components ─── */

function StatPill({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
    return (
        <div className="stat-card">
            <div className="stat-icon" style={{ background: `${color}1a`, color }}>{icon}</div>
            <div>
                <div className="stat-value">{value}</div>
                <div className="stat-label">{label}</div>
            </div>
        </div>
    );
}

function ModalShell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" style={{ maxWidth: wide ? 700 : 440 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 style={{ fontSize: 17 }}>{title}</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">{children}</div>
            </div>
        </div>
    );
}
