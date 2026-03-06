'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    getRoles, createRole, deleteRole,
    getPermissions, getRolePermissions, updateRolePermissions,
    getDepartmentUsers, createDepartmentUser, deleteDepartmentUser,
    getDepartments, getBranches,
} from '@/lib/endpoints';
import { Role, Permission, DepartmentUser, Department, Branch } from '@/types';

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

type ModalType = 'addRole' | 'addUser' | 'permissions' | 'viewUsers' | null;

/* ════════════════════════════════════════════════════════
   PAGE
════════════════════════════════════════════════════════ */
export default function AdminUsersPage() {
    /* data */
    const [roles, setRoles] = useState<Role[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [roleUserCounts, setRoleUserCounts] = useState<Record<number, number>>({});
    const [departments, setDepartments] = useState<Department[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);

    /* modal state */
    const [modal, setModal] = useState<ModalType>(null);
    const [activeRole, setActiveRole] = useState<Role | null>(null);
    const [rolePerms, setRolePerms] = useState<number[]>([]);
    const [roleUsers, setRoleUsers] = useState<DepartmentUser[]>([]);

    /* forms */
    const [newRoleName, setNewRoleName] = useState('');
    const [userForm, setUserForm] = useState<NewUserForm>({ Name: '', Email: '', Phone: '', Password: '', DepartmentId: 0, RoleId: 0, IsSuperAdmin: false });
    const [searchQ, setSearchQ] = useState('');

    /* ui */
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [permSearch, setPermSearch] = useState('');

    /* ── load all data ── */
    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            const [r, p, d, b, allUsers] = await Promise.all([
                getRoles().catch(() => []),
                getPermissions().catch(() => []),
                getDepartments().catch(() => []),
                getBranches().catch(() => []),
                getDepartmentUsers().catch(() => []),
            ]);
            setRoles(Array.isArray(r) ? r : []);
            setPermissions(Array.isArray(p) ? p : []);
            setDepartments(Array.isArray(d) ? d : []);
            setBranches(Array.isArray(b) ? b : []);

            /* count users per role */
            const counts: Record<number, number> = {};
            (Array.isArray(allUsers) ? allUsers : []).forEach((u: DepartmentUser) => {
                counts[u.roleId] = (counts[u.roleId] || 0) + 1;
            });
            setRoleUserCounts(counts);
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
        } catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
        finally { setActionLoading(false); }
    };

    const handleDeleteRole = async (id: number, name: string) => {
        if (!confirm(`Delete role "${name}"? Users assigned to it will lose access.`)) return;
        try {
            await deleteRole(id);
            await loadAll();
        } catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
    };

    /* ── permission actions ── */
    const openPerms = async (role: Role) => {
        setActiveRole(role);
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
            await updateRolePermissions(activeRole.id, rolePerms);
            setModal(null);
        } catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
        finally { setActionLoading(false); }
    };

    /* ── view users in role ── */
    const openRoleUsers = async (role: Role) => {
        setActiveRole(role);
        setModal('viewUsers');
        try {
            const users = await getDepartmentUsers();
            const filtered = (Array.isArray(users) ? users : []).filter((u: DepartmentUser) => u.roleId === role.id);
            setRoleUsers(filtered);
        } catch { setRoleUsers([]); }
    };

    /* ── create user ── */
    const handleCreateUser = async () => {
        if (!userForm.Name || !userForm.Email || !userForm.Password) {
            alert('Name, email, and password are required.'); return;
        }
        setActionLoading(true);
        try {
            const fd = new FormData();
            Object.entries(userForm).forEach(([k, v]) => fd.append(k, String(v)));
            await createDepartmentUser(fd);
            setModal(null);
            setUserForm({ Name: '', Email: '', Phone: '', Password: '', DepartmentId: 0, RoleId: 0, IsSuperAdmin: false });
            await loadAll();
        } catch (err) { alert(err instanceof Error ? err.message : 'Failed to create user'); }
        finally { setActionLoading(false); }
    };

    const handleDeleteUser = async (id: number, name: string) => {
        if (!confirm(`Are you sure you want to delete user "${name}"?`)) return;
        try {
            await deleteDepartmentUser(id);
            setRoleUsers(prev => prev.filter(u => u.id !== id));
            await loadAll();
        } catch (err) { alert(err instanceof Error ? err.message : 'Failed to delete user'); }
    };

    /* ── filter ── */
    const filteredRoles = roles.filter(r => r.name.toLowerCase().includes(searchQ.toLowerCase()));
    const filteredPerms = permissions.filter(p => p.name.toLowerCase().includes(permSearch.toLowerCase()));

    /* ════════════════════════════════════════════
       RENDER
    ════════════════════════════════════════════ */
    return (
        <div className="animate-in">
            {/* ── Page Header ── */}
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1>🔑 Roles &amp; Users</h1>
                    <p>Manage roles, assign permissions, and create users</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={() => setModal('addRole')}>
                        + Add Role
                    </button>
                    <button className="btn btn-primary" onClick={() => setModal('addUser')}>
                        + Add User
                    </button>
                </div>
            </div>

            {/* ── Stats row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 12, marginBottom: 24 }}>
                <StatPill icon="🔑" label="Total Roles" value={roles.length} color="#6366f1" />
                <StatPill icon="🛡️" label="Permissions" value={permissions.length} color="#8b5cf6" />
                <StatPill icon="👥" label="Total Users" value={Object.values(roleUserCounts).reduce((a, b) => a + b, 0)} color="#10b981" />
            </div>

            {/* ── Search ── */}
            <div className="table-toolbar" style={{ marginBottom: 12 }}>
                <div className="table-search">
                    <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>🔍</span>
                    <input
                        placeholder="Search roles..."
                        value={searchQ}
                        onChange={e => setSearchQ(e.target.value)}
                    />
                </div>
            </div>

            {/* ── Roles Table ── */}
            <div className="table-container">
                <table>
                    <thead>
                        <tr>
                            <th style={{ width: 40 }}>#</th>
                            <th>Role Name</th>
                            <th>Permissions</th>
                            <th>Users</th>
                            <th style={{ width: 140 }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Loading...</td>
                            </tr>
                        ) : filteredRoles.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ textAlign: 'center', padding: 48 }}>
                                    <div style={{ fontSize: 32, marginBottom: 8 }}>🎭</div>
                                    <div style={{ fontWeight: 600 }}>No roles found</div>
                                </td>
                            </tr>
                        ) : (
                            filteredRoles.map((role, idx) => (
                                <tr key={role.id}>
                                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{idx + 1}</td>
                                    <td>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>{role.name}</div>
                                    </td>
                                    <td>
                                        <button
                                            className="chip chip-purple"
                                            onClick={() => openPerms(role)}
                                            style={{ cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}
                                        >
                                            🛡️ Permissions
                                        </button>
                                    </td>
                                    <td>
                                        <button
                                            className="chip chip-blue"
                                            onClick={() => openRoleUsers(role)}
                                            style={{ cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}
                                        >
                                            👥 {roleUserCounts[role.id] ?? 0} Users
                                        </button>
                                    </td>
                                    <td>
                                        <div className="btn-group">
                                            <button className="btn btn-secondary btn-sm" onClick={() => openPerms(role)}>✏️ Edit</button>
                                            <button className="btn btn-danger btn-sm" onClick={() => handleDeleteRole(role.id, role.name)}>🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* ════════════════════ MODALS ════════════════════ */}

            {/* Add Role Modal */}
            {modal === 'addRole' && (
                <ModalShell title="➕ Add Role" onClose={() => setModal(null)}>
                    <div className="form-group">
                        <label className="form-label">Role Name *</label>
                        <input
                            className="form-input"
                            placeholder="e.g. Installation Supervisor"
                            value={newRoleName}
                            onChange={e => setNewRoleName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreateRole()}
                            autoFocus
                        />
                    </div>
                    <div className="modal-footer" style={{ paddingTop: 16 }}>
                        <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                        <button className="btn btn-primary" disabled={actionLoading || !newRoleName.trim()} onClick={handleCreateRole}>
                            {actionLoading ? '⏳ Creating...' : 'Create Role'}
                        </button>
                    </div>
                </ModalShell>
            )}

            {/* Permissions Modal */}
            {modal === 'permissions' && activeRole && (
                <ModalShell title={`🛡️ Permissions — ${activeRole.name}`} onClose={() => setModal(null)} wide>
                    <div className="form-group" style={{ marginBottom: 12 }}>
                        <input
                            className="form-input"
                            placeholder="🔍 Search permissions..."
                            value={permSearch}
                            onChange={e => setPermSearch(e.target.value)}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setRolePerms(filteredPerms.map(p => p.id))}>Select All</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setRolePerms([])}>Clear All</button>
                        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)', alignSelf: 'center' }}>
                            {rolePerms.length} / {permissions.length} selected
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
                        <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                        <button className="btn btn-primary" disabled={actionLoading} onClick={handleSavePerms}>
                            {actionLoading ? '⏳ Saving...' : '💾 Save Permissions'}
                        </button>
                    </div>
                </ModalShell>
            )}

            {/* View Users in Role Modal */}
            {modal === 'viewUsers' && activeRole && (
                <ModalShell title={`👥 Users in — ${activeRole.name}`} onClose={() => setModal(null)} wide>
                    <div style={{ marginBottom: 12 }}>
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => { setModal('addUser'); setUserForm(prev => ({ ...prev, RoleId: activeRole.id })); }}
                        >
                            + Add User to this Role
                        </button>
                    </div>
                    <div className="table-container" style={{ border: 'none' }}>
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Phone</th>
                                    <th>Department</th>
                                    <th style={{ width: 50 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {roleUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                                            No users assigned to this role yet
                                        </td>
                                    </tr>
                                ) : (
                                    roleUsers.map(u => (
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
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteUser(u.id, u.name)}>🗑️</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </ModalShell>
            )}

            {/* Add User Modal */}
            {modal === 'addUser' && (
                <ModalShell title="👤 Create New User" onClose={() => setModal(null)} wide>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Full Name *</label>
                            <input className="form-input" placeholder="Ahmed Al-Farsi" value={userForm.Name} onChange={e => setUserForm(p => ({ ...p, Name: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Email *</label>
                            <input className="form-input" type="email" placeholder="ahmed@company.com" value={userForm.Email} onChange={e => setUserForm(p => ({ ...p, Email: e.target.value }))} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Phone</label>
                            <input className="form-input" placeholder="+966 5x xxx xxxx" value={userForm.Phone} onChange={e => setUserForm(p => ({ ...p, Phone: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Password *</label>
                            <input className="form-input" type="password" placeholder="Min 8 characters" value={userForm.Password} onChange={e => setUserForm(p => ({ ...p, Password: e.target.value }))} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">Role *</label>
                            <select className="form-select" value={userForm.RoleId} onChange={e => setUserForm(p => ({ ...p, RoleId: Number(e.target.value) }))}>
                                <option value={0}>— Select Role —</option>
                                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Department</label>
                            <select className="form-select" value={userForm.DepartmentId} onChange={e => setUserForm(p => ({ ...p, DepartmentId: Number(e.target.value) }))}>
                                <option value={0}>— Select Department —</option>
                                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Super Admin toggle */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: userForm.IsSuperAdmin ? 'rgba(239,68,68,0.08)' : 'var(--bg-tertiary)', border: `1px solid ${userForm.IsSuperAdmin ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', cursor: 'pointer', marginBottom: 20 }}>
                        <input type="checkbox" style={{ accentColor: '#ef4444', width: 16, height: 16 }} checked={userForm.IsSuperAdmin} onChange={e => setUserForm(p => ({ ...p, IsSuperAdmin: e.target.checked }))} />
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>Super Admin</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Grants full access to all features</div>
                        </div>
                    </label>

                    <div className="modal-footer" style={{ paddingTop: 0 }}>
                        <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                        <button className="btn btn-primary" disabled={actionLoading || !userForm.Name || !userForm.Email || !userForm.Password} onClick={handleCreateUser}>
                            {actionLoading ? '⏳ Creating...' : '✅ Create User'}
                        </button>
                    </div>
                </ModalShell>
            )}
        </div>
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
