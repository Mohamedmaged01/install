import type { OrderStatus } from '@/types';

const STATUS_CONFIG: Record<OrderStatus, { color: string; bg: string; label: string; labelAr: string }> = {
    Draft: { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', label: 'Draft', labelAr: 'مسودة' },
    PendingSalesApproval: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'Pending Sales', labelAr: 'انتظار المبيعات' },
    PendingSupervisorApproval: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', label: 'Pending Supervisor', labelAr: 'انتظار المشرف' },
    ReadyForInstallation: { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)', label: 'Ready for Installation', labelAr: 'جاهز للتركيب' },
    ReturnedToDraft: { color: '#f97316', bg: 'rgba(249,115,22,0.12)', label: 'Returned to Draft', labelAr: 'مُرتجع مسودة' },
    ReturnedToSales: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'Returned to Sales', labelAr: 'مُرتجع للمبيعات' },
    Complete: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'Complete', labelAr: 'مكتمل' },
    Canceled: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'Canceled', labelAr: 'ملغي' },
};

interface StatusBadgeProps {
    status: OrderStatus;
    lang?: 'en' | 'ar';
}

export default function StatusBadge({ status, lang = 'en' }: StatusBadgeProps) {
    const cfg = STATUS_CONFIG[status] ?? { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', label: status, labelAr: status };
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 10px',
            borderRadius: 'var(--radius-full)',
            fontSize: 12,
            fontWeight: 600,
            color: cfg.color,
            background: cfg.bg,
            border: `1px solid ${cfg.color}30`,
            whiteSpace: 'nowrap',
        }}>
            {lang === 'ar' ? cfg.labelAr : cfg.label}
        </span>
    );
}
