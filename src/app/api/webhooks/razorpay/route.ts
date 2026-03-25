import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { purchaseTokens } from '@/services/token-service';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-razorpay-signature');
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret || !signature) {
      console.error('[Webhook] Missing signature or secret configured.');
      return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 });
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.error('[Webhook] Invalid signature mismatch. Potential forged request.');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(rawBody);

    // Filter events we care about (order.paid is generally sent when a payment is captured for an order)
    if (event.event === 'order.paid' || event.event === 'payment.captured') {
      const order = event.payload?.order?.entity || event.payload?.payment?.entity?.order_id;
      // If it's payment.captured without an order entity included in the payload, 
      // we might just rely on order.paid instead. Razorpay usually sends both.
      // Easiest is to ensure we get notes from the order. If event is order.paid, order entity is full.
      if (event.event === 'order.paid') {
        const orderEntity = event.payload.order.entity;
        const paymentEntity = event.payload.payment.entity;
        const notes = orderEntity.notes || {};

        if (!notes.userId || !notes.tokenAmount || !notes.roleToCredit) {
          console.warn('[Webhook] Order missing required notes metadata. Possibly an older order format.');
          // Return 200 so Razorpay doesn't retry this bad request
          return NextResponse.json({ received: true, note: 'Missing metadata, ignored.' });
        }

        const result = await purchaseTokens({
          userId: notes.userId,
          tokenAmount: parseInt(notes.tokenAmount, 10),
          totalCost: orderEntity.amount / 100,
          currency: orderEntity.currency,
          actorName: 'Webhook Action', // Fallback, will be overridden by token-service DB lookup
          actorRole: 'user', // Fallback
          roleToCredit: notes.roleToCredit as 'owner' | 'visitor',
          premiseId: notes.premiseId || null,
          razorpay_order_id: orderEntity.id,
          razorpay_payment_id: paymentEntity.id,
          razorpay_signature: 'webhook-verified', // Bypassed by isWebhook
          isWebhook: true,
        });

        if (!result.success) {
          console.error('[Webhook] fulfillment failed:', result.error);
          // Crucial: if replay attack detected, we return 200 so Razorpay stops retrying.
          // The order is successfully fulfilled!
          if (result.error?.includes('Replay attack')) {
            return NextResponse.json({ received: true, status: 'Already fulfilled' });
          }
          // For real DB errors, return 400/500 so Razorpay retries again later
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        
        console.log(`[Webhook] Successfully fulfilled tokens for user ${notes.userId}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Webhook] processing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
