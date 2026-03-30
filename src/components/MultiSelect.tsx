'use client';

import { useRef, useState, useEffect } from 'react';

interface Option {
    id: number;
    name: string;
}

interface MultiSelectProps {
    options: Option[];
    value: number[];
    onChange: (ids: number[]) => void;
    placeholder: string;
    style?: React.CSSProperties;
}

export default function MultiSelect({ options, value, onChange, placeholder, style }: MultiSelectProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    const selected = options.filter(o => value.includes(o.id));
    const label =
        selected.length === 0
            ? placeholder
            : selected.length === 1
            ? selected[0].name
            : `${selected.length} selected`;

    const toggle = (id: number) =>
        onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);

    return (
        <div ref={ref} style={{ position: 'relative', minWidth: 160, ...style }}>
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                    padding: '7px 12px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    color: selected.length === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                    fontSize: 14,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                <span style={{ fontSize: 10, opacity: 0.6, flexShrink: 0, transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }}>▼</span>
            </button>

            {open && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    minWidth: '100%',
                    zIndex: 200,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                    maxHeight: 260,
                    overflowY: 'auto',
                }}>
                    {value.length > 0 && (
                        <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)' }}>
                            <button
                                type="button"
                                onClick={() => onChange([])}
                                style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                            >
                                Clear all
                            </button>
                        </div>
                    )}
                    {options.length === 0 ? (
                        <div style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: 13 }}>No options</div>
                    ) : (
                        options.map(opt => {
                            const checked = value.includes(opt.id);
                            return (
                                <label
                                    key={opt.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '9px 14px',
                                        cursor: 'pointer',
                                        fontSize: 13,
                                        background: checked ? 'rgba(99,102,241,0.08)' : undefined,
                                        fontWeight: checked ? 600 : 400,
                                        color: checked ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        transition: 'background 100ms',
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggle(opt.id)}
                                        style={{ accentColor: '#6366f1', flexShrink: 0 }}
                                    />
                                    {opt.name}
                                </label>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
