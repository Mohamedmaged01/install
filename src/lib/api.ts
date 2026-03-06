export const API_BASE = 'https://apiorders.runasp.net';

// ==================== TOKEN MANAGEMENT ====================

export function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('auth_token');
}

export function setToken(token: string): void {
    localStorage.setItem('auth_token', token);
}

export function removeToken(): void {
    localStorage.removeItem('auth_token');
}

// ==================== HTTP CLIENT ====================

interface RequestOptions {
    method?: string;
    body?: unknown;
    params?: Record<string, string | number | undefined | null>;
    isFormData?: boolean;
}

export async function api<T = unknown>(
    endpoint: string,
    options: RequestOptions = {}
): Promise<T> {
    const { method = 'GET', body, params, isFormData = false } = options;

    // Build URL with query params
    let url = `${API_BASE}${endpoint}`;
    if (params) {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                searchParams.append(key, String(value));
            }
        });
        const qs = searchParams.toString();
        if (qs) url += `?${qs}`;
    }

    // Build headers
    const headers: Record<string, string> = {};
    const token = getToken();
    if (token && token !== 'undefined' && token !== 'null') {
        headers['Authorization'] = `Bearer ${token}`;
    }
    if (!isFormData) {
        headers['Content-Type'] = 'application/json';
    }

    // Build fetch options
    const fetchOptions: RequestInit = {
        method,
        headers,
    };

    if (body) {
        fetchOptions.body = isFormData ? (body as FormData) : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    // Handle 401
    if (response.status === 401) {
        removeToken();
        if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_user');
        }
        const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
        if (typeof window !== 'undefined' && currentPath !== '/login') {
            window.location.href = '/login';
        }
        throw new Error('Unauthorized');
    }

    // Handle 403 — user is authenticated but lacks permission
    if (response.status === 403) {
        throw new Error(
            'Access denied (403) — your account does not have permission to perform this action. ' +
            'Ask an administrator to assign the correct role or permissions.'
        );
    }

    // Handle no-content responses
    if (response.status === 204 || response.headers.get('content-length') === '0') {
        return {} as T;
    }

    // Parse response
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
        let errorMessage = `API Error: ${response.status}`;
        try {
            if (contentType.includes('application/json')) {
                const errorData = await response.json();
                if (errorData && typeof errorData === 'object' && 'succeeded' in errorData) {
                    errorMessage = errorData.message || errorMessage;
                } else {
                    errorMessage = errorData.message || errorData.title || JSON.stringify(errorData);
                }
            } else {
                errorMessage = await response.text();
            }
        } catch {
            // Use default error message
        }
        throw new Error(errorMessage);
    }

    if (contentType.includes('application/json')) {
        const json = await response.json();
        console.debug('[API response]', json); // debug: remove after issue is resolved
        if (json && typeof json === 'object' && ('succeeded' in json || 'isSuccess' in json)) {
            const success = 'isSuccess' in json ? json.isSuccess : json.succeeded;
            if (!success) {
                // Extract the most useful error description available
                const msg =
                    (typeof json.message === 'string' && json.message.trim()) ||
                    (Array.isArray(json.errors) && json.errors.length > 0 ? json.errors.join(', ') : null) ||
                    (typeof json.error === 'string' && json.error.trim()) ||
                    (typeof json.title === 'string' && json.title.trim()) ||
                    `Request failed (status: ${response.status})`;
                throw new Error(msg as string);
            }
            return json.data as T;
        }
        return json;
    }

    return (await response.text()) as unknown as T;
}
