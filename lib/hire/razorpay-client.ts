'use client';

// Client-side Razorpay checkout. Loads checkout.js on demand and opens the
// payment sheet; resolves with the verification payload on success.

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadScript(): Promise<boolean> {
  return new Promise(resolve => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export async function openRazorpay(params: {
  keyId: string;
  orderId: string;
  amountInr: number;
  label: string;
  email?: string;
}): Promise<RazorpayResponse | null> {
  const ok = await loadScript();
  if (!ok || !window.Razorpay) return null;
  return new Promise(resolve => {
    const rzp = new window.Razorpay!({
      key: params.keyId,
      order_id: params.orderId,
      amount: Math.round(params.amountInr * 100),
      currency: 'INR',
      name: 'Rhai Interviews',
      description: params.label,
      prefill: params.email ? { email: params.email } : {},
      theme: { color: '#c64a1f' },
      handler: (res: RazorpayResponse) => resolve(res),
      modal: { ondismiss: () => resolve(null) }
    });
    rzp.open();
  });
}
