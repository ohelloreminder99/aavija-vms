import { describe, it, expect, vi, beforeEach } from 'vitest';
import { purchaseTokens } from '../token-service';
import * as serverUtils from '@/lib/supabase/server';
import * as paymentService from '../payment-service';

// Mock everything
vi.mock('@/lib/supabase/server', () => ({
    getAdminDb: vi.fn(),
    createClient: vi.fn(),
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));

vi.mock('../referral-service', () => ({
    fireReferralCommission: vi.fn(),
}));

vi.mock('../payment-service', () => ({
    verifyRazorpayPayment: vi.fn(),
}));

const mockRazorpayInstance = {
    orders: {
        fetch: vi.fn(),
    },
};

vi.mock('razorpay', () => ({
    default: vi.fn().mockImplementation(function () {
        return mockRazorpayInstance;
    }),
}));

describe('token-service', () => {
    let mockBuilder: any;
    let mockAdminDb: any;
    let mockSupabase: any;

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
        mockSupabase = {
            auth: {
                getUser: vi.fn(),
            },
        };
        (serverUtils.getAdminDb as any).mockResolvedValue(mockAdminDb);
        (serverUtils.createClient as any).mockResolvedValue(mockSupabase);
    });

    describe('purchaseTokens', () => {
        const validPayload = {
            user_id: 'user-123',
            token_amount: 100,
            totalCost: 100,
            currency: 'INR',
            actor_name: 'Test User',
            actor_role: 'owner',
            roleToCredit: 'owner' as const,
            premise_id: 'premise-123',
            razorpay_order_id: 'order_123',
            razorpay_payment_id: 'pay_123',
            razorpay_signature: 'sig_123',
        };

        it('should fail if user is unauthorized', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'other-user' } }, error: null });
            const result = await purchaseTokens(validPayload);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Unauthorized');
        });

        it('should fail if token amount is zero or negative', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
            const result = await purchaseTokens({ ...validPayload, token_amount: 0 });
            expect(result.success).toBe(false);
            expect(result.error).toContain('Token amount must be positive');
        });

        it('should fail if Razorpay signature verification fails', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });
            mockBuilder.setResult(null); // No existing invoice
            (paymentService.verifyRazorpayPayment as any).mockResolvedValue({ success: false, error: 'Invalid sig' });

            const result = await purchaseTokens(validPayload);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid sig');
        });

        it('should successfully purchase tokens for owner', async () => {
            mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });

            // Manage multiple calls to single()
            mockBuilder.single = vi.fn()
                .mockImplementationOnce(() => Promise.resolve({ data: null, error: null })) // existing invoice check
                .mockImplementationOnce(() => Promise.resolve({ data: { token_exchange_rate: 1, agent_commission_rate: 10, company_state_billing: 'State1' }, error: null })) // settings
                .mockImplementationOnce(() => Promise.resolve({ data: { email: 'test@example.com', billing_state: 'State1' }, error: null })) // user
                .mockImplementationOnce(() => Promise.resolve({ data: { name: 'Test Premise', agent_id: 'agent-123' }, error: null })) // premise
                .mockImplementationOnce(() => Promise.resolve({ data: { name: 'Agent User' }, error: null })); // agent

            mockBuilder.setResult([], null);
            (paymentService.verifyRazorpayPayment as any).mockResolvedValue({ success: true });
            mockRazorpayInstance.orders.fetch.mockResolvedValue({ amount: 11800, status: 'paid' });

            const result = await purchaseTokens(validPayload);

            expect(result.success).toBe(true);
            expect(mockAdminDb.from).toHaveBeenCalledWith('premises');
            expect(mockAdminDb.from).toHaveBeenCalledWith('invoices');
        });
    });
});
