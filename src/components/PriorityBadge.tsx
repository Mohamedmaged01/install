'use client';

import { Priority } from '@/types';

const priorityConfig: Record<Priority, { icon: string; color: string; en: string; ar: string }> = {
    Urgent: { icon: '🔴', color: '#ef4444', en: 'Urgent', ar: 'عاجل' },
    Normal: { icon: '🟢', color: '#10b981', en: 'Normal', ar: 'عادي' },
};

export default function PriorityBadge({ priority, lang = 'en' }: { priority: Priority; lang?: 'en' | 'ar' }) {
    const config = priorityConfig[priority] ?? { icon: '⚪', color: '#94a3b8', en: priority, ar: priority };

    return (
        <span className="priority-badge" style={{ color: config.color }} title={lang === 'ar' ? config.ar : config.en}>
            {config.icon}
        </span>
    );
}
