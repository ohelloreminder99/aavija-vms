import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitRatingAndRecalculate } from '../actions';
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

describe('host actions', () => {
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
            rpc: vi.fn(() => Promise.resolve({ error: null })),
        };
        (serverUtils.getAdminDb as any).mockResolvedValue(mockAdminDb);
    });

    describe('submitRatingAndRecalculate', () => {
        const validData = {
            visit_id: 'visit-1',
            visitor_id: 'visitor-1',
            host_id: 'host-1',
            premise_id: 'premise-1',
            rating: 5,
            actor: { id: 'host-1', name: 'Host One', role: 'host' },
        };

        it('should fail if rating is out of range', async () => {
            const result = await submitRatingAndRecalculate({ ...validData, rating: 6 });
            expect(result.success).toBe(false);
            expect(result.error).toBe('Rating must be between 1 and 5.');
        });

        it('should fail if user is not the host', async () => {
            (serverUtils.requireAuth as any).mockResolvedValue({ user: { id: 'other-id' } });
            const result = await submitRatingAndRecalculate(validData);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Unauthorized');
        });

        it('should successfully submit rating and recalculate global rating', async () => {
            (serverUtils.requireAuth as any).mockResolvedValue({ user: { id: 'host-1' } });

            // 1. rating exist check -> empty
            // 2. settings -> star_rating_cost: 10
            // 3. all ratings -> [{rating: 4}]
            mockBuilder.then = vi.fn()
                .mockImplementationOnce((cb: any) => cb({ data: [], error: null })) // exist check
                .mockImplementationOnce((cb: any) => cb({ data: { star_rating_cost: 10 }, error: null })) // settings (via single)
                .mockImplementationOnce((cb: any) => cb({ data: [{ rating: 4 }], error: null })) // all ratings
                .mockImplementation((cb: any) => cb({ data: [], error: null })); // others

            const result = await submitRatingAndRecalculate(validData);

            expect(result.success).toBe(true);
            expect(mockBuilder.update).toHaveBeenCalledWith({ global_rating: 4.5 });
            expect(mockAdminDb.rpc).toHaveBeenCalledWith('deduct_user_tokens', { p_user_id: 'host-1', p_amount: 10 });
        });

        it('should prevent double rating for same visit', async () => {
            (serverUtils.requireAuth as any).mockResolvedValue({ user: { id: 'host-1' } });
            mockBuilder.setResult([{ id: 'existing' }]);

            const result = await submitRatingAndRecalculate(validData);
            expect(result.success).toBe(false);
            expect(result.error).toContain('already been submitted');
        });
    });
});
