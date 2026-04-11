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
 * Fetches ALL pages of APEX invoices (max 50 pages of 20).
 */
export async function getAllApexInvoices(params?: { dateFrom?: string; dateTo?: string }): Promise<ApexInvoice[]> {
    const all: ApexInvoice[] = [];
    const PAGE_SIZE = 20;
    for (let page = 1; page <= 50; page++) {
        const items = await getApexInvoices({ ...params, page, pageSize: PAGE_SIZE });
        if (!items || items.length === 0) break;
        all.push(...items);
        if (items.length < PAGE_SIZE) break;
    }
    return all;
}

/**
 * Fetches ALL pages of APEX offers (max 50 pages of 20).
 */
export async function getAllApexOffers(params?: { from?: string; to?: string }): Promise<ApexOffer[]> {
    const all: ApexOffer[] = [];
    const PAGE_SIZE = 20;
    for (let page = 1; page <= 50; page++) {
        const items = await getApexOffers({ ...params, page, size: PAGE_SIZE });
        if (!items || items.length === 0) break;
        all.push(...items);
        if (items.length < PAGE_SIZE) break;
    }
    return all;
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

const API_BASE = 'https://apiorders.runasp.net';

function toImageUrl(path?: string | null): string | undefined {
    if (!path) return undefined;
    const normalized = path.replace(/\\/g, '/');
    if (normalized.startsWith('http')) return normalized;
    return `${API_BASE}/${normalized.replace(/^\//, '')}`;
}

function normalizeDepartmentUser(u: any): DepartmentUser {
    return {
        id: u.id ?? u.Id ?? u.userId ?? u.UserId ?? u.appUserId ?? u.AppUserId ?? 0,
        name: u.name ?? u.Name ?? u.fullName ?? u.FullName ?? '',
        email: u.email ?? u.Email ?? '',
        phone: u.phone ?? u.Phone ?? '',
        image: toImageUrl(u.imagePath ?? u.ImagePath ?? u.image ?? u.Image),
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

function normalizeDepartment(d: any): Department {
    return {
        id: d.id ?? d.Id ?? 0,
        name: d.name ?? d.Name ?? '',
        branchId: d.branchId ?? d.BranchId ?? 0,
        branchName: d.branchName ?? d.BranchName,
    };
}

export async function getDepartments(branchId?: number | number[]): Promise<Department[]> {
    const id = branchId === undefined ? undefined
        : Array.isArray(branchId) ? branchId[0]
        : branchId;
    const p: Record<string, number | undefined> = {};
    if (id) p.branchId = id;
    const raw = await api<unknown>('/api/Departments', { params: p });
    const list: any[] = Array.isArray(raw) ? raw
        : Array.isArray((raw as any)?.data) ? (raw as any).data
        : Array.isArray((raw as any)?.items) ? (raw as any).items
        : [];
    return list.map(normalizeDepartment);
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

function normalizeOrder(o: any): Order {
    return {
        id: o.id ?? o.Id,
        orderNumber: o.orderNumber ?? o.OrderNumber,
        status: o.status ?? o.Status,
        city: o.city ?? o.City,
        address: o.address ?? o.Address,
        scheduledDate: o.scheduledDate ?? o.ScheduledDate,
        quotationId: o.quotationId ?? o.QuotationId,
        invoiceId: o.invoiceId ?? o.InvoiceId,
        customerId: o.customerId ?? o.CustomerId,
        customerName: o.customerName ?? o.CustomerName,
        customerPhone: o.customerPhone ?? o.CustomerPhone,
        customerEmail: o.customerEmail ?? o.CustomerEmail,
        createdAt: o.createdAt ?? o.CreatedAt,
        updatedAt: o.updatedAt ?? o.UpdatedAt,
        priority: o.priority ?? o.Priority,
        branches: (() => {
            const arr = o.branches ?? o.Branches;
            if (Array.isArray(arr) && arr.length > 0) {
                return arr.map((b: any) => ({ id: b.id ?? b.Id, name: b.name ?? b.Name ?? '' }));
            }
            // Handle singular branch object
            const branchObj = o.branch ?? o.Branch;
            if (branchObj && typeof branchObj === 'object' && !Array.isArray(branchObj)) {
                const bid = branchObj.id ?? branchObj.Id ?? branchObj.branchId ?? branchObj.BranchId;
                if (bid) return [{ id: Number(bid), name: branchObj.name ?? branchObj.Name ?? '' }];
            }
            // API stores a single branchId; construct a one-item array from flat fields
            const singleId = o.branchId ?? o.BranchId;
            if (singleId != null) {
                return [{ id: Number(singleId), name: o.branchName ?? o.BranchName ?? '' }];
            }
            return [];
        })(),
        departmentId: o.departmentId ?? o.DepartmentId ?? (o.departments ?? o.Departments)?.[0]?.id ?? (o.departments ?? o.Departments)?.[0]?.Id,
        departmentName: o.departmentName ?? o.DepartmentName ?? (o.departments ?? o.Departments)?.[0]?.name ?? (o.departments ?? o.Departments)?.[0]?.Name,
        qrToken: o.qrToken ?? o.QrToken,
        qrExpiry: o.qrExpiry ?? o.QrExpiry,
        createdByName: o.createdByName ?? o.CreatedByName,
        createdById: o.createdById ?? o.CreatedById,
        salesRepresentative: o.salesRepresentative ?? o.SalesRepresentative,
        notes: o.notes ?? o.Notes,
        location: o.location ?? o.Location,
        tasks: o.tasks ?? o.Tasks,
        items: o.items ?? o.Items,
        technicians: o.technicians ?? o.Technicians,
        departmentNotes: (() => {
            const depts = o.departments ?? o.Departments;
            if (Array.isArray(depts) && depts.length > 0) {
                return depts.map((d: any) => ({
                    departmentId: d.id ?? d.Id ?? d.departmentId ?? d.DepartmentId,
                    departmentName: d.name ?? d.Name ?? d.departmentName ?? d.DepartmentName,
                    note: d.note ?? d.Note,
                    comments: (d.comments ?? d.Comments ?? d.notes ?? d.Notes ?? []).map((c: any) => ({
                        id: c.id ?? c.Id,
                        comment: c.comment ?? c.Comment ?? c.note ?? c.Note,
                        createdAt: c.createdAt ?? c.CreatedAt,
                        createdByName: c.createdByName ?? c.CreatedByName,
                    })),
                }));
            }
            return o.departmentNotes ?? o.DepartmentNotes;
        })(),
    };
}

export async function getOrders(params?: {
    branchId?: number;
    departmentId?: number;
    status?: OrderStatus;
    dateFrom?: string;
    dateTo?: string;
}): Promise<Order[]> {
    const raw = await api<unknown>('/api/Orders', { params: params as Record<string, string | number> });
    const list: any[] = Array.isArray(raw) ? raw : (Array.isArray((raw as any)?.data) ? (raw as any).data : []);
    return list.map(normalizeOrder);
}

export async function getOrderById(id: number): Promise<Order> {
    const raw = await api<unknown>(`/api/Orders/${id}`);
    const obj = raw as Record<string, unknown>;
    let data: any = raw;
    if (obj && typeof obj === 'object') {
        if ('data' in obj && obj.data) data = obj.data;
        else if ('item' in obj && obj.item) data = obj.item;
    }
    return normalizeOrder(data);
}

export async function createOrder(dto: AddOrderDto): Promise<Order> {
    const fd = new FormData();
    fd.append('Status', dto.status);
    if (dto.city)          fd.append('City', dto.city);
    if (dto.address)       fd.append('Address', dto.address);
    if (dto.location)      fd.append('Location', dto.location);
    if (dto.scheduledDate) fd.append('ScheduledDate', dto.scheduledDate);
    if (dto.quotationId)   fd.append('QuotationId', dto.quotationId);
    if (dto.invoiceId)     fd.append('InvoiceId', dto.invoiceId);
    if (dto.customerId)    fd.append('CustomerId', dto.customerId);
    fd.append('CreatedAt', dto.createdAt);
    fd.append('Priority', dto.priority);
    fd.append('BranchId', String(dto.branchId));
    if (dto.notes)         fd.append('Notes', dto.notes);
    dto.departmentIds.forEach((d, i) => {
        fd.append(`DepartmentIds[${i}][Idd]`, String(d.idd));
        fd.append(`DepartmentIds[${i}][Note]`, d.note ?? '');
    });
    const res = await api<any>('/api/Orders', { method: 'POST', body: fd, isFormData: true });
    return (res?.id ? res : { id: res }) as Order;
}

export async function updateOrder(id: number, dto: UpdateOrderDto): Promise<Order> {
    const fd = new FormData();
    fd.append('Status', dto.status);
    if (dto.city)                fd.append('City', dto.city);
    if (dto.address)             fd.append('Address', dto.address);
    if (dto.location)            fd.append('Location', dto.location);
    if (dto.scheduledDate)       fd.append('ScheduledDate', dto.scheduledDate);
    if (dto.quotationId)         fd.append('QuotationId', dto.quotationId);
    if (dto.invoiceId)           fd.append('InvoiceId', dto.invoiceId);
    if (dto.customerId)          fd.append('CustomerId', dto.customerId);
    fd.append('CreatedAt', dto.createdAt);
    if (dto.salesApprovalDate)   fd.append('SalesApprovalDate', dto.salesApprovalDate);
    fd.append('Priority', dto.priority);
    if (dto.notes)               fd.append('Notes', dto.notes);
    dto.branchIds?.forEach((b, i) => fd.append(`BranchIds[${i}][Id]`, String(b.id)));
    if (dto.departmentId)        fd.append('DepartmentId', String(dto.departmentId));
    const res = await api<any>(`/api/Orders/${id}`, { method: 'PUT', body: fd, isFormData: true });
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
        const raw = await api<unknown>(`/api/Notes/${orderId}`);
        if (Array.isArray(raw)) return raw as OrderNote[];
        const obj = raw as Record<string, unknown>;
        if (obj && Array.isArray(obj.data)) return obj.data as OrderNote[];
        return [];
    } catch {
        return [];
    }
}

export async function addOrderNote(orderId: number, note: string): Promise<OrderNote> {
    return api<OrderNote>(`/api/Notes/${orderId}`, {
        method: 'POST',
        body: { note },
    });
}

export async function updateOrderNote(id: number, note: string): Promise<OrderNote> {
    return api<OrderNote>(`/api/Notes/${id}`, {
        method: 'PUT',
        body: { note },
    });
}

export async function deleteOrderNote(id: number): Promise<void> {
    return api<void>(`/api/Notes/${id}`, { method: 'DELETE' });
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

export async function updateEvidence(id: number, note: string, image?: File | null): Promise<Evidence> {
    const formData = new FormData();
    formData.append('Note', note);
    if (image) formData.append('Image', image);
    return api<Evidence>(`/api/Orders/Evidence/${id}`, {
        method: 'PUT',
        body: formData,
        isFormData: true,
    });
}

export async function deleteEvidence(id: number): Promise<void> {
    return api<void>(`/api/Orders/evidence/${id}`, { method: 'DELETE' });
}

export async function getOrderEvidence(id: number): Promise<Evidence[]> {
    try {
        const raw = await api<unknown>(`/api/Orders/${id}/evidence`);
        const arr: unknown[] = Array.isArray(raw) ? raw
            : Array.isArray((raw as Record<string, unknown>)?.data) ? (raw as Record<string, unknown>).data as unknown[]
            : [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return arr.map((e: any) => ({
            id: e.id ?? e.Id,
            orderId: e.orderId ?? e.OrderId,
            imagePath: e.imagePath ?? e.ImagePath,
            imageUrl: e.imageUrl ?? e.ImageUrl,
            note: e.note ?? e.Note ?? e.description ?? e.Description,
            createdAt: e.createdAt ?? e.CreatedAt,
            uploadedBy: e.uploadedBy ?? e.UploadedBy,
        }));
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

    // Normalize other field names
    const normalized = Object.fromEntries(
        Object.entries(payload).map(([k, v]) => [k.charAt(0).toLowerCase() + k.slice(1), v])
    );

    // Normalize orders array so camelCase fields are consistent
    const rawOrders = Array.isArray(payload.orders) ? payload.orders : Array.isArray((payload as any).Orders) ? (payload as any).Orders : [];
    normalized.orders = rawOrders.map(normalizeOrder);

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