import 'server-only';
import { createHmac } from 'crypto';

// Razorpay integration (server side). Feature-flagged on env: until
// RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET are set, payment endpoints return 503
// and the operator can grant entitlements manually from the Hire admin tab.

export function razorpayConfigured(): boolean {
  return !!process.env.RAZORPAY_KEY_ID && !!process.env.RAZORPAY_KEY_SECRET;
}

export function razorpayKeyId(): string {
  return process.env.RAZORPAY_KEY_ID ?? '';
}

/** Create an order. Amount in RUPEES (converted to paise here). */
export async function createRazorpayOrder(params: {
  amountInr: number;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<{ orderId: string } | { error: string }> {
  const key = process.env.RAZORPAY_KEY_ID!;
  const secret = process.env.RAZORPAY_KEY_SECRET!;
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      amount: Math.round(params.amountInr * 100),
      currency: 'INR',
      receipt: params.receipt.slice(0, 40),
      notes: params.notes ?? {}
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { error: `razorpay order failed: ${body.slice(0, 200) || res.status}` };
  }
  const j = (await res.json()) as { id: string };
  return { orderId: j.id };
}

/** Verify the checkout signature: HMAC-SHA256(order_id|payment_id, secret). */
export function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  return expected === signature;
}
