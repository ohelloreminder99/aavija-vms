'use server';

import Razorpay from 'razorpay';
import crypto from 'crypto';

interface CreateOrderPayload {
  amount: number; // Amount in the smallest currency unit (e.g., paise for INR)
  currency: string;
  token_amount: number;
  user_id: string;
  roleToCredit: 'owner' | 'visitor';
  premiseId?: string | null;
  appCheckToken?: string;
}

export async function createRazorpayOrder(payload: CreateOrderPayload): Promise<{
  success: boolean;
  order?: { id: string; amount: number; currency: string };
  error?: string;
}> {
  const { amount, currency, token_amount: tokenAmount, user_id: userId, roleToCredit, premiseId } = payload;
  try {
    const { NEXT_PUBLIC_RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;

    if (!NEXT_PUBLIC_RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return {
        success: false,
        error: 'Razorpay API keys are not configured on the server.',
      };
    }

    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    
    // --- SECURITY CHECK: IDOR PREVENTION ---
    // Ensure the client isn't trying to forge an order for someone else's ID in the notes
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user || authData.user.id !== userId) {
      return { success: false, error: 'Unauthorized: User ID mismatch during order creation.' };
    }

    const { data: settings } = await supabase.from('settings').select('razorpay_key_id').eq('id', 'global').single();
    const key_id = settings?.razorpay_key_id || NEXT_PUBLIC_RAZORPAY_KEY_ID;

    const razorpay = new Razorpay({
      key_id,
      key_secret: RAZORPAY_KEY_SECRET,
    });

    const options = {
      amount,
      currency,
      receipt: `receipt_order_${new Date().getTime()}`,
      notes: {
        userId,
        token_amount: String(tokenAmount),
        roleToCredit,
        ...(premiseId ? { premiseId } : {})
      }
    };

    const order = await razorpay.orders.create(options);
    return {
      success: true,
      order: {
        id: order.id,
        amount: order.amount as number,
        currency: order.currency,
      },
    };
  } catch (error: any) {
    console.error('Razorpay order creation failed:', error);
    return {
      success: false,
      error: error.message || 'Failed to create Razorpay order.',
    };
  }
}

interface VerifyPaymentPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export async function verifyRazorpayPayment(payload: VerifyPaymentPayload): Promise<{
  success: boolean;
  error?: string;
}> {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
  } = payload;
  const { RAZORPAY_KEY_SECRET } = process.env;

  if (!RAZORPAY_KEY_SECRET) {
    return {
      success: false,
      error: 'Razorpay Key Secret is not configured on the server.',
    };
  }

  try {
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpay_signature) {
      return { success: true };
    } else {
      return { success: false, error: 'Signature verification failed.' };
    }
  } catch (error: any) {
    console.error('Razorpay payment verification failed:', error);
    return {
      success: false,
      error: error.message || 'An error occurred during verification.',
    };
  }
}
