// ==================== APEX GATE TYPES ====================

export interface ApexCustomer {
    code: string;
    arabicName: string;
    latinName: string;
    phone: string | null;
    email: string;
    addressAr: string;
}

export interface ApexItem {
    itemCode: string;
    arabicName: string;
    latinName: string;
    quantity: number;
    price: number;
    discountValue: number;
    vatValue: number;
}

export interface ApexInvoice {
    code: string;
    invoiceDate: string;
    totalDiscountValue: number;
    totalVat: number;
    net: number;
    customer: ApexCustomer;
    items: ApexItem[];
}

export interface ApexOffer {
    code: string;
    offerDate: string;
    totalDiscountValue: number;
    totalVat: number;
    net: number;
    customer: ApexCustomer;
    items: ApexItem[];
}

export interface ApexResponse<T> {
    isSuccess: boolean;
    message: string;
    data: T[];
}

// ==================== BACKEND ENUMS ====================

export type OrderStatus =
    | 'Draft'
    | 'PendingSalesApproval'
    | 'PendingSupervisorApproval'
    | 'ReadyForInstallation'
    | 'ReturnedToDraft'
    | 'ReturnedToSales'
    | 'Complete'
    | 'Canceled';

export type Priority = 'Urgent' | 'Normal';

export type TaskStatus =
    | 'Assigned'
    | 'Accepted'
    | 'Enroute'
    | 'Onsite'
    | 'InProgress'
    | 'Completed'
    | 'Returned'
    | 'OnHold';

// ==================== AUTH ====================

export interface LoginDto {
    phoneOrEmail: string;
    password: string;
}

export interface AuthUser {
    id: number;
    name: string;
    email: string;
    phone: string;
    roleId: number;
    roleName: string;
    departmentId?: number;
    departmentName?: string;
    branchId?: number;
    branchName?: string;
    isSuperAdmin: boolean;
    token: string;
    image?: string;
    type?: string;
    /** Permission strings from JWT, e.g. "Permissions.Orders.Create" */
    permissions: string[];
}

// ==================== BRANCH / DEPARTMENT ====================

export interface Branch {
    id: number;
    name: string;
    email?: string;
    phone?: string;
}

export interface Department {
    id: number;
    name: string;
    branchId: number;
}

export interface DepartmentUser {
    id: number;
    name: string;
    email: string;
    phone: string;
    image?: string;
    roleId: number;
    roleName?: string;
    departmentId: number;
    departmentName?: string;
    isSuperAdmin: boolean;
    type?: string;
    role?: string;
}

// ==================== ORDER ====================

export interface AddOrderDto {
    status: OrderStatus;
    city: string | null;
    address: string | null;
    location: string | null;
    scheduledDate: string | null;
    quotationId: string | null;
    invoiceId: string | null;
    customerId: string | null;
    createdAt: string;
    priority: Priority;
    branchId: number;
    departmentIds: { idd: number }[];
    notes: string | null;
}

export interface UpdateOrderDto {
    status: OrderStatus;
    city: string | null;
    address: string | null;
    location: string | null;
    scheduledDate: string | null;
    quotationId: string | null;
    invoiceId: string | null;
    customerId: string | null;
    createdAt: string;
    salesApprovalDate: string | null;
    priority: Priority;
    branchIds: { id: number }[];
    departmentId: number;
    notes: string | null;
}

export interface Order {
    id: number;
    orderNumber?: string;
    status: OrderStatus;
    city?: string;
    address?: string;
    scheduledDate?: string;
    quotationId?: string;
    invoiceId?: string;
    customerId?: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    createdAt: string;
    updatedAt?: string;
    priority: Priority;
    branches?: { id: number; name: string }[];
    departmentId: number;
    departmentName?: string;
    qrToken?: string;
    qrExpiry?: string;
    createdByName?: string;
    createdById?: number;
    salesRepresentative?: string;
    notes?: string;
    location?: string;
    // Nested data from GET /api/Orders/{id}
    tasks?: Task[];
    items?: OrderItem[];
    technicians?: { id: number; name: string }[];
}

export interface OrderItem {
    id: number;
    name: string;
    quantity: number;
    unit?: string;
    unitPrice: number;
    total: number;
}

// ==================== TASK ====================

export interface AssignTaskDto {
    orderId: number;
    technicianId: number;
    notes: string | null;
}

export interface TaskStatusUpdateDto {
    newStatus: TaskStatus;
    notes: string | null;
    imagePath: string | null;
}

export interface Task {
    id: number;
    installationOrderId?: number;
    orderId?: number;
    technicianId?: number;
    technicianName?: string;
    status: TaskStatus;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
    orderNumber?: string;
    customerName?: string;
    city?: string;
    address?: string;
    priority?: Priority;
    departmentName?: string;
    scheduledDate?: string;
}

// ==================== QR ====================

export interface VerifyQrDto {
    orderId: number;
    token: string;
}

// ==================== TASK HISTORY ====================

export interface TaskHistoryEntry {
    fromStatus: string | null;
    toStatus: string;
    actionByUserName: string | null;
    actionDate: string;
    note: string | null;
}

export interface TaskNote {
    id: number;
    createdAt: string;
    note: string | null;
    imagePaths: string[];
}

export interface TaskStatistics {
    total?: number;
    totalTasks?: number;
    active?: number;
    assigned?: number;
    hold?: number;
    enroute?: number;
    onsite?: number;
    inProgress?: number;
    completed?: number;
}

// ==================== HISTORY / EVIDENCE ====================

export interface OrderHistoryEntry {
    fromStatus: string | null;
    toStatus: string;
    actionByUserName: string | null;
    actionDate: string;
    note: string | null;
}

export interface Evidence {
    id: number;
    orderId: number;
    imagePath?: string;
    imageUrl?: string;
    note?: string;
    createdAt: string;
    uploadedBy?: string;
}

// ==================== ROLE / PERMISSION ====================

export interface Role {
    id: number;
    name: string;
    usersCount?: number;
    users?: DepartmentUser[];
}

export interface Permission {
    id: number;
    name: string;
    description?: string;
}

// ==================== STATISTICS ====================

export interface Statistics {
    // The API returns "total" not "totalOrders"
    total?: number;
    totalOrders?: number;
    // API response field names (flexible - handle both old and new naming)
    pendingSalesApproval?: number;
    pendingSalesManager?: number;
    // Note: backend has a typo — "supervisior" with extra 'i'
    pendingSupervisiorApproval?: number;
    pendingSupervisorApproval?: number;
    pendingSupervisor?: number;
    readyForInstallation?: number;
    inProgress?: number;
    complete?: number;
    completed?: number;
    returnedToDraft?: number;
    returnedToSales?: number;
    returned?: number;
    canceled?: number;
    cancelled?: number;
    draft?: number;
    urgent?: number;
    // Recent orders embedded in stats response
    orders?: Order[];
}

export interface HomeTaskStatus {
    assigned?: number;
    accepted?: number;
    enroute?: number;
    onsite?: number;
    inProgress?: number;
    completed?: number;
    returned?: number;
    onHold?: number;
}

// ==================== STATUS DISPLAY HELPERS ====================

export const ORDER_STATUS_LABELS: Record<OrderStatus, { en: string; ar: string }> = {
    Draft: { en: 'Draft', ar: 'مسودة' },
    PendingSalesApproval: { en: 'Pending Sales Approval', ar: 'انتظار موافقة المبيعات' },
    PendingSupervisorApproval: { en: 'Pending Supervisor Approval', ar: 'انتظار موافقة المشرف' },
    ReadyForInstallation: { en: 'Ready for Installation', ar: 'جاهز للتركيب' },
    ReturnedToDraft: { en: 'Returned to Draft', ar: 'مُرتجع إلى مسودة' },
    ReturnedToSales: { en: 'Returned to Sales', ar: 'مُرتجع إلى المبيعات' },
    Complete: { en: 'Complete', ar: 'مكتمل' },
    Canceled: { en: 'Canceled', ar: 'ملغي' },
};

export function getOrderStatusLabel(status: OrderStatus, lang: 'en' | 'ar' = 'en'): string {
    return ORDER_STATUS_LABELS[status]?.[lang] ?? status;
}

export const TASK_STATUS_LABELS: Record<TaskStatus, { en: string; ar: string }> = {
    Assigned: { en: 'Assigned', ar: 'مُعيَّن' },
    Accepted: { en: 'Accepted', ar: 'مقبول' },
    Enroute: { en: 'En Route', ar: 'في الطريق' },
    Onsite: { en: 'On Site', ar: 'في الموقع' },
    InProgress: { en: 'In Progress', ar: 'قيد التنفيذ' },
    Completed: { en: 'Completed', ar: 'مكتمل' },
    Returned: { en: 'Returned', ar: 'مُرتجع' },
    OnHold: { en: 'On Hold', ar: 'معلق' },
};

export const PRIORITY_LABELS: Record<Priority, { en: string; ar: string }> = {
    Urgent: { en: 'Urgent', ar: 'عاجل' },
    Normal: { en: 'Normal', ar: 'عادي' },
};
