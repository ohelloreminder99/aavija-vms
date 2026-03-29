'use server';

import { getAdminDb } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { LogAction } from './log-actions';
import { fireReferralCommission } from './referral-service';
import { notifyThresholdReached } from './whatsapp-service';

interface PurchaseTokensPayload {
  userId: string;
  tokenAmount: number;
  totalCost: number;
  currency: string;
  actorName: string;
  actorRole: string;
  roleToCredit: 'visitor' | 'owner';
  premiseId?: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  isWebhook?: boolean;
}

/**
 * Handles the purchase of tokens, credits the appropriate balance, 
 * generates an invoice, and calculates/credits agent commission.
 */
export async function purchaseTokens(
  payload: PurchaseTokensPayload
): Promise<{ success: boolean; error?: string }> {
  const {
    userId,
    tokenAmount,
    currency,
    actorName,
    actorRole,
    roleToCredit,
    premiseId,
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    isWebhook,
  } = payload;

  console.log(`Starting token purchase fulfillment for user: ${userId}, amount: ${tokenAmount}, order: ${razorpay_order_id}`);

  try {
    const { ensureNotMaintenanceMode } = await import('./settings-server');
    await ensureNotMaintenanceMode();

    // --- STEP 0: SECURITY IDENTIFICATION (IDOR PROTECTION) ---
    const { createClient } = await import('@/lib/supabase/server');
    if (!isWebhook) {
      const supabase = await createClient();
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user || authData.user.id !== userId) {
        throw new Error('Unauthorized: You can only purchase tokens for your own account.');
      }
    }

    const adminDb = await getAdminDb();
    if (!adminDb) {
      throw new Error('Admin database not available.');
    }

    if (tokenAmount <= 0) {
      throw new Error('Token amount must be positive.');
    }

    // --- STEP 0.1: REPLAY PROTECTION ---
    const { data: existingInvoice } = await adminDb
      .from('invoices')
      .select('id')
      .eq('razorpay_order_id', razorpay_order_id)
      .maybeSingle();

    if (existingInvoice) {
      console.log(`[Tokens] Order ${razorpay_order_id} already fulfilled. Skipping.`);
      return { success: true, alreadyFulfilled: true };
    }

    // --- STEP 0.2: RAZORPAY SIGNATURE VERIFICATION ---
    if (!isWebhook) {
      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(body.toString())
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        return { success: false, error: 'Invalid payment signature. Potential fraud detected.' };
      }
    }

    // --- STEP 1: PERFORM ALL READS FIRST ---
    const { data: settingsData } = await adminDb.from('settings')
      .select('agent_commission_rate, gst_rate, cgst_rate_default, sgst_rate_default, igst_rate_default, starting_token_owner, starting_token_visitor, currency, token_exchange_rate, company_gstin, company_name_billing, company_address_billing, company_state_billing, hsn_sac_code, hide_token_economy, log_ttl_days, payout_threshold_agent')
      .eq('id', 'global').single();
    // GUARD: If settings are unavailable, calculations would use 0 as the rate,
    // which would make tokens free and generate incorrect invoices.
    // Fail loudly rather than silently process a broken transaction.
    if (!settingsData) throw new Error('System configuration (settings) is unavailable. Purchase aborted for safety. Please try again.');

    const { data: userData } = await adminDb.from('users')
      .select('id, name, email, phone, city_state, gstNumber, billingAddress, billingState, legalName, token_balance_visitor, premise_roles')
      .eq('id', userId).single();
    if (!userData) throw new Error("User profile not found.");

    let premiseData = null;
    let agentData = null;

    if (roleToCredit === 'owner' && premiseId) {
      const { data: pData } = await adminDb.from('premises')
        .select('id, name, token_balance, agent_id, owner_id, billingState, city_state, gstNumber, billingAddress, legalName')
        .eq('id', premiseId).single();
      if (!pData) throw new Error("Premise not found.");
      premiseData = pData;

      const agentId = pData.agent_id;
      const commissionRate = settingsData.agent_commission_rate || 0;

      if (agentId && commissionRate > 0) {
        const { data: aData } = await adminDb.from('agents')
          .select('id, name, commission_balance')
          .eq('id', agentId).single();
        agentData = aData;
      }
    }

    const invoiceId = `INV-${crypto.randomUUID()}`;

    // --- STEP 2: CALCULATIONS & ANTI-SPOOFING VERIFICATION ---
    let userState = 'Unknown';
    let customerGstin = '';
    let customerBillingAddress = '';
    let customerLegalName = '';
    let targetPremiseName = '';
    let logDescription = '';
    
    // Webhooks might not have the correct actorName in the payload, so fallback to the DB name
    const finalActorName = isWebhook ? (userData.name || actorName) : actorName;

    if (roleToCredit === 'owner' && premiseData) {
      userState = premiseData.billingState || premiseData.city_state || 'Unknown';
      customerGstin = premiseData.gstNumber || '';
      customerBillingAddress = premiseData.billingAddress || '';
      customerLegalName = premiseData.legalName || premiseData.name || finalActorName;
      targetPremiseName = premiseData.name || 'Premise';
      logDescription = `Purchased ${tokenAmount.toLocaleString()} tokens for premise "${targetPremiseName}". Invoice: ${invoiceId}`;
    } else {
      userState = userData.billingState || userData.city_state || 'Unknown';
      customerGstin = userData.gstNumber || '';
      customerBillingAddress = userData.billingAddress || '';
      customerLegalName = userData.legalName || userData.name || finalActorName;
      logDescription = `Purchased ${tokenAmount.toLocaleString()} tokens for visitor balance. Invoice: ${invoiceId}`;
    }

    const companyState = settingsData.company_state_billing || 'Maharashtra';
    const isSameState = userState.toLowerCase() === companyState.toLowerCase();
    const ratePerToken = settingsData.token_exchange_rate || 0;
    const subtotal = tokenAmount * ratePerToken;

    let cgst = 0, sgst = 0, igst = 0;
    let cgstRate = 0, sgstRate = 0, igstRate = 0;

    if (isSameState) {
      cgstRate = settingsData.cgst_rate_default || 9;
      sgstRate = settingsData.sgst_rate_default || 9;
      cgst = subtotal * (cgstRate / 100);
      sgst = subtotal * (sgstRate / 100);
    } else {
      igstRate = settingsData.igst_rate_default || 18;
      igst = subtotal * (igstRate / 100);
    }

    const expectedTotalInPaise = Math.round((subtotal + cgst + sgst + igst) * 100);

    // Fetch the live Razorpay Order to guarantee the client actually paid exactly what is mathematically required
    const Razorpay = (await import('razorpay')).default;
    const razorpay = new Razorpay({
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const liveOrder = await razorpay.orders.fetch(razorpay_order_id);
    if (!liveOrder || liveOrder.amount !== expectedTotalInPaise || liveOrder.status !== 'paid') {
      throw new Error(`Critical spoofing alert: Order amount mismatch or unpaid. Required: ${expectedTotalInPaise}, Found: ${liveOrder?.amount}`);
    }

    // --- STEP 3: PERFORM ALL WRITES ---

    // 1. Credit Balance
    if (roleToCredit === 'owner' && premiseData) {
      const newBalance = (premiseData.token_balance || 0) + tokenAmount;
      await adminDb.from('premises').update({ token_balance: newBalance }).eq('id', premiseId);
    } else {
      const newBalance = (userData.token_balance_visitor || 0) + tokenAmount;
      await adminDb.from('users').update({ token_balance_visitor: newBalance }).eq('id', userId);
    }

    // 2. Process Agent Commission — atomic increment via RPC (Phase 2B)
    const commissionRate = settingsData.agent_commission_rate || 0;
    if (roleToCredit === 'owner' && agentData && commissionRate > 0) {
      const commissionAmount = subtotal * (commissionRate / 100);
      try {
        // rpc_credit_agent_commission does atomic: UPDATE users SET agent_commission_balance = agent_commission_balance + amount
        await adminDb.rpc('rpc_credit_agent_commission', {
          p_agent_user_id: agentData.id,
          p_commission_amount: commissionAmount,
        });
        // Keep legacy agent_ledger entry for the ledger/history page
        await adminDb.from('agent_ledger').insert({
          agent_id: agentData.id,
          timestamp: new Date().toISOString(),
          type: 'credit',
          amount: commissionAmount,
          description: `Commission from ${targetPremiseName}'s purchase of ${tokenAmount.toLocaleString()} tokens.`,
          context: { premiseId, premiseName: targetPremiseName, purchaseAmount: tokenAmount, invoiceId },
        });
        // Check if new balance reaches threshold (₹500 for agents too by default)
        const { data: updatedAgent } = await adminDb
          .from('users')
          .select('name, phone, agent_commission_balance')
          .eq('id', agentData.id)
          .single();

        if (updatedAgent?.phone) {
          const threshold = settingsData?.payout_threshold_agent ?? 500; // Configurable in Admin > Token Settings
          if (updatedAgent.agent_commission_balance >= threshold && (updatedAgent.agent_commission_balance - commissionAmount) < threshold) {
            void notifyThresholdReached({
              phone: updatedAgent.phone,
              name: updatedAgent.name || 'Agent',
              balance: String(updatedAgent.agent_commission_balance),
            });
          }
        }
      } catch (commErr: any) {
        console.error('[Agent Commission] Credit failed (non-fatal):', commErr.message);
      }
    }

    // 3. Create Invoice
    const { error: invoiceError } = await adminDb.from('invoices').insert({
      id: invoiceId,
      userId,
      userName: customerLegalName,
      userEmail: userData.email || '',
      userPhone: userData.phone || '',
      userState,
      premiseId: roleToCredit === 'owner' ? (premiseId || null) : null,
      tokenAmount,
      subtotal,
      totalAmount: (subtotal + cgst + sgst + igst),
      cgst,
      sgst,
      igst,
      cgstRate,
      sgstRate,
      igstRate,
      currency,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
      hsnSacCode: settingsData.hsn_sac_code || '997331',
      companyGstin: settingsData.company_gstin || '',
      companyName: settingsData.company_name_billing || '',
      companyAddress: settingsData.company_address_billing || '',
      status: 'paid',
      customerGstin,
      customerBillingAddress,
      razorpay_order_id
    }).throwOnError();

    // 4. Create Audit Log
    const logTtlDays = settingsData.log_ttl_days;
    const now = new Date();
    let expiresAt: string | undefined = undefined;
    if (logTtlDays && Number.isInteger(logTtlDays) && logTtlDays > 0) {
      expiresAt = new Date(now.getTime() + logTtlDays * 24 * 60 * 60 * 1000).toISOString();
    }

    await adminDb.from('logs').insert({
      actorId: userId,
      actorName: actorName,
      actorRole: actorRole,
      action: LogAction.TOKEN_PURCHASE,
      description: logDescription,
      tokenChange: tokenAmount,
      timestamp: now.toISOString(),
      ...(expiresAt && { expiresAt }),
      ...(roleToCredit === 'owner' && premiseId ? { premiseId } : {}),
      context: {
        invoiceId,
        ...(roleToCredit === 'owner' && premiseId ? { premiseId } : {}),
      },
    }).throwOnError();

    console.log(`Token purchase fulfillment successful for user: ${userId}`);

    // 5. Fire referral commission (non-fatal — must NOT roll back a successful purchase)
    // Called LAST so any error here doesn't affect the confirmed payment.
    await fireReferralCommission(userId, tokenAmount, subtotal);

    revalidatePath(`/dashboard/owner`);
    revalidatePath(`/dashboard/visitor`);

    return { success: true };
  } catch (e: any) {
    console.error('Error in purchaseTokens fulfillment:', e);
    return { success: false, error: e.message || 'An unknown error occurred during the transaction.' };
  }
}
