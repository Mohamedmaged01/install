import { api } from './api';
import type {
    LoginDto,
    AuthUser,
    Branch,
    Department,
    DepartmentUser,
    Order,
    AddOrderDto, UpdateOrderDto,
    OrderHistoryEntry,
    OrderNote,
    Evidence,
    VerifyQrDto,
    AssignTaskDto,
    Task,
    TaskStatus,
    TaskStatusUpdateDto,
    TaskHistoryEntry,
    TaskNote,
    TaskStatistics,
    Role,
    Permission,
    Statistics,
    HomeTaskStatus,
    OrderStatus,
    ApexInvoice,
    ApexOffer,
    ApexResponse,
} from '@/types';

// ==================== AUTH ====================

export async function login(dto: LoginDto): Promise<AuthUser> {
    return api<AuthUser>('/api/Auth/login', { method: 'POST', body: dto });
}

export async function logout(): Promise<void> {
    return api<void>('/api/Auth', { method: 'DELETE' });
}

// ==================== APEX (via local Next.js secure proxy) ====================

// ==================== HOME / SHARED ====================

export async function getUserTypes(): Promise<{ value: number; text: string }[]> {
    return api<{ value: number; text: string }[]>('/api/Home/user-types');
}

export async function getApexInvoices(params?: {
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
}): Promise<ApexInvoice[]> {
    const qs = new URLSearchParams();
    if (params?.dateFrom) qs.set('DateFrom', params.dateFrom);
    if (params?.dateTo) qs.set('DateTo', params.dateTo);
    if (params?.page) qs.set('PageNumber', String(params.page));
    if (params?.pageSize) qs.set('PageSize', String(params.pageSize));
    const url = `/api/apex/invoices${qs.toString() ? '?' + qs : ''}`;
    const res: ApexResponse<ApexInvoice> = await fetch(url).then(r => r.json());
    if (!res.isSuccess) throw new Error(res.message || 'APEX invoices failed');
    return res.data ?? [];
}

export async function getApexOffers(params?: {
    from?: string;
    to?: string;
    page?: number;
    size?: number;
}): Promise<ApexOffer[]> {
    const qs = new URLSearchParams();
    if (params?.from) qs.set('DateFrom', params.from);
    if (params?.to) qs.set('DateTo', params.to);
    if (params?.page) qs.set('PageNumber', String(params.page));
    if (params?.size) qs.set('PageSize', String(params.size));
    const url = `/api/apex/offers${qs.toString() ? '?' + qs : ''}`;
    const res: ApexResponse<ApexOffer> = await fetch(url).then(r => r.json());
    if (!res.isSuccess) throw new Error(res.message || 'APEX offers failed');
    return res.data ?? [];
}

/**
 * Convenience helper to find a specific document by code and return its items.
 * Since APEX endpoints don't support direct fetch by code, we loop through pages.
 */
export async function getApexDocumentItems(type: 'invoice' | 'offer', code: string): Promise<import('@/types').ApexItem[]> {
    if (!code || code.toLowerCase() === 'string') return [];
    try {
        console.log(`[APEX Fetch] Looking for ${type} with code: "${code}"`);
        const MAX_PAGES = 25;
        const PAGE_SIZE = 20; // APEX API rejects page sizes > 20

        for (let page = 1; page <= MAX_PAGES; page++) {
            if (type === 'invoice') {
                const invoices = await getApexInvoices({ page, pageSize: PAGE_SIZE });
                if (!invoices || invoices.length === 0) break;

                const doc = invoices.find(i => i.code === code);
                if (doc) {
                    console.log(`[APEX Fetch] Found doc "${code}" on page ${page}`);
                    return doc.items || [];
                }
                if (invoices.length < PAGE_SIZE) break; // no more pages
            } else {
                const offers = await getApexOffers({ page, size: PAGE_SIZE });
                if (!offers || offers.length === 0) break;

                const doc = offers.find(o => o.code === code);
                if (doc) {
                    console.log(`[APEX Fetch] Found doc "${code}" on page ${page}`);
                    return doc.items || [];
                }
                if (offers.length < PAGE_SIZE) break; // no more pages
            }
        }

        console.log(`[APEX Fetch] Document "${code}" not found after scanning ${MAX_PAGES} pages.`);
        return [];
    } catch (err) {
        console.error(`Failed to fetch APEX ${type} items:`, err);
        return [];
    }
}

// ==================== BRANCHES ====================

export async function getBranches(): Promise<Branch[]> {
    return api<Branch[]>('/api/Branches');
}

export async function createBranch(dto: { name: string; email?: string; phone?: string }): Promise<Branch> {
    return api<Branch>('/api/Branches', { method: 'POST', body: { Name: dto.name, Email: dto.email, Phone: dto.phone } });
}

export async function updateBranch(id: number, dto: { name: string; email?: string; phone?: string }): Promise<Branch> {
    return api<Branch>(`/api/Branches/${id}`, { method: 'PUT', body: { Name: dto.name, Email: dto.email, Phone: dto.phone } });
}

export async function deleteBranch(id: number): Promise<void> {
    return api<void>(`/api/Branches/${id}`, { method: 'DELETE' });
}

function normalizeDepartmentUser(u: any): DepartmentUser {
    return {
        id: u.id ?? u.Id ?? u.userId ?? u.UserId ?? u.appUserId ?? u.AppUserId ?? 0,
        name: u.name ?? u.Name ?? u.fullName ?? u.FullName ?? '',
        email: u.email ?? u.Email ?? '',
        phone: u.phone ?? u.Phone ?? '',
        image: u.image ?? u.Image,
        roleId: u.roleId ?? u.RoleId ?? 0,
        roleName: u.roleName ?? u.RoleName,
        departmentId: u.departmentId ?? u.DepartmentId ?? 0,
        departmentName: u.departmentName ?? u.DepartmentName,
        isSuperAdmin: u.isSuperAdmin ?? u.IsSuperAdmin ?? false,
        type: u.type ?? u.Type,
        role: u.role ?? u.Role,
    };
}

export async function getBranchTechnicians(branchId: number): Promise<DepartmentUser[]> {
    const raw = await api<unknown>(`/api/Branches/${branchId}/technicians`);
    const arr = Array.isArray(raw) ? raw : Array.isArray((raw as any)?.data) ? (raw as any).data : [];
    return arr.map(normalizeDepartmentUser);
}

// ==================== DEPARTMENTS ====================

export async function getDepartments(branchId?: number | number[]): Promise<Department[]> {
    const id = branchId === undefined ? undefined
        : Array.isArray(branchId) ? branchId[0]
        : branchId;
    const p: Record<string, number | undefined> = {};
    if (id) p.branchId = id;
    const raw = await api<unknown>('/api/Departments', { params: p });
    if (Array.isArray(raw)) return raw as Department[];
    const obj = raw as Record<string, unknown>;
    if (obj && Array.isArray(obj.data)) return obj.data as Department[];
    if (obj && Array.isArray(obj.items)) return obj.items as Department[];
    return [];
}

export async function createDepartment(dto: { branchId: number; name: string }): Promise<Department> {
    return api<Department>('/api/Departments', { method: 'POST', body: { BranchId: dto.branchId, Name: dto.name } });
}

export async function getDepartmentUsers(branchId?: number, departmentId?: number): Promise<DepartmentUser[]> {
    const raw = await api<unknown>('/api/Departments/users', {
        params: { branchId, departmentId },
    });
    const arr = Array.isArray(raw) ? raw : Array.isArray((raw as any)?.data) ? (raw as any).data : [];
    return arr.map(normalizeDepartmentUser);
}

export async function createDepartmentUser(formData: FormData): Promise<DepartmentUser> {
    return api<DepartmentUser>('/api/Departments/user', {
        method: 'POST',
        body: formData,
        isFormData: true,
    });
}

export async function updateDepartment(id: number, dto: { name: string; branchId?: number }): Promise<Department> {
    const body: Record<string, string | number | undefined | null> = { Name: dto.name };
    if (dto.branchId) body.BranchId = dto.branchId;
    return api<Department>(`/api/Departments/${id}`, { method: 'PUT', body });
}

export async function deleteDepartment(id: number): Promise<void> {
    return api<void>(`/api/Departments/${id}`, { method: 'DELETE' });
}

export async function removeUserFromRole(userId: number): Promise<void> {
    return api<void>(`/api/Users/${userId}/remove-role`, { method: 'PUT' });
}

export async function deleteDepartmentUser(id: number): Promise<void> {
    return api<void>(`/api/Departments/user/${id}`, { method: 'DELETE' });
}

export async function updateDepartmentUser(
    id: number,
    fields: { Name?: string; Email?: string; Phone?: string; Password?: string; DepartmentId?: number; RoleId?: number },
    image?: File | null,
): Promise<DepartmentUser> {
    const params: Record<string, string | number | undefined | null> = {};
    if (fields.Name)         params.Name         = fields.Name;
    if (fields.Email)        params.Email        = fields.Email;
    if (fields.Phone)        params.Phone        = fields.Phone;
    if (fields.Password)     params.Password     = fields.Password;
    if (fields.DepartmentId) params.DepartmentId = fields.DepartmentId;
    if (fields.RoleId)       params.RoleId       = fields.RoleId;

    const formData = new FormData();
    if (image) formData.append('Image', image);

    return api<DepartmentUser>(`/api/Users/${id}`, {
        method: 'PUT',
        params,
        body: formData,
        isFormData: true,
    });
}

// ==================== ORDERS ====================

export async function getOrders(params?: {
    branchId?: number;
    departmentId?: number;
    status?: OrderStatus;
    dateFrom?: string;
    dateTo?: string;
}): Promise<Order[]> {
    const raw = await api<unknown>('/api/Orders', { params: params as Record<string, string | number> });
    if (Array.isArray(raw)) return raw as Order[];
    const obj = raw as Record<string, unknown>;
    if (obj && Array.isArray(obj.data)) return obj.data as Order[];
    return [];
}

export async function getOrderById(id: number): Promise<Order> {
    const raw = await api<unknown>(`/api/Orders/${id}`);
    const obj = raw as Record<string, unknown>;
    if (obj && typeof obj === 'object') {
        if ('data' in obj && obj.data) return obj.data as Order;
        if ('item' in obj && obj.item) return obj.item as Order;
    }
    return raw as Order;
}

export async function createOrder(dto: AddOrderDto): Promise<Order> {
    const res = await api<any>('/api/Orders', { method: 'POST', body: dto });
    // The backend returns the new order ID as `data` (e.g., { data: 36 })
    // If it returns a full object with an id, use that. Otherwise use the data integer.
    return (res?.id ? res : { id: res }) as Order;
}

export async function updateOrder(id: number, dto: UpdateOrderDto): Promise<Order> {
    const res = await api<any>(`/api/Orders/${id}`, { method: 'PUT', body: dto });
    return res as Order;
}

export async function deleteOrders(): Promise<void> {
    return api<void>('/api/Orders', { method: 'DELETE' });
}

export async function deleteOrder(id: number): Promise<void> {
    return api<void>(`/api/Orders/${id}`, { method: 'DELETE' });
}

export async function getOrderHistory(id: number): Promise<OrderHistoryEntry[]> {
    try {
        const raw = await api<unknown>(`/api/Orders/${id}/history`);
        const entries: OrderHistoryEntry[] = Array.isArray(raw)
            ? raw as OrderHistoryEntry[]
            : Array.isArray((raw as Record<string, unknown>)?.data)
                ? (raw as Record<string, unknown>).data as OrderHistoryEntry[]
                : [];
        return entries;
    } catch {
        return [];
    }
}

export async function approveSalesManager(id: number): Promise<void> {
    return api<void>(`/api/Orders/${id}/approve-sales`, { method: 'POST' });
}

export async function approveSupervisor(id: number, technicianIds: number[] = [], note?: string | null): Promise<string | null> {
    const result = await api<string | null>(`/api/Orders/${id}/approve-supervisor`, {
        method: 'POST',
        body: technicianIds.map(techId => ({ technicianId: Number(techId), note: note || null })),
    });
    return typeof result === 'string' ? result : null;
}

export async function rejectOrder(id: number, reason: string): Promise<void> {
    return api<void>(`/api/Orders/${id}/reject`, {
        method: 'POST',
        body: reason,
    });
}

export async function acceptFromOutside(id: number): Promise<void> {
    return api<void>(`/api/Orders/${id}/accept-outside`, { method: 'POST' });
}

export async function verifyQr(dto: VerifyQrDto): Promise<unknown> {
    return api('/api/Orders/verify-qr', { method: 'POST', body: dto });
}

export async function uploadEvidence(orderId: number, images: File[], note?: string): Promise<Evidence> {
    const formData = new FormData();
    formData.append('OrderId', String(orderId));
    images.forEach(img => formData.append('Images', img));
    if (note) formData.append('Note', note);
    return api<Evidence>('/api/Orders/evidence', {
        method: 'POST',
        body: formData,
        isFormData: true,
    });
}

export async function getOrderNotes(orderId: number): Promise<OrderNote[]> {
    try {
        const raw = await api<unknown>(`/api/Orders/${orderId}/notes`);
        if (Array.isArray(raw)) return raw as OrderNote[];
        const obj = raw as Record<string, unknown>;
        if (obj && Array.isArray(obj.data)) return obj.data as OrderNote[];
        return [];
    } catch {
        return [];
    }
}

export async function addOrderNote(orderId: number, note: string): Promise<OrderNote> {
    return api<OrderNote>(`/api/Orders/${orderId}/notes`, {
        method: 'POST',
        body: { Note: note },
    });
}

export async function updateOrderNote(id: number, note: string): Promise<OrderNote> {
    return api<OrderNote>(`/api/Orders/notes/${id}`, {
        method: 'PUT',
        body: { Note: note },
    });
}

export async function deleteOrderNote(id: number): Promise<void> {
    return api<void>(`/api/Orders/notes/${id}`, { method: 'DELETE' });
}

export async function getOrderTechnicians(id: number): Promise<DepartmentUser[]> {
    try {
        const raw = await api<unknown>(`/api/Orders/${id}/technicians`);
        if (Array.isArray(raw)) return raw as DepartmentUser[];
        const obj = raw as { data?: unknown };
        if (obj && Array.isArray(obj.data)) return obj.data as DepartmentUser[];
        return [];
    } catch {
        return [];
    }
}

export async function updateEvidence(id: number, note: string): Promise<Evidence> {
    return api<Evidence>(`/api/Orders/evidence/${id}`, {
        method: 'PUT',
        body: { Note: note },
    });
}

export async function deleteEvidence(id: number): Promise<void> {
    return api<void>(`/api/Orders/evidence/${id}`, { method: 'DELETE' });
}

export async function getOrderEvidence(id: number): Promise<Evidence[]> {
    try {
        const raw = await api<unknown>(`/api/Orders/${id}/evidence`);
        if (Array.isArray(raw)) return raw as Evidence[];
        const obj = raw as Record<string, unknown>;
        if (obj && Array.isArray(obj.data)) return obj.data as Evidence[];
        return [];
    } catch {
        return [];
    }
}

// ==================== TASKS ====================

export async function assignTask(dto: AssignTaskDto): Promise<Task> {
    return api<Task>('/api/Tasks', { method: 'POST', body: dto });
}

export async function updateTaskStatus(id: number, dto: { newStatus: TaskStatus; note?: string | null; imageFiles?: File[] }): Promise<void> {
    const formData = new FormData();
    formData.append('NewStatus', dto.newStatus);
    if (dto.note) formData.append('Note', dto.note);
    if (dto.imageFiles) {
        dto.imageFiles.forEach(f => formData.append('ImageFiles', f));
    }
    return api<void>(`/api/Tasks/${id}/status`, { method: 'POST', body: formData, isFormData: true });
}

export async function getMyTasks(params?: { technicianId?: number; branchIds?: number[]; departmentIds?: number[]; technicianName?: string }): Promise<Task[]> {
    const p: Record<string, string | number | number[] | undefined> = {};
    if (params?.technicianId) p.technicianId = params.technicianId;
    if (params?.branchIds?.length) p.branchIds = params.branchIds;
    if (params?.departmentIds?.length) p.departmentId = params.departmentIds;
    if (params?.technicianName) p.technicianName = params.technicianName;
    const raw = await api<unknown>('/api/Tasks/tasks', { params: p });
    if (Array.isArray(raw)) return raw as Task[];
    const obj = raw as Record<string, unknown>;
    if (obj && Array.isArray(obj.data)) return obj.data as Task[];
    return [];
}

export async function getTaskById(id: number): Promise<Task> {
    const raw = await api<unknown>(`/api/Tasks/${id}`);
    const obj = raw as Record<string, unknown>;
    if (obj && typeof obj === 'object') {
        if ('data' in obj && obj.data) return obj.data as Task;
    }
    return raw as Task;
}

export async function deleteTask(id: number): Promise<void> {
    return api<void>(`/api/Tasks/${id}`, { method: 'DELETE' });
}

export async function getTaskHistory(id: number): Promise<TaskHistoryEntry[]> {
    const raw = await api<unknown>(`/api/Tasks/${id}/history`);
    if (Array.isArray(raw)) return raw as TaskHistoryEntry[];
    const obj = raw as Record<string, unknown>;
    if (obj && Array.isArray(obj.data)) return obj.data as TaskHistoryEntry[];
    return [];
}

export async function getTaskNotes(id: number): Promise<TaskNote[]> {
    const raw = await api<unknown>(`/api/Tasks/${id}/notes`);
    if (Array.isArray(raw)) return raw as TaskNote[];
    const obj = raw as Record<string, unknown>;
    if (obj && Array.isArray(obj.data)) return obj.data as TaskNote[];
    return [];
}

export async function getTaskStatistics(params?: {
    branchIds?: number[];
    departmentIds?: number[];
    from?: string;
    to?: string;
}): Promise<TaskStatistics> {
    const p: Record<string, string | number | number[] | undefined> = {};
    if (params?.branchIds?.length) p.branchIds = params.branchIds;
    if (params?.departmentIds?.length) p.departmentId = params.departmentIds;
    if (params?.from) p.from = params.from;
    if (params?.to) p.to = params.to;
    const raw = await api<unknown>('/api/Tasks/statistics', { params: p });
    if (raw && typeof raw === 'object') return raw as TaskStatistics;
    return {};
}

// ==================== STATISTICS ====================

export async function getStatistics(params?: {
    branchIds?: number[];
    departmentIds?: number[];
    from?: string;
    to?: string;
}): Promise<Statistics> {
    const p: Record<string, string | number | number[] | undefined> = {};
    if (params?.branchIds?.length) p.branchIds = params.branchIds;
    if (params?.departmentIds?.length) p.departmentId = params.departmentIds;
    if (params?.from) p.from = params.from;
    if (params?.to) p.to = params.to;
    const raw = await api<Record<string, unknown>>('/api/Statistics', { params: p });

    // api<T> already unwraps `data` from `{ succeeded: true, data: { ... } }`,
    // so `raw` is `{ total: 2, pendingSalesApproval: 1, orders: [...] }`.
    const payload = raw && typeof raw === 'object' ? raw : {};

    // Pass through orders array directly
    const orders = Array.isArray(payload.orders) ? payload.orders : [];

    // Normalize other field names
    const normalized = Object.fromEntries(
        Object.entries(payload).map(([k, v]) => [k.charAt(0).toLowerCase() + k.slice(1), v])
    );

    normalized.orders = orders;

    return normalized as Statistics;
}

export async function getHomeTaskStatus(): Promise<HomeTaskStatus> {
    const raw = await api<any>('/api/Home/taskStatus');
    return raw?.data ? raw.data : raw;
}

// ==================== ROLES ====================

export async function getRoles(): Promise<Role[]> {
    const raw = await api<unknown[]>('/api/Roles');
    return (Array.isArray(raw) ? raw : []).map(r => ({
        id: (r as any).id ?? (r as any).Id ?? 0,
        name: (r as any).name ?? (r as any).Name ?? (r as any).title ?? (r as any).Title ?? '',
        usersCount: (r as any).usersCount ?? (r as any).UsersCount ?? 0,
        users: (r as any).users || [],
    }));
}

export async function createRole(name: string): Promise<Role> {
    return api<Role>('/api/Roles', { method: 'POST', body: name });
}

export async function updateRole(id: number, name: string): Promise<void> {
    await api<string>(`/api/Roles/${id}`, { method: 'PUT', body: name });
}

export async function deleteRole(id: number): Promise<void> {
    return api<void>(`/api/Roles/${id}`, { method: 'DELETE' });
}

export async function getRolePermissions(id: number): Promise<Permission[]> {
    const raw = await api<unknown[]>(`/api/Roles/${id}/permissions`);
    return (Array.isArray(raw) ? raw : []).map(p => ({
        id: (p as any).id ?? (p as any).Id ?? 0,
        name: (p as any).title ?? (p as any).Title ?? (p as any).name ?? (p as any).Name ?? '',
        description: (p as any).description ?? (p as any).Description,
    }));
}

export async function setRolePermissions(id: number, permissionIds: number[]): Promise<void> {
    return api<void>(`/api/Roles/${id}/permissions`, { method: 'POST', body: permissionIds });
}

export async function updateRolePermissions(id: number, permissionIds: number[]): Promise<void> {
    return api<void>(`/api/Roles/${id}/permissions`, {
        method: 'PUT',
        body: permissionIds,
    });
}

// ==================== PERMISSIONS ====================

export async function getPermissions(): Promise<Permission[]> {
    const raw = await api<unknown[]>('/api/Permissions');
    return (Array.isArray(raw) ? raw : []).map(p => ({
        id: (p as any).id ?? (p as any).Id ?? 0,
        name: (p as any).title ?? (p as any).Title ?? (p as any).name ?? (p as any).Name ?? '',
        description: (p as any).description ?? (p as any).Description,
    }));
}