'use client';

import { useEffect, useState } from 'react';
import {
    getBranches, createBranch, updateBranch, deleteBranch,
    getDepartments, createDepartment, updateDepartment, deleteDepartment,
    getDepartmentUsers, createDepartmentUser, deleteDepartmentUser, updateDepartmentUser,
    getRoles, createRole, deleteRole,
    getPermissions, getRolePermissions, updateRolePermissions, getRoleUsers,
    getUserTypes,
} from '@/lib/endpoints';
import { Branch, Department, DepartmentUser, Role, Permission } from '@/types';
import { API_BASE } from '@/lib/api';
import { useLang } from '@/context/LanguageContext';
import { useToast } from '@/context/ToastContext';
import { useAuth, PERMS } from '@/context/RoleContext';
import PermissionGuard from '@/components/PermissionGuard';
import Pagination from '@/components/Pagination';

type AdminTab = 'branches' | 'departments' | 'users' | 'roles' | 'permissions';

export default function AdminPage() {
    const { t } = useLang();
    const toast = useToast();
    const { user, hasPermission } = useAuth();
    const isSuper = user?.isSuperAdmin ?? false;
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
    const [newDept, setNewDept] = useState({ branchId: 0, name: '', salesSupervisiorId: 0, installationSupervisiorId: 0 });
    const [editBranch, setEditBranch] = useState<{ id: number; name: string; email: string; phone: string } | null>(null);
    const [editDept, setEditDept] = useState<{ id: number; name: string; branchId: number } | null>(null);
    const [editUser, setEditUser] = useState<{ id: number; name: string; email: string; phone: string; branchId: number; departmentId: number; roleId: number; isActive: boolean; currentImageUrl?: string; password: string } | null>(null);
    const [editUserDepts, setEditUserDepts] = useState<Department[]>([]);
    const [editUserImage, setEditUserImage] = useState<File | null>(null);
    const [editUserShowPassword, setEditUserShowPassword] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
    const [rolePerms, setRolePerms] = useState<number[]>([]);
    const [actionLoading, setActionLoading] = useState(false);
    const [permSearch, setPermSearch] = useState('');
    const [showPermModal, setShowPermModal] = useState(false);
    const [viewUsersRole, setViewUsersRole] = useState<Role | null>(null);
    const [roleUsersList, setRoleUsersList] = useState<DepartmentUser[]>([]);
    const [roleUsersLoading, setRoleUsersLoading] = useState(false);
    const [assignUserRole, setAssignUserRole] = useState<Role | null>(null);
    const [allUsersForAssign, setAllUsersForAssign] = useState<DepartmentUser[]>([]);
    const [assignSearch, setAssignSearch] = useState('');
    const [assignSearchLoading, setAssignSearchLoading] = useState(false);
    const [assigningUserId, setAssigningUserId] = useState<number | null>(null);
    const [userSearch, setUserSearch] = useState('');
    const [usersLoading, setUsersLoading] = useState(false);
    const [userActiveFilter, setUserActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [appliedActiveFilter, setAppliedActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [showAddUserModal, setShowAddUserModal] = useState(false);
    const [showAddBranchModal, setShowAddBranchModal] = useState(false);
    const [showAddDeptModal, setShowAddDeptModal] = useState(false);
    const [salesSupSearch, setSalesSupSearch] = useState('');
    const [salesSupResults, setSalesSupResults] = useState<DepartmentUser[]>([]);
    const [salesSupLoading, setSalesSupLoading] = useState(false);
    const [instSupSearch, setInstSupSearch] = useState('');
    const [instSupResults, setInstSupResults] = useState<DepartmentUser[]>([]);
    const [instSupLoading, setInstSupLoading] = useState(false);
    const [deptBranchFilter, setDeptBranchFilter] = useState(0);
    const [userBranchFilter, setUserBranchFilter] = useState(0);
    const [userDeptFilter, setUserDeptFilter] = useState(0);
    const [appliedBranchFilter, setAppliedBranchFilter] = useState(0);
    const [appliedDeptFilter, setAppliedDeptFilter] = useState(0);
    const [userFilterDepts, setUserFilterDepts] = useState<Department[]>([]);
    const [deptsList, setDeptsList] = useState<Department[]>([]);

    // Pagination
    const [usersPage, setUsersPage] = useState(1);
    const [usersPageSize, setUsersPageSize] = useState(10);
    const [branchesPage, setBranchesPage] = useState(1);
    const [branchesPageSize, setBranchesPageSize] = useState(10);
    const [deptsPage, setDeptsPage] = useState(1);
    const [deptsPageSize, setDeptsPageSize] = useState(10);
    const [rolesPage, setRolesPage] = useState(1);
    const [rolesPageSize, setRolesPageSize] = useState(10);

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
            setDeptsList(Array.isArray(d) ? d : []);
            setRoles(Array.isArray(r) ? r : []);
            setPermissions(Array.isArray(p) ? p : []);
            setUserTypes(Array.isArray(ut) ? ut : []);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const loadUsers = async (branchId?: number, departmentId?: number, username?: string) => {
        setUsersLoading(true);
        try {
            const u = await getDepartmentUsers(branchId, departmentId, { username: username || undefined });
            setUsers(Array.isArray(u) ? u : []);
        } catch { setUsers([]); }
        finally { setUsersLoading(false); }
    };

    const loadDeptsByBranch = async (branchId: number) => {
        try {
            const d = await getDepartments(branchId || undefined);
            setDeptsList(Array.isArray(d) ? d : []);
        } catch { setDeptsList([]); }
        setDeptsPage(1);
    };

    // ── Branch ──
    const handleCreateBranch = async () => {
        if (!newBranch.name) { toast.error(t('Branch name is required.', 'اسم الفرع مطلوب.')); return; }
        setActionLoading(true);
        try {
            await createBranch(newBranch);
            setNewBranch({ name: '', email: '', phone: '' });
            setBranches(await getBranches().catch(() => []));
            toast.success(t('Branch created!', 'تم إنشاء الفرع!'));
        } catch (err) { toast.error(err instanceof Error ? err.message : t('Failed to create branch', 'فشل إنشاء الفرع')); }
        finally { setActionLoading(false); }
    };

    const handleUpdateBranch = async () => {
        if (!editBranch) return;
        if (!editBranch.name) { toast.error(t('Branch name is required.', 'اسم الفرع مطلوب.')); return; }
        setActionLoading(true);
        try {
            await updateBranch(editBranch.id, { name: editBranch.name, email: editBranch.email, phone: editBranch.phone });
            setBranches(await getBranches().catch(() => []));
            setEditBranch(null);
            toast.success(t('Branch updated!', 'تم تحديث الفرع!'));
        } catch (err) { toast.error(err instanceof Error ? err.message : t('Failed to update branch', 'فشل تحديث الفرع')); }
        finally { setActionLoading(false); }
    };

    const handleDeleteBranch = async (id: number) => {
        if (!confirm(t('Delete this branch? This may affect departments and users assigned to it.', 'هل تريد حذف هذا الفرع؟ قد يؤثر ذلك على الأقسام والمستخدمين التابعين له.'))) return;
        try {
            await deleteBranch(id);
            setBranches(prev => prev.filter(b => b.id !== id));
            toast.success(t('Branch deleted.', 'تم حذف الفرع.'));
        } catch (err) { toast.error(err instanceof Error ? err.message : t('Failed to delete branch', 'فشل حذف الفرع')); }
    };

    // ── Department ──
    const handleCreateDept = async () => {
        if (!newDept.branchId || !newDept.name) { toast.error(t('Please select a branch and enter a department name.', 'الرجاء اختيار الفرع وإدخال اسم القسم.')); return; }
        setActionLoading(true);
        try {
            await createDepartment(newDept);
            setNewDept(prev => ({ ...prev, name: '' }));
            const all = await getDepartments().catch(() => []);
            setDepartments(Array.isArray(all) ? all : []);
            await loadDeptsByBranch(deptBranchFilter);
            toast.success(t('Department created!', 'تم إنشاء القسم!'));
        } catch (err) { toast.error(err instanceof Error ? err.message : t('Failed to create department', 'فشل إنشاء القسم')); }
        finally { setActionLoading(false); }
    };

    const handleDeleteDept = async (id: number) => {
        if (!confirm(t('Delete this department? This may affect users assigned to it.', 'هل تريد حذف هذا القسم؟ قد يؤثر ذلك على المستخدمين التابعين له.'))) return;
        try {
            await deleteDepartment(id);
            setDepartments(prev => prev.filter(d => d.id !== id));
            setDeptsList(prev => prev.filter(d => d.id !== id));
            toast.success(t('Department deleted.', 'تم حذف القسم.'));
        } catch (err) { toast.error(err instanceof Error ? err.message : t('Failed to delete department', 'فشل حذف القسم')); }
    };

    const handleUpdateDept = async () => {
        if (!editDept) return;
        if (!editDept.name.trim()) { toast.error(t('Department name is required.', 'اسم القسم مطلوب.')); return; }
        setActionLoading(true);
        try {
            await updateDepartment(editDept.id, { name: editDept.name, branchId: editDept.branchId || undefined });
            const all = await getDepartments().catch(() => []);
            setDepartments(Array.isArray(all) ? all : []);
            await loadDeptsByBranch(deptBranchFilter);
            setEditDept(null);
            toast.success(t('Department updated!', 'تم تحديث القسم!'));
        } catch (err) { toast.error(err instanceof Error ? err.message : t('Failed to update department', 'فشل تحديث القسم')); }
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
        } catch (err) { toast.error(err instanceof Error ? err.message : t('Failed to create role', 'فشل إنشاء الدور')); }
        finally { setActionLoading(false); }
    };

    const handleDeleteRole = async (id: number) => {
        if (!confirm(t('Delete this role?', 'هل تريد حذف هذا الدور؟'))) return;
        try {
            await deleteRole(id);
            setRoles(prev => prev.filter(r => r.id !== id));
            toast.success(t('Role deleted.', 'تم حذف الدور.'));
        } catch (err) { toast.error(err instanceof Error ? err.message : t('Failed to delete role', 'فشل حذف الدور')); }
    };

    const openViewUsers = async (role: Role) => {
        setViewUsersRole(role);
        setRoleUsersLoading(true);
        try {
            const users = await getRoleUsers(role.id);
            setRoleUsersList(Array.isArray(users) ? users : []);
        } catch { setRoleUsersList([]); }
        finally { setRoleUsersLoading(false); }
    };

    const openAssignUser = async (role: Role) => {
        setAssignUserRole(role);
        setAssignSearch('');
        try {
            const all = await getDepartmentUsers(undefined, undefined, { pageSize: 200 });
            setAllUsersForAssign(all);
        } catch { setAllUsersForAssign([]); }
    };

    const handleAssignUserToRole = async (u: DepartmentUser) => {
        if (!assignUserRole) return;
        setAssigningUserId(u.id);
        try {
            await updateDepartmentUser(u.id, { RoleId: assignUserRole.id }, null);
            toast.success(t(`${u.name} assigned to ${assignUserRole.name}`, `تم تعيين ${u.name} في ${assignUserRole.name}`));
            const all = await getDepartmentUsers(undefined, undefined, { pageSize: 200 });
            setAllUsersForAssign(all);
            setUsers(all);
        } catch (err) { toast.error(err instanceof Error ? err.message : t('Failed to assign user', 'فشل تعيين المستخدم')); }
        finally { setAssigningUserId(null); }
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
            toast.success(t('Permissions saved!', 'تم حفظ الصلاحيات!'));
        } catch (err) { toast.error(err instanceof Error ? err.message : t('Failed to save permissions', 'فشل حفظ الصلاحيات')); }
        finally { setActionLoading(false); }
    };

    const handleCreateUser = async () => {
        if (!userForm.Name || !userForm.Email || !userForm.Password || !userForm.Type) {
            toast.error(t('Name, email, password, and type are required.', 'الاسم والبريد الإلكتروني وكلمة المرور والنوع مطلوبة.'));
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
            toast.success(t('User created successfully!', 'تم إنشاء المستخدم بنجاح!'));
            setShowAddUserModal(false);
            loadUsers();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('Failed to create user', 'فشل إنشاء المستخدم'));
        } finally { setActionLoading(false); }
    };

    const handleDeleteUser = async (id: number, name: string) => {
        if (!confirm(`${t('Delete user', 'حذف المستخدم')} "${name}"?`)) return;
        try {
            await deleteDepartmentUser(id);
            setUsers(prev => prev.filter(u => u.id !== id));
            toast.success(t('User deleted.', 'تم حذف المستخدم.'));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('Failed to delete user', 'فشل حذف المستخدم'));
        }
    };

    const handleUpdateUser = async () => {
        if (!editUser) return;
        setActionLoading(true);
        try {
            await updateDepartmentUser(
                editUser.id,
                { Name: editUser.name, Email: editUser.email, Phone: editUser.phone, BranchId: editUser.branchId || undefined, DepartmentId: editUser.departmentId || undefined, RoleId: editUser.roleId || undefined, Password: editUser.password || undefined, IsActive: editUser.isActive },
                editUserImage,
            );
            setEditUser(null);
            setEditUserImage(null);
            loadUsers();
            toast.success(t('User updated successfully!', 'تم تحديث المستخدم بنجاح!'));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('Failed to update user', 'فشل تحديث المستخدم'));
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
        <PermissionGuard requiredPerms={[PERMS.ROLES_MANAGE, PERMS.SETTINGS_MANAGE]}>
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
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                <div className="card-title">{t('Branches', 'الفروع')}</div>
                                <button className="btn btn-primary btn-sm" onClick={() => { setNewBranch({ name: '', email: '', phone: '' }); setShowAddBranchModal(true); }}>+ {t('Add Branch', 'إضافة فرع')}</button>
                            </div>
                            {branches.slice((branchesPage - 1) * branchesPageSize, branchesPage * branchesPageSize).map(b => (
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
                                            {(isSuper || hasPermission(PERMS.BRANCH_EDIT)) && (
                                                <div className="btn-group">
                                                    <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => setEditBranch({ id: b.id, name: b.name, email: b.email || '', phone: b.phone || '' })}>✏️ {t('Edit', 'تعديل')}</button>
                                                    <button className="btn btn-danger btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => handleDeleteBranch(b.id)}>🗑️ {t('Delete', 'حذف')}</button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {branches.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('No branches yet.', 'لا توجد فروع بعد.')}</p>}
                            {branches.length > 0 && (
                                <Pagination
                                    currentPage={branchesPage}
                                    totalItems={branches.length}
                                    pageSize={branchesPageSize}
                                    onPageChange={setBranchesPage}
                                    onPageSizeChange={setBranchesPageSize}
                                />
                            )}
                        </div>
                    )}

                    {/* ══════════════ DEPARTMENTS ══════════════ */}
                    {activeTab === 'departments' && (
                        <div className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <div className="card-title">{t('Departments', 'الأقسام')}</div>
                                <button className="btn btn-primary btn-sm" onClick={() => {
                                    setNewDept({ branchId: 0, name: '', salesSupervisiorId: 0, installationSupervisiorId: 0 });
                                    setSalesSupSearch(''); setSalesSupResults([]); setSalesSupLoading(false);
                                    setInstSupSearch(''); setInstSupResults([]); setInstSupLoading(false);
                                    setShowAddDeptModal(true);
                                }}>+ {t('Add Department', 'إضافة قسم')}</button>
                            </div>
                            {/* Filter by branch */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <select className="form-select" value={deptBranchFilter} onChange={e => { const v = Number(e.target.value); setDeptBranchFilter(v); loadDeptsByBranch(v); }} style={{ maxWidth: 220 }}>
                                    <option value={0}>{t('All Branches', 'جميع الفروع')}</option>
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                                {deptBranchFilter !== 0 && (
                                    <button className="btn btn-secondary btn-sm" onClick={() => { setDeptBranchFilter(0); loadDeptsByBranch(0); }}>✕ {t('Clear', 'مسح')}</button>
                                )}
                                <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                                    {deptsList.length} {t('departments', 'قسم')}
                                </span>
                            </div>
                            {deptsList.slice((deptsPage - 1) * deptsPageSize, deptsPage * deptsPageSize).map(d => (
                                <div key={d.id} style={{ padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', marginBottom: 8 }}>
                                    {editDept?.id === d.id ? (
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                            <input className="form-input" value={editDept.name} onChange={e => setEditDept({ ...editDept, name: e.target.value })} placeholder={t('Department name', 'اسم القسم')} style={{ flex: 1, minWidth: 140 }} />
                                            <select className="form-select" value={editDept.branchId} onChange={e => setEditDept({ ...editDept, branchId: Number(e.target.value) })} style={{ minWidth: 140 }}>
                                                <option value={0}>— {t('Branch', 'الفرع')} —</option>
                                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                            </select>
                                            <button className="btn btn-primary btn-sm" disabled={actionLoading} onClick={handleUpdateDept}>💾</button>
                                            <button className="btn btn-secondary btn-sm" onClick={() => setEditDept(null)}>✕</button>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{d.name}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('Branch', 'الفرع')}: {d.branchName || (d.branchId ? (branches.find(b => b.id === d.branchId)?.name || `#${d.branchId}`) : '—')}</div>
                                            </div>
                                            {(isSuper || hasPermission(PERMS.DEPT_EDIT)) && (
                                                <div className="btn-group">
                                                    <button className="btn btn-secondary btn-sm" onClick={() => {
                                                        const matchedBranchId = d.branchId || branches.find(b => b.name === d.branchName)?.id || 0;
                                                        setEditDept({ id: d.id, name: d.name, branchId: matchedBranchId });
                                                    }} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>✏️ {t('Edit', 'تعديل')}</button>
                                                    <button className="btn btn-danger btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => handleDeleteDept(d.id)}>🗑️ {t('Delete', 'حذف')}</button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                            {deptsList.length === 0 && (
                                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('No departments found.', 'لا توجد أقسام.')}</p>
                            )}
                            {deptsList.length > 0 && (
                                <Pagination
                                    currentPage={deptsPage}
                                    totalItems={deptsList.length}
                                    pageSize={deptsPageSize}
                                    onPageChange={setDeptsPage}
                                    onPageSizeChange={setDeptsPageSize}
                                />
                            )}
                        </div>
                    )}

                    {/* ══════════════ USERS ══════════════ */}
                    {activeTab === 'users' && (
                        <div>
                            {/* ── Add User Button ── */}
                            <div style={{ marginBottom: 16 }}>
                                <button className="btn btn-primary" onClick={() => setShowAddUserModal(true)}>
                                    ➕ {t('Add User', 'إضافة مستخدم')}
                                </button>
                            </div>

                            {/* ── Users List ── */}
                            <div className="card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                                    <div className="card-title">{t('All Users', 'جميع المستخدمين')}</div>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                        <select
                                            className="form-select"
                                            style={{ fontSize: 13, padding: '4px 10px', minWidth: 150 }}
                                            value={userBranchFilter}
                                            onChange={async e => {
                                                const bid = Number(e.target.value);
                                                setUserBranchFilter(bid);
                                                setUserDeptFilter(0);
                                                if (bid) {
                                                    const d = await getDepartments(bid).catch(() => []);
                                                    setUserFilterDepts(Array.isArray(d) ? d : []);
                                                } else {
                                                    setUserFilterDepts([]);
                                                }
                                            }}
                                        >
                                            <option value={0}>{t('All Branches', 'كل الفروع')}</option>
                                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                        <select
                                            className="form-select"
                                            style={{ fontSize: 13, padding: '4px 10px', minWidth: 160 }}
                                            value={userDeptFilter}
                                            disabled={!userBranchFilter}
                                            onChange={e => setUserDeptFilter(Number(e.target.value))}
                                        >
                                            <option value={0}>{t('All Departments', 'كل الأقسام')}</option>
                                            {(userBranchFilter ? userFilterDepts : departments).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                        <select
                                            className="form-select"
                                            style={{ fontSize: 13, padding: '4px 10px', minWidth: 130 }}
                                            value={userActiveFilter}
                                            onChange={e => setUserActiveFilter(e.target.value as 'all' | 'active' | 'inactive')}
                                        >
                                            <option value="all">{t('All Status', 'كل الحالات')}</option>
                                            <option value="active">{t('Active', 'نشط')}</option>
                                            <option value="inactive">{t('Inactive', 'غير نشط')}</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                    <div className="table-search" style={{ flex: 1 }}>
                                        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>🔍</span>
                                        <input
                                            placeholder={t('Search by name, email, phone...', 'ابحث بالاسم أو البريد أو الهاتف...')}
                                            value={userSearch}
                                            onChange={e => setUserSearch(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    setAppliedBranchFilter(userBranchFilter);
                                                    setAppliedDeptFilter(userDeptFilter);
                                                    setAppliedActiveFilter(userActiveFilter);
                                                    setUsersPage(1);
                                                    loadUsers(userBranchFilter || undefined, userDeptFilter || undefined, userSearch);
                                                }
                                            }}
                                        />
                                    </div>
                                    <button className="btn btn-primary btn-sm" disabled={usersLoading} onClick={() => {
                                        setAppliedBranchFilter(userBranchFilter);
                                        setAppliedDeptFilter(userDeptFilter);
                                        setAppliedActiveFilter(userActiveFilter);
                                        setUsersPage(1);
                                        loadUsers(userBranchFilter || undefined, userDeptFilter || undefined, userSearch);
                                    }}>
                                        {usersLoading ? '⏳' : t('Apply', 'تطبيق')}
                                    </button>
                                    {userSearch && (
                                        <button className="btn btn-secondary btn-sm" onClick={() => { setUserSearch(''); setUsersPage(1); loadUsers(userBranchFilter || undefined, userDeptFilter || undefined, undefined); }}>{t('Clear', 'مسح')}</button>
                                    )}
                                </div>
                                <div className="table-container" style={{ border: 'none', borderRadius: 0 }}>
                                    <table style={{ tableLayout: 'auto' }}>
                                        <thead><tr>
                                            <th>{t('Name', 'الاسم')}</th>
                                            <th>{t('Email', 'البريد')}</th>
                                            <th>{t('Phone', 'الهاتف')}</th>
                                            <th>{t('Department', 'القسم')}</th>
                                            <th>{t('Role', 'الدور')}</th>
                                            <th>{t('Status', 'الحالة')}</th>
                                            <th style={{ whiteSpace: 'nowrap', width: 1 }}>{t('Actions', 'الإجراءات')}</th>
                                        </tr></thead>
                                        <tbody>
                                            {usersLoading ? (
                                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>⏳ {t('Loading...', 'جارٍ التحميل...')}</td></tr>
                                            ) : users.length === 0 ? (
                                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', whiteSpace: 'normal' }}>{t('Click a filter above to load users', 'انقر على فلتر أعلاه لتحميل المستخدمين')}</td></tr>
                                            ) : (
                                                users.filter(u => {
                                                    const matchesActive = appliedActiveFilter === 'all' || (appliedActiveFilter === 'active' ? u.isActive !== false : u.isActive === false);
                                                    return matchesActive;
                                                }).slice((usersPage - 1) * usersPageSize, usersPage * usersPageSize).map(u => (
                                                    <tr key={u.id}>
                                                        <td className="table-cell-main" title={u.name}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                {u.image ? (
                                                                    <img src={u.image.startsWith('http') ? u.image : `${API_BASE}/${u.image.replace(/^\//, '')}`} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                                ) : (
                                                                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>👤</div>
                                                                )}
                                                                {u.name}
                                                            </div>
                                                        </td>
                                                        <td style={{ color: 'var(--text-muted)' }} title={u.email}>{u.email}</td>
                                                        <td style={{ color: 'var(--text-muted)' }}>{u.phone || '—'}</td>
                                                        <td title={u.departmentName || ''}>{u.departmentName || `#${u.departmentId}`}</td>
                                                        <td>
                                                            {roles.find(r => r.id === u.roleId)?.name || u.roleName || u.role
                                                                ? <span style={{ fontWeight: 600, color: 'var(--accent-primary-hover)' }}>{roles.find(r => r.id === u.roleId)?.name || u.roleName || u.role}</span>
                                                                : <span style={{ color: 'var(--text-muted)' }}>—</span>
                                                            }
                                                        </td>
                                                        <td>
                                                            {u.isActive === undefined ? (
                                                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                                                            ) : u.isActive ? (
                                                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(34,197,94,0.15)', color: '#16a34a', fontWeight: 700, whiteSpace: 'nowrap' }}>{t('Active', 'نشط')}</span>
                                                            ) : (
                                                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'rgba(239,68,68,0.15)', color: '#dc2626', fontWeight: 700, whiteSpace: 'nowrap' }}>{t('Inactive', 'غير نشط')}</span>
                                                            )}
                                                        </td>
                                                        <td style={{ whiteSpace: 'nowrap' }}>
                                                            <div className="btn-group">
                                                                <button className="btn btn-secondary btn-sm" onClick={() => {
                                                                    const resolvedRoleId = u.roleId || roles.find(r => r.name === (u.roleName || u.role))?.id || 0;
                                                                    const resolvedDeptId = u.departmentId || departments.find(d => d.name === u.departmentName)?.id || 0;
                                                                    const resolvedBranchId = u.branchId || branches.find(b => b.name === u.branchName)?.id || 0;
                                                                    setEditUser({ id: u.id, name: u.name, email: u.email, phone: u.phone || '', branchId: resolvedBranchId, departmentId: resolvedDeptId, roleId: resolvedRoleId, isActive: u.isActive !== false, currentImageUrl: u.image, password: '' });
                                                                    setEditUserDepts(resolvedBranchId ? departments.filter(d => d.branchId === resolvedBranchId) : departments);
                                                                    setEditUserImage(null);
                                                                    setEditUserShowPassword(false);
                                                                }} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>✏️ {t('Edit', 'تعديل')}</button>
                                                                <button className="btn btn-danger btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => handleDeleteUser(u.id, u.name)}>🗑️ {t('Delete', 'حذف')}</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {users.length > 0 && (
                                    <Pagination
                                        currentPage={usersPage}
                                        totalItems={users.filter(u => { const matchesActive = appliedActiveFilter === 'all' || (appliedActiveFilter === 'active' ? u.isActive !== false : u.isActive === false); return matchesActive; }).length}
                                        pageSize={usersPageSize}
                                        onPageChange={setUsersPage}
                                        onPageSizeChange={setUsersPageSize}
                                    />
                                )}
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
                            {roles.slice((rolesPage - 1) * rolesPageSize, rolesPage * rolesPageSize).map(role => (
                                <div key={role.id} style={{ padding: '12px 16px', background: selectedRoleId === role.id ? 'rgba(99,102,241,0.08)' : 'var(--bg-tertiary)', border: selectedRoleId === role.id ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent', borderRadius: 'var(--radius-md)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => handleSelectRole(role.id)}>
                                    <div style={{ fontWeight: 600, fontSize: 15 }}>{role.name}</div>
                                    <div className="btn-group">
                                        <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={e => { e.stopPropagation(); openViewUsers(role); }}>👥 {t('Users', 'المستخدمون')}</button>
                                        <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={e => { e.stopPropagation(); openAssignUser(role); }}>➕ {t('Assign', 'تعيين')}</button>
                                        <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={e => { e.stopPropagation(); handleSelectRole(role.id); setPermSearch(''); setShowPermModal(true); }}>🛡️ {t('Permissions', 'الصلاحيات')}</button>
                                        <button className="btn btn-danger btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={e => { e.stopPropagation(); handleDeleteRole(role.id); }}>🗑️ {t('Delete', 'حذف')}</button>
                                    </div>
                                </div>
                            ))}
                            {roles.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{t('No roles yet.', 'لا توجد أدوار بعد.')}</p>}
                            {roles.length > 0 && (
                                <Pagination
                                    currentPage={rolesPage}
                                    totalItems={roles.length}
                                    pageSize={rolesPageSize}
                                    onPageChange={setRolesPage}
                                    onPageSizeChange={setRolesPageSize}
                                />
                            )}
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
                                                                <div style={{ fontWeight: checked ? 600 : 400 }}>{shortName}</div>
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
                                    <label className="form-label">{t('Branch', 'الفرع')}</label>
                                    <select className="form-select" value={editUser.branchId} onChange={async e => {
                                        const bid = Number(e.target.value);
                                        setEditUser({ ...editUser, branchId: bid, departmentId: 0 });
                                        if (bid) {
                                            const d = await getDepartments(bid).catch(() => [] as Department[]);
                                            setEditUserDepts(Array.isArray(d) ? d : []);
                                        } else {
                                            setEditUserDepts(departments);
                                        }
                                    }}>
                                        <option value={0}>— {t('Select', 'اختر')} —</option>
                                        {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Department', 'القسم')}</label>
                                <select className="form-select" value={editUser.departmentId} onChange={e => setEditUser({ ...editUser, departmentId: Number(e.target.value) })}>
                                    <option value={0}>— {t('Select', 'اختر')} —</option>
                                    {(editUserDepts.length > 0 ? editUserDepts : departments).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">{t('Role', 'الدور')}</label>
                                    <select className="form-select" value={editUser.roleId} onChange={e => setEditUser({ ...editUser, roleId: Number(e.target.value) })}>
                                        <option value={0}>— {t('Select Role', 'اختر الدور')} —</option>
                                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('Status', 'الحالة')}</label>
                                    <select className="form-select" value={editUser.isActive ? 'active' : 'inactive'} onChange={e => setEditUser({ ...editUser, isActive: e.target.value === 'active' })}>
                                        <option value="active">{t('Active', 'نشط')}</option>
                                        <option value="inactive">{t('Inactive', 'غير نشط')}</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Profile Image', 'الصورة الشخصية')}</label>
                                {editUser?.currentImageUrl && !editUserImage && (
                                    <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <img src={editUser.currentImageUrl.startsWith('http') ? editUser.currentImageUrl : `${API_BASE}/${editUser.currentImageUrl.replace(/^\//, '')}`} alt="profile" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('Current image — choose a new file to replace', 'الصورة الحالية — اختر ملفاً جديداً للاستبدال')}</span>
                                    </div>
                                )}
                                <input className="form-input" type="file" accept="image/*" onChange={e => setEditUserImage(e.target.files?.[0] ?? null)} />
                                {editUserImage && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>📎 {editUserImage.name}</div>}
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('New Password', 'كلمة مرور جديدة')} <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>({t('leave blank to keep current', 'اتركه فارغاً للإبقاء على الحالية')})</span></label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        className="form-input"
                                        type={editUserShowPassword ? 'text' : 'password'}
                                        placeholder={t('Enter new password...', 'أدخل كلمة المرور الجديدة...')}
                                        value={editUser?.password || ''}
                                        onChange={e => editUser && setEditUser({ ...editUser, password: e.target.value })}
                                        style={{ paddingRight: 40 }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setEditUserShowPassword(p => !p)}
                                        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)' }}
                                    >{editUserShowPassword ? '🙈' : '👁️'}</button>
                                </div>
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

            {/* ══════════ VIEW USERS IN ROLE MODAL ══════════ */}
            {viewUsersRole && (
                <div className="modal-overlay" onClick={() => setViewUsersRole(null)}>
                    <div className="modal" style={{ maxWidth: 620 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 style={{ fontSize: 17 }}>👥 {t('Users in', 'المستخدمون في')} — {viewUsersRole.name}</h2>
                            <button className="modal-close" onClick={() => setViewUsersRole(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            {roleUsersLoading ? (
                                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>⏳ {t('Loading...', 'جارٍ التحميل...')}</div>
                            ) : roleUsersList.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{t('No users in this role.', 'لا يوجد مستخدمون في هذا الدور.')}</div>
                            ) : (
                                <div className="table-container" style={{ border: 'none', maxHeight: 420, overflowY: 'auto' }}>
                                    <table>
                                        <thead><tr>
                                            <th>{t('Name', 'الاسم')}</th>
                                            <th>{t('Email', 'البريد')}</th>
                                            <th>{t('Department', 'القسم')}</th>
                                            <th style={{ width: 80 }}>{t('Actions', 'الإجراءات')}</th>
                                        </tr></thead>
                                        <tbody>
                                            {roleUsersList.map(u => (
                                                <tr key={u.id}>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                                                                {u.image ? <img src={u.image} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (u.name?.charAt(0) || '👤')}
                                                            </div>
                                                            <span style={{ fontWeight: 600 }}>{u.name}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{u.email}</td>
                                                    <td style={{ fontSize: 13 }}>{u.departmentName || '—'}</td>
                                                    <td>
                                                        <button className="btn btn-secondary btn-sm" title={t('Edit', 'تعديل')} onClick={() => {
                                                            setViewUsersRole(null);
                                                            const resolvedRoleId = u.roleId || viewUsersRole?.id || 0;
                                                            const resolvedDeptId = u.departmentId || departments.find(d => d.name === u.departmentName)?.id || 0;
                                                            const resolvedBranchId = u.branchId || branches.find(b => b.name === u.branchName)?.id || 0;
                                                            setEditUser({ id: u.id, name: u.name, email: u.email, phone: u.phone || '', branchId: resolvedBranchId, departmentId: resolvedDeptId, roleId: resolvedRoleId, isActive: u.isActive !== false, currentImageUrl: u.image, password: '' });
                                                            setEditUserDepts(resolvedBranchId ? departments.filter(d => d.branchId === resolvedBranchId) : departments);
                                                            setEditUserImage(null);
                                                            setEditUserShowPassword(false);
                                                        }}>✏️</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
                                <button className="btn btn-secondary" onClick={() => setViewUsersRole(null)}>{t('Close', 'إغلاق')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════ ASSIGN USER TO ROLE MODAL ══════════ */}
            {assignUserRole && (
                <div className="modal-overlay" onClick={() => setAssignUserRole(null)}>
                    <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 style={{ fontSize: 17 }}>➕ {t('Assign User to', 'تعيين مستخدم في')} — {assignUserRole.name}</h2>
                            <button className="modal-close" onClick={() => setAssignUserRole(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                <div className="table-search" style={{ flex: 1, marginBottom: 0 }}>
                                    <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>🔍</span>
                                    <input
                                        placeholder={t('Search by name, email, phone...', 'ابحث بالاسم أو البريد أو الهاتف...')}
                                        value={assignSearch}
                                        onChange={e => setAssignSearch(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { setAssignSearchLoading(true); getDepartmentUsers(undefined, undefined, { username: assignSearch || undefined, pageSize: 200 }).then(setAllUsersForAssign).catch(() => setAllUsersForAssign([])).finally(() => setAssignSearchLoading(false)); } }}
                                        autoFocus
                                    />
                                </div>
                                <button className="btn btn-primary btn-sm" disabled={assignSearchLoading} onClick={() => { setAssignSearchLoading(true); getDepartmentUsers(undefined, undefined, { username: assignSearch || undefined, pageSize: 200 }).then(setAllUsersForAssign).catch(() => setAllUsersForAssign([])).finally(() => setAssignSearchLoading(false)); }}>{assignSearchLoading ? '⏳' : t('Apply', 'تطبيق')}</button>
                                {assignSearch && (
                                    <button className="btn btn-secondary btn-sm" onClick={() => { setAssignSearch(''); setAssignSearchLoading(true); getDepartmentUsers(undefined, undefined, { pageSize: 200 }).then(setAllUsersForAssign).catch(() => setAllUsersForAssign([])).finally(() => setAssignSearchLoading(false)); }}>{t('Clear', 'مسح')}</button>
                                )}
                            </div>
                            <div className="table-container" style={{ border: 'none', maxHeight: 420, overflowY: 'auto' }}>
                                <table>
                                    <thead><tr>
                                        <th>{t('Name', 'الاسم')}</th>
                                        <th>{t('Email', 'البريد')}</th>
                                        <th>{t('Current Role', 'الدور الحالي')}</th>
                                        <th style={{ width: 100 }}>{t('Action', 'الإجراء')}</th>
                                    </tr></thead>
                                    <tbody>
                                        {assignSearchLoading ? (
                                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>⏳ {t('Searching...', 'جارٍ البحث...')}</td></tr>
                                        ) : allUsersForAssign.length === 0 ? (
                                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>{t('No users found', 'لا يوجد مستخدمون')}</td></tr>
                                        ) : allUsersForAssign.map(u => {
                                            const alreadyInRole = u.roleId === assignUserRole.id || u.roleName === assignUserRole.name;
                                            const displayRole = u.roleName || roles.find(r => r.id === u.roleId)?.name;
                                            return (
                                                <tr key={u.id}>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0 }}>
                                                                {u.image ? <img src={u.image} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : (u.name?.charAt(0) || '👤')}
                                                            </div>
                                                            <span style={{ fontWeight: 600 }}>{u.name}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{u.email}</td>
                                                    <td style={{ fontSize: 13 }}>{displayRole || '—'}</td>
                                                    <td>
                                                        {alreadyInRole ? (
                                                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>✓ {t('In role', 'في الدور')}</span>
                                                        ) : (
                                                            <button className="btn btn-primary btn-sm" disabled={assigningUserId === u.id} onClick={() => handleAssignUserToRole(u)}>
                                                                {assigningUserId === u.id ? '⏳' : `+ ${t('Assign', 'تعيين')}`}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
                                <button className="btn btn-secondary" onClick={() => setAssignUserRole(null)}>{t('Close', 'إغلاق')}</button>
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
                                                    <div style={{ fontWeight: checked ? 600 : 400 }}>{shortName}</div>
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
            {/* ══════════ ADD USER MODAL ══════════ */}
            {showAddUserModal && (
                <div className="modal-overlay" onClick={() => setShowAddUserModal(false)}>
                    <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>👤 {t('Add New User', 'إضافة مستخدم جديد')}</h2>
                            <button className="modal-close" onClick={() => setShowAddUserModal(false)}>×</button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">{t('Name', 'الاسم')} *</label>
                                    <input className="form-input" placeholder={t('Enter name', 'أدخل الاسم')} value={userForm.Name} onChange={e => setUserForm({ ...userForm, Name: e.target.value })} autoFocus />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('Email', 'البريد')} *</label>
                                    <input className="form-input" type="email" placeholder={t('Enter email', 'أدخل البريد')} value={userForm.Email} onChange={e => setUserForm({ ...userForm, Email: e.target.value })} />
                                </div>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">{t('Phone', 'الهاتف')}</label>
                                    <input className="form-input" placeholder={t('Enter phone', 'أدخل الهاتف')} value={userForm.Phone} onChange={e => setUserForm({ ...userForm, Phone: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{t('Password', 'كلمة المرور')} *</label>
                                    <input className="form-input" type="password" placeholder={t('Enter password', 'أدخل كلمة المرور')} value={userForm.Password} onChange={e => setUserForm({ ...userForm, Password: e.target.value })} />
                                </div>
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
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowAddUserModal(false)}>{t('Cancel', 'إلغاء')}</button>
                            <button className="btn btn-primary" disabled={actionLoading || !userForm.Name || !userForm.Email || !userForm.Password || !userForm.Type} onClick={async () => { await handleCreateUser(); if (!actionLoading) setShowAddUserModal(false); }}>
                                {actionLoading ? `⏳ ${t('Creating...', 'إنشاء...')}` : `✅ ${t('Create User', 'إنشاء مستخدم')}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════ ADD BRANCH MODAL ══════════ */}
            {showAddBranchModal && (
                <div className="modal-overlay" onClick={() => setShowAddBranchModal(false)}>
                    <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>🏢 {t('Add Branch', 'إضافة فرع')}</h2>
                            <button className="modal-close" onClick={() => setShowAddBranchModal(false)}>×</button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div className="form-group">
                                <label className="form-label">{t('Branch Name', 'اسم الفرع')} *</label>
                                <input className="form-input" placeholder={t('Enter branch name', 'أدخل اسم الفرع')} value={newBranch.name} onChange={e => setNewBranch({ ...newBranch, name: e.target.value })} autoFocus />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Email', 'البريد')}</label>
                                <input className="form-input" type="email" placeholder={t('Enter email', 'أدخل البريد')} value={newBranch.email} onChange={e => setNewBranch({ ...newBranch, email: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Phone', 'الهاتف')}</label>
                                <input className="form-input" placeholder={t('Enter phone', 'أدخل الهاتف')} value={newBranch.phone} onChange={e => setNewBranch({ ...newBranch, phone: e.target.value })} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowAddBranchModal(false)}>{t('Cancel', 'إلغاء')}</button>
                            <button className="btn btn-primary" disabled={actionLoading} onClick={async () => { await handleCreateBranch(); if (!actionLoading) setShowAddBranchModal(false); }}>
                                {actionLoading ? `⏳ ${t('Saving...', 'جارٍ الحفظ...')}` : `+ ${t('Add Branch', 'إضافة فرع')}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════ ADD DEPARTMENT MODAL ══════════ */}
            {showAddDeptModal && (
                <div className="modal-overlay" onClick={() => setShowAddDeptModal(false)}>
                    <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>🏗️ {t('Add Department', 'إضافة قسم')}</h2>
                            <button className="modal-close" onClick={() => setShowAddDeptModal(false)}>×</button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div className="form-group">
                                <label className="form-label">{t('Branch', 'الفرع')} *</label>
                                <select className="form-select" value={newDept.branchId} onChange={e => setNewDept({ ...newDept, branchId: Number(e.target.value) })}>
                                    <option value={0}>— {t('Select Branch', 'اختر الفرع')} —</option>
                                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Department Name', 'اسم القسم')} *</label>
                                <input className="form-input" placeholder={t('Enter department name', 'أدخل اسم القسم')} value={newDept.name} onChange={e => setNewDept({ ...newDept, name: e.target.value })} autoFocus />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Sales Supervisor', 'مشرف المبيعات')}</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        className="form-input"
                                        style={{ flex: 1 }}
                                        placeholder={t('Search by name...', 'ابحث بالاسم...')}
                                        value={salesSupSearch}
                                        onChange={e => setSalesSupSearch(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { setSalesSupLoading(true); getDepartmentUsers(undefined, undefined, { username: salesSupSearch || undefined }).then(setSalesSupResults).catch(() => setSalesSupResults([])).finally(() => setSalesSupLoading(false)); } }}
                                    />
                                    <button type="button" className="btn btn-secondary btn-sm" disabled={salesSupLoading} style={{ whiteSpace: 'nowrap' }} onClick={() => { setSalesSupLoading(true); getDepartmentUsers(undefined, undefined, { username: salesSupSearch || undefined }).then(setSalesSupResults).catch(() => setSalesSupResults([])).finally(() => setSalesSupLoading(false)); }}>
                                        {salesSupLoading ? '⏳' : t('Apply', 'تطبيق')}
                                    </button>
                                </div>
                                {salesSupResults.length > 0 && (
                                    <select className="form-select" style={{ marginTop: 6 }} value={newDept.salesSupervisiorId} onChange={e => setNewDept({ ...newDept, salesSupervisiorId: Number(e.target.value) })}>
                                        <option value={0}>— {t('Select', 'اختر')} —</option>
                                        {salesSupResults.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                )}
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('Installation Supervisor', 'مشرف التركيبات')}</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        className="form-input"
                                        style={{ flex: 1 }}
                                        placeholder={t('Search by name...', 'ابحث بالاسم...')}
                                        value={instSupSearch}
                                        onChange={e => setInstSupSearch(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { setInstSupLoading(true); getDepartmentUsers(undefined, undefined, { username: instSupSearch || undefined }).then(setInstSupResults).catch(() => setInstSupResults([])).finally(() => setInstSupLoading(false)); } }}
                                    />
                                    <button type="button" className="btn btn-secondary btn-sm" disabled={instSupLoading} style={{ whiteSpace: 'nowrap' }} onClick={() => { setInstSupLoading(true); getDepartmentUsers(undefined, undefined, { username: instSupSearch || undefined }).then(setInstSupResults).catch(() => setInstSupResults([])).finally(() => setInstSupLoading(false)); }}>
                                        {instSupLoading ? '⏳' : t('Apply', 'تطبيق')}
                                    </button>
                                </div>
                                {instSupResults.length > 0 && (
                                    <select className="form-select" style={{ marginTop: 6 }} value={newDept.installationSupervisiorId} onChange={e => setNewDept({ ...newDept, installationSupervisiorId: Number(e.target.value) })}>
                                        <option value={0}>— {t('Select', 'اختر')} —</option>
                                        {instSupResults.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowAddDeptModal(false)}>{t('Cancel', 'إلغاء')}</button>
                            <button className="btn btn-primary" disabled={actionLoading} onClick={async () => { await handleCreateDept(); if (!actionLoading) setShowAddDeptModal(false); }}>
                                {actionLoading ? `⏳ ${t('Saving...', 'جارٍ الحفظ...')}` : `+ ${t('Add Department', 'إضافة قسم')}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </PermissionGuard>
    );
}
