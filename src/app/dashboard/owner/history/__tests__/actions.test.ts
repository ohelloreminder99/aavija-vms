import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deductTokensForExport } from '../actions';
import * as serverUtils from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
    getAdminDb: vi.fn(),
    requireAuth: vi.fn(),
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

vi.mock('@/services/log-service', () => ({
    createLogEntry: vi.fn(),
}));

describe('owner history actions', () => {
    let mockBuilder: any;
    let mockAdminDb: any;

    const createMockBuilder = () => {
        const b: any = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            then: vi.fn(function (this: any, onFulfilled: any) {
                return Promise.resolve(onFulfilled({ data: this._data, error: this._error }));
            }),
            _data: null as any,
            _error: null as any,
            setResult: function (data: any, error: any = null) {
                this._data = data;
                this._error = error;
                return this;
            }
        };
        return b;
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockBuilder = createMockBuilder();
        mockAdminDb = {
            from: vi.fn(() => mockBuilder),
            rpc: vi.fn(() => mockBuilder),
        };
        (serverUtils.getAdminDb as any).mockResolvedValue(mockAdminDb);
    });

    describe('deductTokensForExport', () => {
        const validPremisePayload = {
            target: { type: 'premise' as const, id: 'premise-1' },
            actor_id: 'owner-1',
            actor_name: 'Owner One',
            actor_role: 'owner',
            exportType: 'csv' as const,
        };

        it('should deduct tokens from premise based on category cost', async () => {
            (serverUtils.requireAuth as any).mockResolvedValue({
                user: { id: 'owner-1' },
                profile: { role: 'owner', premise_roles: { 'premise-1': ['owner'] } }
            });

            // 1. fetch targetData (premise)
            // 2. fetch categoryData
            mockBuilder.then = vi.fn()
                .mockImplementationOnce((cb: any) => cb({ data: { id: 'premise-1', owner_id: 'owner-1', category_id: 'cat-1', token_balance: 50 }, error: null }))
                .mockImplementationOnce((cb: any) => cb({ data: { csv_export_cost: 5 }, error: null }))
                .mockImplementation((cb: any) => cb({ data: [], error: null }));

            const result = await deductTokensForExport(validPremisePayload);

            expect(result.success).toBe(true);
            expect(mockBuilder.update).toHaveBeenCalledWith({ token_balance: 45 });
        });

        it('should fail if balance is insufficient', async () => {
            (serverUtils.requireAuth as any).mockResolvedValue({
                user: { id: 'owner-1' },
                profile: { role: 'owner', premise_roles: { 'premise-1': ['owner'] } }
            });

            mockBuilder.then = vi.fn()
                .mockImplementationOnce((cb: any) => cb({ data: { id: 'premise-1', owner_id: 'owner-1', category_id: 'cat-1', token_balance: 2 }, error: null }))
                .mockImplementationOnce((cb: any) => cb({ data: { csv_export_cost: 5 }, error: null }));

            const result = await deductTokensForExport(validPremisePayload);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Insufficient tokens');
        });

        it('should deduct tokens from user for personal export', async () => {
            const userPayload = {
                target: { type: 'user' as const, id: 'user-1' },
                actor_id: 'user-1',
                actor_name: 'User One',
                actor_role: 'visitor',
                exportType: 'pdf' as const,
            };

            (serverUtils.requireAuth as any).mockResolvedValue({
                user: { id: 'user-1' },
                profile: { role: 'visitor' }
            });

            mockBuilder.then = vi.fn()
                .mockImplementationOnce((cb: any) => cb({ data: { id: 'user-1', token_balance_visitor: 20 }, error: null }))
                .mockImplementationOnce((cb: any) => cb({ data: { pdf_export_cost_visitor: 10 }, error: null }))
                .mockImplementation((cb: any) => cb({ data: [], error: null }));

            const result = await deductTokensForExport(userPayload);

            expect(result.success).toBe(true);
            expect(mockBuilder.update).toHaveBeenCalledWith({ token_balance_visitor: 10 });
        });
    });
});
