'use client';

import { useEffect, useState } from 'react';
import {
    getBranches, createBranch, updateBranch, deleteBranch,
    getDepartments, createDepartment, updateDepartment, deleteDepartment,
    getDepartmentUsers, createDepartmentUser, deleteDepartmentUser, updateDepartmentUser,
    getRoles, createRole, deleteRole,
    getPermissions, getRolePermissions, updateRolePermissions,
    getUserTypes,
} from '@/lib/endpoints';
import { Branch, Department, DepartmentUser, Role, Permission } from '@/types';
import { useLang } from '@/context/LanguageContext';

type AdminTab = 'branches' | 'departments' | 'users' | 'roles' | 'permissions';

export default function AdminPage() {
    const { t } = useLang();
    const [activeTab, setActiveTab] = useState<AdminTab>('branches');
    const [branches, setBranches] = useState<Branch[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [users, setUsers] = useState<DepartmentUser[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [userTypes, setUserTypes] = useState<{ value: number; text: string }[]>([]);
    const [loading, setLoading] = useState(true);

    // Forms
    const [newBranch, setNewBranch] = useState({ name: '', email: '', phone: '' });
    const [newDept, setNewDept] = useState({ branchId: 0, name: '' });
    const [editBranch, setEditBranch] = useState<{ id: number; name: string; email: string; phone: string } | null>(null);
    const [editDept, setEditDept] = useState<{ id: number; name: string; branchId: number } | null>(null);
    const [editUser, setEditUser] = useState<{ id: number; name: string; email: string; phone: string; departmentId: number; roleId: number } | null>(null);
    const [editUserImage, setEditUserImage] = useState<File | null>(null);
    const [newRoleName, setNewRoleName] = useState('');
    const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
    const [rolePerms, setRolePerms] = useState<number[]>([]);
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [permSearch, setPermSearch] = useState('');
    const [showPermModal, setShowPermModal] = useState(false);

    const [userForm, setUserForm] = useState({
        DepartmentId: 0, Name: '', Email: '', Phone: '', Password: '',
        RoleId: 0, IsSuperAdmin: false, Type: '',
    });

    useEffect(() => { loadAll(); }, []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [b, d, r, p, ut] = await Promise.all([
                getBranches().catch(() => []),
                getDepartments().catch(() => []),
                getRoles().catch(() => []),
                getPermissions().catch(() => []),
                getUserTypes().catch(() => []),
            ]);
            setBranches(Array.isArray(b) ? b : []);
            setDepartments(Array.isArray(d) ? d : []);
            setRoles(Array.isArray(r) ? r : []);
            setPermissions(Array.isArray(p) ? p : []);
            setUserTypes(Array.isArray(ut) ? ut : []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const loadUsers = async (branchId?: number, departmentId?: number) => {
        try {
            const u = await getDepartmentUsers(branchId, departmentId);
            setUsers(Array.isArray(u) ? u : []);
        } catch { setUsers([]); }
    };

    // ── Branch ──
    const handleCreateBranch = async () => {
        setActionError(null);
        if (!newBranch.name) {
            setActionError(t('Branch name is required.', 'اسم الفرع مطلوب.'));
            return;
        }
        setActionLoading(true);
        try {
            await createBranch(newBranch);
            setNewBranch({ name: '', email: '', phone: '' });
            setBranches(await getBranches().catch(() => []));
        } catch (err) { setActionError(err instanceof Error ? err.message : t('Failed', 'فشل')); }
        finally { setActionLoading(false); }
    };

    const handleUpdateBranch = async () => {
        setActionError(null);
        if (!editBranch) return;
        if (!editBranch.name) {
            setActionError(t('Branch name is required.', 'اسم الفرع مطلوب.'));
            return;
        }
        setActionLoading(true);
        try {
            await updateBranch(editBranch.id, { name: editBranch.name, email: editBranch.email, phone: editBranch.phone });
            setBranches(await getBranches().catch(() => []));
            setEditBranch(null);
        } catch (err) { setActionError(err instanceof Error ? err.message : t('Failed', 'فشل')); }
        finally { setActionLoading(false); }
    };

    const handleDeleteBranch = async (id: number) => {
        if (!confirm(t('Delete this branch? This may affect departments and users assigned to it.', 'هل تريد حذف هذا الفرع؟ قد يؤثر ذلك على الأقسام والمستخدمين التابعين له.'))) return;
        try {
            await deleteBranch(id);
            setBranches(prev => prev.filter(b => b.id !== id));
        } catch (err) { setActionError(err instanceof Error ? err.message : t('Failed', 'فشل')); }
    };

    // ── Department ──
    const handleCreateDept = async () => {
        setActionError(null);
        if (!newDept.branchId || !newDept.name) {
            setActionError(t('Please select a branch and enter a department name.', 'الرجاء اختيار الفرع وإدخال اسم القسم.'));
            return;
        }
        setActionLoading(true);
        try {
            await createDepartment(newDept);
            setNewDept({ branchId: 0, name: '' });
            setDepartments(await getDepartments().catch(() => []));
        } catch (err) { setActionError(err instanceof Error ? err.message : t('Failed', 'فشل')); }
        finally { setActionLoading(false); }
    };

    const handleDeleteDept = async (id: number) => {
        if (!confirm(t('Delete this department? This may affect users assigned to it.', 'هل تريد حذف هذا القسم؟ قد يؤثر ذلك على المستخدمين التابعين له.'))) return;
        try {
            await deleteDepartment(id);
            setDepartments(prev => prev.filter(d => d.id !== id));
        } catch (err) { setActionError(err instanceof Error ? err.message : t('Failed', 'فشل')); }
    };

    const handleUpdateDept = async () => {
        setActionError(null);
        if (!editDept) return;
        if (!editDept.name.trim()) {
            setActionError(t('Department name is required.', 'اسم القسم مطلوب.'));
            return;
        }
        setActionLoading(true);
        try {
            await updateDepartment(editDept.id, { name: editDept.name, branchId: editDept.branchId || undefined });
            setDepartments(await getDepartments().catch(() => []));
            setEditDept(null);
        } catch (err) { setActionError(err instanceof Error ? err.message : t('Failed', 'فشل')); }
        finally { setActionLoading(false); }
    };

    // ── Role ──
    const handleCreateRole = async () => {
        if (!newRoleName) return;
        setActionLoading(true);
        try {
            await createRole(newRoleName);
            setNewRoleName('');
            const r = await getRoles();
            setRoles(Array.isArray(r) ? r : []);
        } catch (err) { alert(err instanceof Error ? err.message : t('Failed', 'فشل')); }
        finally { setActionLoading(false); }
    };

    const handleDeleteRole = async (id: number) => {
        if (!confirm(t('Delete this role?', 'هل تريد حذف هذا الدور؟'))) return;
        try {
            await deleteRole(id);
            setRoles(prev => prev.filter(r => r.id !== id));
        } catch (err) { alert(err instanceof Error ? err.message : t('Failed', 'فشل')); }
    };

    const handleSelectRole = async (id: number) => {
        setSelectedRoleId(id);
        try {
            const perms = await getRolePermissions(id);
            setRolePerms(Array.isArray(perms) ? perms.map(p => p.id) : []);
        } catch { setRolePerms([]); }
    };

    const handleSaveRolePermissions = async () => {
        if (!selectedRoleId) return;
        setActionLoading(true);
        try {
            await updateRolePermissions(selectedRoleId, rolePerms);
            alert(t('Permissions saved!', 'تم حفظ الصلاحيات!'));
        } catch (err) { alert(err instanceof Error ? err.message : t('Failed', 'فشل')); }
        finally { setActionLoading(false); }
    };

    const handleCreateUser = async () => {
        if (!userForm.Name || !userForm.Email || !userForm.Password || !userForm.Type) {
            alert(t('Name, email, password, and type are required.', 'الاسم والبريد الإلكتروني وكلمة المرور والنوع مطلوبة.'));
            return;
        }
        setActionLoading(true);
        try {
            const fd = new FormData();
            if (userForm.DepartmentId) fd.append('DepartmentId', String(userForm.DepartmentId));
            if (userForm.RoleId) fd.append('RoleId', String(userForm.RoleId));
            fd.append('Name', userForm.Name);
            fd.append('Email', userForm.Email);
            fd.append('Phone', userForm.Phone);
            fd.append('Password', userForm.Password);
            fd.append('IsSuperAdmin', String(userForm.IsSuperAdmin));
            fd.append('Type', userForm.Type);
            await createDepartmentUser(fd);
            setUserForm({ DepartmentId: 0, Name: '', Email: '', Phone: '', Password: '', RoleId: 0, IsSuperAdmin: false, Type: '' });
            alert(t('User created!', 'تم إنشاء المستخدم!'));
            loadUsers();
        } catch (err) {
            alert(err instanceof Error ? err.message : t('Failed to create user', 'فشل إنشاء المستخدم'));
        } finally { setActionLoading(false); }
    };

    const handleDeleteUser = async (id: number, name: string) => {
        if (!confirm(`${t('Delete user', 'حذف المستخدم')} "${name}"?`)) return;
        try {
            await deleteDepartmentUser(id);
            setUsers(prev => prev.filter(u => u.id !== id));
        } catch (err) {
            alert(err instanceof Error ? err.message : t('Failed to delete user', 'فشل حذف المستخدم'));
        }
    };

    const handleUpdateUser = async () => {
        if (!editUser) return;
        setActionLoading(true);
        try {
            await updateDepartmentUser(
                editUser.id,
                { Name: editUser.name, Email: editUser.email, Phone: editUser.phone, DepartmentId: editUser.departmentId || undefined, RoleId: editUser.roleId || undefined },
                editUserImage,
            );
            setEditUser(null);
            setEditUserImage(null);
            loadUsers();
        } catch (err) {
            alert(err instanceof Error ? err.message : t('Failed to update user', 'فشل تحديث المستخدم'));
        } finally { setActionLoading(false); }
    };

    // ── Grouped permissions helper ──
    const groupPermissions = (perms: Permission[]) => {
        const groups: Record<string, Permission[]> = {};
        perms.forEach(p => {
            const parts = p.name.split('.');
            const group = parts.length >= 2 ? parts[1] : 'Other';
            groups[group] = [...(groups[group] || []), p];
        });
        return groups;
    };

    const tabs: { key: AdminTab; label: string; icon: string }[] = [
        { key: 'branches', label: t('Branches', 'الفروع'), icon: '🏢' },
        { key: 'departments', label: t('Departments', 'الأقسام'), icon: '🏗️' },
        { key: 'users', label: t('Users', 'المستخدمون'), icon: '👥' },
        { key: 'roles', label: t('Roles', 'الأدوار'), icon: '🔑' },
        { key: 'permissions', label: t('Permissions', 'الصلاحيات'), icon: '🛡️' },
    ];

    const filteredPermsForRole = permissions.filter(p =>
        p.name.toLowerCase().includes(permSearch.toLowerCase())
    );

    const selectedRole = roles.find(r => r.id === selectedRoleId);

    return (
        <div className="animate-in">
            <div className="page-header">
                <h1>⚙️ {t('Admin Settings', 'إعدادات الإدارة')}</h1>
                <p>{t('Manage branches, departments, users, roles, and permissions', 'إدارة الفروع والأقسام والمستخدمين والأدوار والصلاحيات')}</p>
            </div>

            <div className="tabs">
                {tabs.map(tab => (
                    <button key={tab.key} className={`tab ${activeTab === tab.key ? 'active' : ''}`}
                        onClick={() => { setActiveTab(tab.key); if (tab.key === 'users') loadUsers(); }}>
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)' }}>{t('Loading settings...', 'جارٍ تحميل الإعدادات...')}</div>
            ) : (
                <>
                    {/* ══════════════ BRANCHES ══════════════ */}
                    {activeTab === 'branches' && (
                        <div className="card">
                            <div className="card-title" style={{ marginBottom: 20 }}>{t('Branches', 'الفروع')}</div>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                                <input className="form-input" placeholder={t('Branch name', 'اسم الفرع')} value={newBranch.name} onChange={e => setNewBranch({ ...newBranch, name: e.target.value })} style={{ flex: 1, minWidth: 160 }} />
                                <input className="form-input" placeholder={t('Email', 'البريد')} value={newBranch.email} onChange={e => setNewBranch({ ...newBranch, email: e.target.value })} style={{ flex: 1, minWidth: 160 }} />
                                <input className="form-input" placeholder={t('Phone', 'الهاتف')} value={newBranch.phone} onChange={e => setNewBranch({ ...newBranch, phone: e.target.value })} style={{ flex: 1, minWidth: 120 }} />
                                <button className="btn btn-primary btn-sm" disabled={actionLoading} onClick={handleCreateBranch}>+ {t('Add', 'إضافة')}</button>
                            </div>
                            {actionError && activeTab === 'branches' && (
                                <div style={{ background: 'var(--danger-bg, #fee)', color: 'var(--danger, #c00)', border: '1px solid var(--danger, #c00)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 12, whiteSpace: 'pre-line', fontSize: 14 }}>
                                    {actionError}
                                </div>
                            )}
                            {branches.map(b => (
                                <div key={b.id} style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', marginBottom: 8 }}>
                                    {editBranch?.id === b.id ? (
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                            <input className="form-input" value={editBranch.name} onChange={e => setEditBranch({ ...editBranch, name: e.target.value })} placeholder={t('Name', 'الاسم')} style={{ flex: 1, minWidth: 120 }} />
                                            <input className="form-input" value={editBranch.email} onChange={e => setEditBranch({ ...editBranch, email: e.target.value })} placeholder={t('Email', 'البريد')} style={{ flex: 1, minWidth: 140 }} />
                                            <input className="form-input" value={editBranch.phone} onChange={e => setEditBranch({ ...editBranch, phone: e.target.value })} placeholder={t('Phone', 'الهاتف')} style={{ flex: 1, minWidth: 100 }} />
                                            <button className="btn btn-primary btn-sm" disabled={actionLoading} onClick={handleUpdateBranch}>💾</button>
                                            <button className="btn btn-secondary btn-sm" onClick={() => setEditBranch(null)}>✕</button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{b.name}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{b.email || '—'} • {b.phone || '—'}</div>
                                            </div>
                                            <div className="btn-group">
                                                <button className="btn btn-secondary btn-sm" onClick={() => setEditBranch({ id: b.id, name: b.name, email: b.email || '', phone: b.phone || '' })}>✏️</button>
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteBranch(b.id)}>🗑️</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {branches.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('No branches yet.', 'لا توجد فروع بعد.')}</p>}
                        </div>
                    )}

                    {/* ══════════════ DEPARTMENTS ══════════════ */}
                    {activeTab === 'departments' && (
                        <div className="card">
                            <div className="card-title" style={{ marginBottom: 20 }}>{t('Departments', 'الأقسام')}</div>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
                                <select className="form-select" value={newDept.branchId} onChange={e => setNewDept({ ...newDept, branchId: Number(e.target.value) })} style={{ minWidth: 160 }}>
                                    <option value={0}>— {t('Branch', 'الفرع')} —</option>
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                                <input className="form-input" placeholder={t('Department name', 'اسم القسم')} value={newDept.name} onChange={e => setNewDept({ ...newDept, name: e.target.value })} style={{ flex: 1, minWidth: 160 }} />
                                <button className="btn btn-primary btn-sm" disabled={actionLoading} onClick={handleCreateDept}>+ {t('Add', 'إضافة')}</button>
                            </div>
                            {actionError && activeTab === 'departments' && (
                                <div style={{ background: 'var(--danger-bg, #fee)', color: 'var(--danger, #c00)', border: '1px solid var(--danger, #c00)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: 12, whiteSpace: 'pre-line', fontSize: 14 }}>
                                    {actionError}
                                </div>
                            )}
                            {departments.map(d => (
                                <div key={d.id} style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', marginBottom: 8 }}>
                                    {editDept?.id === d.id ? (
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                            <input className="form-input" value={editDept.name} onChange={e => setEditDept({ ...editDept, name: e.target.value })} placeholder={t('Department name', 'اسم القسم')} style={{ flex: 1, minWidth: 140 }} />
                                            <button className="btn btn-primary btn-sm" disabled={actionLoading} onClick={handleUpdateDept}>💾</button>
                                            <button className="btn btn-secondary btn-sm" onClick={() => setEditDept(null)}>✕</button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{d.name}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('Branch', 'الفرع')}: {d.branchId ? (branches.find(b => b.id === d.branchId)?.name || `#${d.branchId}`) : '—'}</div>
                                            </div>
                                            <div className="btn-group">
                                                <button className="btn btn-secondary btn-sm" onClick={() => setEditDept({ id: d.id, name: d.name, branchId: d.branchId })}>✏️</button>
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteDept(d.id)}>🗑️</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {departments.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('No departments yet.', 'لا توجد أقسام بعد.')}</p>}
                        </div>
                    )}

                    {/* ══════════════ USERS ══════════════ */}
                    {activeTab === 'users' && (
                        <div>
                            {/* ── Add User Form ── */}
                            <div className="card" style={{ marginBottom: 16 }}>
                                <div className="card-title" style={{ marginBottom: 16 }}>{t('Add New User', 'إضافة مستخدم جديد')}</div>
                                <div className="form-row">
                                    <div className="form-group"><label className="form-label">{t('Name', 'الاسم')} *</label><input className="form-input" value={userForm.Name} onChange={e => setUserForm({ ...userForm, Name: e.target.value })} /></div>
                                    <div className="form-group"><label className="form-label">{t('Email', 'البريد')} *</label><input className="form-input" type="email" value={userForm.Email} onChange={e => setUserForm({ ...userForm, Email: e.target.value })} /></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label className="form-label">{t('Phone', 'الهاتف')}</label><input className="form-input" value={userForm.Phone} onChange={e => setUserForm({ ...userForm, Phone: e.target.value })} /></div>
                                    <div className="form-group"><label className="form-label">{t('Password', 'كلمة المرور')} *</label><input className="form-input" type="password" value={userForm.Password} onChange={e => setUserForm({ ...userForm, Password: e.target.value })} /></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">{t('Type', 'النوع')} *</label>
                                        <select className="form-select" value={userForm.Type} onChange={e => setUserForm({ ...userForm, Type: e.target.value })}>
                                            <option value="">— {t('Select Type', 'اختر النوع')} —</option>
                                            {userTypes.map(ut => <option key={ut.value} value={ut.text}>{ut.text}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('Department', 'القسم')}</label>
                                        <select className="form-select" value={userForm.DepartmentId} onChange={e => setUserForm({ ...userForm, DepartmentId: Number(e.target.value) })}>
                                            <option value={0}>— {t('Select', 'اختر')} —</option>
                                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">{t('Role', 'الدور')}</label>
                                        <select className="form-select" value={userForm.RoleId} onChange={e => setUserForm({ ...userForm, RoleId: Number(e.target.value) })}>
                                            <option value={0}>— {t('Select Role', 'اختر الدور')} —</option>
                                            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                        </select>
                                    </div>
                                </div>



                                <div style={{ marginTop: 16 }}>
                                    <button className="btn btn-primary" disabled={actionLoading || !userForm.Name || !userForm.Email || !userForm.Password || !userForm.Type} onClick={handleCreateUser}>
                                        {actionLoading ? `⏳ ${t('Creating...', 'إنشاء...')}` : `✅ ${t('Create User', 'إنشاء مستخدم')}`}
                                    </button>
                                </div>
                            </div>

                            {/* ── Users List ── */}
                            <div className="card">
                                <div className="card-title" style={{ marginBottom: 16 }}>{t('All Users', 'جميع المستخدمين')}</div>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => loadUsers()}>{t('Load All', 'تحميل الكل')}</button>
                                    {departments.slice(0, 5).map(d => (
                                        <button key={d.id} className="btn btn-secondary btn-sm" onClick={() => loadUsers(undefined, d.id)}>{d.name}</button>
                                    ))}
                                </div>
                                <div className="table-container" style={{ border: 'none', overflowX: 'auto' }}>
                                    <table style={{ minWidth: 700 }}>
                                        <thead><tr>
                                            <th>{t('Name', 'الاسم')}</th>
                                            <th>{t('Email', 'البريد')}</th>
                                            <th>{t('Phone', 'الهاتف')}</th>
                                            <th>{t('Department', 'القسم')}</th>
                                            <th>{t('Role', 'الدور')}</th>
                                            <th>{t('Type', 'النوع')}</th>
                                            <th style={{ width: 60, position: 'sticky', right: 0, background: 'var(--bg-secondary)', zIndex: 1 }}>{t('Actions', 'الإجراءات')}</th>
                                        </tr></thead>
                                        <tbody>
                                            {users.map(u => (
                                                <tr key={u.id}>
                                                    <td className="table-cell-main">{u.name}</td>
                                                    <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                                                    <td style={{ color: 'var(--text-muted)' }}>{u.phone || '—'}</td>
                                                    <td>{u.departmentName || `#${u.departmentId}`}</td>
                                                    <td>
                                                        {roles.find(r => r.id === u.roleId)?.name || u.roleName || u.role
                                                            ? <span style={{ fontWeight: 600, color: 'var(--accent-primary-hover)' }}>{roles.find(r => r.id === u.roleId)?.name || u.roleName || u.role}</span>
                                                            : <span style={{ color: 'var(--text-muted)' }}>—</span>
                                                        }
                                                    </td>
                                                    <td>{u.type || '—'}</td>
                                                    <td style={{ position: 'sticky', right: 0, background: 'var(--bg-secondary)', zIndex: 1 }}>
                                                        <div className="btn-group">
                                                            <button className="btn btn-secondary btn-sm" onClick={() => { setEditUser({ id: u.id, name: u.name, email: u.email, phone: u.phone || '', departmentId: u.departmentId, roleId: u.roleId }); setEditUserImage(null); }}>✏️</button>
                                                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteUser(u.id, u.name)}>🗑️</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {users.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{t('Click a filter above to load users', 'انقر على فلتر أعلاه لتحميل المستخدمين')}</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ══════════════ ROLES ══════════════ */}
                    {activeTab === 'roles' && (
                        <div className="card">
                            <div className="card-title" style={{ marginBottom: 20 }}>{t('Roles', 'الأدوار')}</div>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                                <input className="form-input" placeholder={t('New role name', 'اسم الدور الجديد')} value={newRoleName} onChange={e => setNewRoleName(e.target.value)} style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && handleCreateRole()} />
                                <button className="btn btn-primary btn-sm" disabled={actionLoading || !newRoleName} onClick={handleCreateRole}>+ {t('Add', 'إضافة')}</button>
                            </div>
                            {roles.map(role => (
                                <div key={role.id} style={{ padding: '12px 16px', background: selectedRoleId === role.id ? 'rgba(99,102,241,0.08)' : 'var(--bg-tertiary)', border: selectedRoleId === role.id ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent', borderRadius: 'var(--radius-md)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => handleSelectRole(role.id)}>
                                    <div style={{ fontWeight: 600, fontSize: 15 }}>{role.name}</div>
                                    <div className="btn-group">
                                        <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); handleSelectRole(role.id); setPermSearch(''); setShowPermModal(true); }}>{t('Edit Permissions', 'تعديل الصلاحيات')}</button>
                                        <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); handleDeleteRole(role.id); }}>{t('Delete', 'حذف')}</button>
                                    </div>
                                </div>
                            ))}
                            {roles.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('No roles yet.', 'لا توجد أدوار بعد.')}</p>}
                        </div>
                    )}

                    {/* ══════════════ PERMISSIONS ══════════════ */}
                    {activeTab === 'permissions' && (
                        <div className="card">
                            <div className="card-title" style={{ marginBottom: 4 }}>{t('Permissions Management', 'إدارة الصلاحيات')}</div>
                            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
                                {t('Select a role to edit its permissions.', 'اختر دوراً لتعديل صلاحياته.')}
                            </p>

                            <div className="form-group" style={{ marginBottom: 20 }}>
                                <label className="form-label">{t('Select Role to Manage', 'اختر الدور للإدارة')}</label>
                                <select className="form-select" value={selectedRoleId || ''} onChange={e => { const v = Number(e.target.value); if (v) handleSelectRole(v); setSelectedRoleId(Number(e.target.value) || null); }}>
                                    <option value="">— {t('Select Role', 'اختر الدور')} —</option>
                                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>

                            {selectedRoleId && (
                                <>
                                    <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(99,102,241,0.08)', borderRadius: 'var(--radius-md)', fontWeight: 600 }}>
                                        🔑 {selectedRole?.name}
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                        <input className="form-input" placeholder={`🔍 ${t('Search permissions...', 'ابحث عن الصلاحيات...')}`} value={permSearch} onChange={e => setPermSearch(e.target.value)} style={{ flex: 1 }} />
                                        <button className="btn btn-secondary btn-sm" onClick={() => setRolePerms(filteredPermsForRole.map(p => p.id))}>{t('Select All', 'تحديد الكل')}</button>
                                        <button className="btn btn-secondary btn-sm" onClick={() => setRolePerms([])}>{t('Clear All', 'مسح الكل')}</button>
                                    </div>
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                                        {rolePerms.length} / {permissions.length} {t('permissions selected', 'صلاحيات محددة')}
                                    </div>

                                    {/* Grouped permissions */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 400, overflowY: 'auto', marginBottom: 20 }}>
                                        {Object.entries(groupPermissions(filteredPermsForRole)).map(([group, perms]) => (
                                            <div key={group}>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{group}</div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
                                                    {perms.map(p => {
                                                        const checked = rolePerms.includes(p.id);
                                                        const shortName = p.name.split('.').pop() || p.name;
                                                        return (
                                                            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: checked ? 'rgba(16,185,129,0.1)' : 'var(--bg-tertiary)', border: `1px solid ${checked ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 13, transition: 'all 150ms' }}>
                                                                <input type="checkbox" checked={checked} onChange={() => setRolePerms(prev => checked ? prev.filter(id => id !== p.id) : [...prev, p.id])} style={{ accentColor: '#10b981' }} />
                                                                <div>
                                                                    <div style={{ fontWeight: checked ? 600 : 400 }}>{shortName}</div>
                                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.name}</div>
                                                                </div>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <button className="btn btn-primary btn-sm" disabled={actionLoading} onClick={handleSaveRolePermissions}>
                                        {actionLoading ? `⏳ ${t('Saving...', 'جارٍ الحفظ...')}` : `💾 ${t('Save Permissions', 'حفظ الصلاحيات')}`}
                                    </button>
                                </>
                            )}

                            {roles.length === 0 && (
                                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('No roles yet. Create a role in the Roles tab first.', 'لا توجد أدوار. أنشئ دوراً في تبويب الأدوار أولاً.')}</p>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* ══════════ EDIT USER MODAL ══════════ */}
            {editUser && (
                <div className="modal-overlay" onClick={() => setEditUser(null)}>
                    <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 style={{ fontSize: 17 }}>✏️ {t('Edit User', 'تعديل المستخدم')}</h2>
                            <button className="modal-close" onClick={() => setEditUser(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">{t('Name', 'الاسم')}</label>
                                    <input className="form-input" value={editUser.name} onChange={e => setEditUser({ ...editUser, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('Email', 'البريد')}</label>
                                    <input className="form-input" type="email" value={editUser.email} onChange={e => setEditUser({ ...editUser, email: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">{t('Phone', 'الهاتف')}</label>
                                    <input className="form-input" value={editUser.phone} onChange={e => setEditUser({ ...editUser, phone: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('Department', 'القسم')}</label>
                                    <select className="form-select" value={editUser.departmentId} onChange={e => setEditUser({ ...editUser, departmentId: Number(e.target.value) })}>
                                        <option value={0}>— {t('Select', 'اختر')} —</option>
                                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Role', 'الدور')}</label>
                                <select className="form-select" value={editUser.roleId} onChange={e => setEditUser({ ...editUser, roleId: Number(e.target.value) })}>
                                    <option value={0}>— {t('Select Role', 'اختر الدور')} —</option>
                                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Profile Image', 'الصورة الشخصية')}</label>
                                <input className="form-input" type="file" accept="image/*" onChange={e => setEditUserImage(e.target.files?.[0] ?? null)} />
                                {editUserImage && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>📎 {editUserImage.name}</div>}
                            </div>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                                <button className="btn btn-secondary" onClick={() => setEditUser(null)}>{t('Cancel', 'إلغاء')}</button>
                                <button className="btn btn-primary" disabled={actionLoading} onClick={handleUpdateUser}>
                                    {actionLoading ? `⏳ ${t('Saving...', 'جارٍ الحفظ...')}` : `💾 ${t('Save Changes', 'حفظ التغييرات')}`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════ PERMISSIONS MODAL ══════════ */}
            {showPermModal && selectedRoleId && (
            <div className="modal-overlay" onClick={() => setShowPermModal(false)}>
                <div className="modal" style={{ maxWidth: 680 }} onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h2 style={{ fontSize: 17 }}>🛡️ {t('Permissions', 'الصلاحيات')} — {selectedRole?.name}</h2>
                        <button className="modal-close" onClick={() => setShowPermModal(false)}>×</button>
                    </div>
                    <div className="modal-body">
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                            <input className="form-input" placeholder={`🔍 ${t('Search permissions...', 'ابحث عن الصلاحيات...')}`} value={permSearch} onChange={e => setPermSearch(e.target.value)} style={{ flex: 1 }} />
                            <button className="btn btn-secondary btn-sm" onClick={() => setRolePerms(filteredPermsForRole.map(p => p.id))}>{t('Select All', 'تحديد الكل')}</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setRolePerms([])}>{t('Clear All', 'مسح الكل')}</button>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                            {rolePerms.length} / {permissions.length} {t('selected', 'محدد')}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 400, overflowY: 'auto', marginBottom: 20 }}>
                            {Object.entries(groupPermissions(filteredPermsForRole)).map(([group, perms]) => (
                                <div key={group}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{group}</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 6 }}>
                                        {perms.map(p => {
                                            const checked = rolePerms.includes(p.id);
                                            const shortName = p.name.split('.').pop() || p.name;
                                            return (
                                                <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: checked ? 'rgba(99,102,241,0.1)' : 'var(--bg-tertiary)', border: `1px solid ${checked ? 'rgba(99,102,241,0.35)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 13, transition: 'all 150ms' }}>
                                                    <input type="checkbox" checked={checked} onChange={() => setRolePerms(prev => checked ? prev.filter(id => id !== p.id) : [...prev, p.id])} style={{ accentColor: '#6366f1' }} />
                                                    <div>
                                                        <div style={{ fontWeight: checked ? 600 : 400 }}>{shortName}</div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.name}</div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                            <button className="btn btn-secondary" onClick={() => setShowPermModal(false)}>{t('Cancel', 'إلغاء')}</button>
                            <button className="btn btn-primary" disabled={actionLoading} onClick={async () => { await handleSaveRolePermissions(); setShowPermModal(false); }}>
                                {actionLoading ? `⏳ ${t('Saving...', 'جارٍ الحفظ...')}` : `💾 ${t('Save Permissions', 'حفظ الصلاحيات')}`}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        </div>
    );
}
