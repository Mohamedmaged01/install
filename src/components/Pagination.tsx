'use client';

import { useLang } from '@/context/LanguageContext';

interface PaginationProps {
    currentPage: number;
    totalItems: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
    pageSizeOptions?: number[];
}

export default function Pagination({
    currentPage,
    totalItems,
    pageSize,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [10, 25, 50, 100],
}: PaginationProps) {
    const { t } = useLang();
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
    const end = Math.min(currentPage * pageSize, totalItems);

    const getVisiblePages = (): (number | '...')[] => {
        if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
        const pages: (number | '...')[] = [];
        pages.push(1);
        if (currentPage > 3) pages.push('...');
        const rangeStart = Math.max(2, currentPage - 1);
        const rangeEnd = Math.min(totalPages - 1, currentPage + 1);
        for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
        if (currentPage < totalPages - 2) pages.push('...');
        if (totalPages > 1) pages.push(totalPages);
        return pages;
    };

    return (
        <div className="pagination-container">
            <div className="pagination-info">
                {t(
                    `Showing ${start}–${end} of ${totalItems}`,
                    `عرض ${start}–${end} من ${totalItems}`
                )}
                {onPageSizeChange && (
                    <select
                        className="pagination-size-select"
                        value={pageSize}
                        onChange={e => {
                            onPageSizeChange(Number(e.target.value));
                            onPageChange(1);
                        }}
                    >
                        {pageSizeOptions.map(size => (
                            <option key={size} value={size}>
                                {size} / {t('page', 'صفحة')}
                            </option>
                        ))}
                    </select>
                )}
            </div>
            {totalPages > 1 && (
                <div className="pagination-buttons">
                    <button
                        className="pagination-btn"
                        disabled={currentPage === 1}
                        onClick={() => onPageChange(currentPage - 1)}
                        aria-label="Previous page"
                    >
                        ‹
                    </button>
                    {getVisiblePages().map((page, idx) =>
                        page === '...' ? (
                            <span key={`dots-${idx}`} className="pagination-dots">…</span>
                        ) : (
                            <button
                                key={page}
                                className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                                onClick={() => onPageChange(page)}
                            >
                                {page}
                            </button>
                        )
                    )}
                    <button
                        className="pagination-btn"
                        disabled={currentPage === totalPages}
                        onClick={() => onPageChange(currentPage + 1)}
                        aria-label="Next page"
                    >
                        ›
                    </button>
                </div>
            )}
        </div>
    );
}
