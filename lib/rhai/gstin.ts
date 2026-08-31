import 'server-only';

// GSTIN → client details. The GSTIN itself encodes the state (first two digits)
// and the PAN (chars 3–12), so we can ALWAYS derive the state — which is what
// drives CGST+SGST vs IGST on the invoice. Legal name and address need a
// verification provider; if GST_API_KEY is set we call Appyflow's verify API,
// otherwise we return what the number itself tells us and say so.

export const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
  '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh',
  '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur',
  '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal',
  '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
  '25': 'Daman & Diu', '26': 'Dadra & Nagar Haveli', '27': 'Maharashtra', '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka', '30': 'Goa', '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu',
  '34': 'Puducherry', '35': 'Andaman & Nicobar', '36': 'Telangana', '37': 'Andhra Pradesh',
  '38': 'Ladakh', '97': 'Other Territory'
};

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function validateGstin(gstin: string): boolean {
  return GSTIN_RE.test(gstin.trim().toUpperCase());
}

export interface GstinDetails {
  gstin: string;
  valid: boolean;
  stateCode: string;
  state: string;
  pan: string;
  legalName?: string;
  tradeName?: string;
  address?: string;
  status?: string;
  source: 'provider' | 'derived';
  note?: string;
}

export async function lookupGstin(raw: string): Promise<GstinDetails> {
  const gstin = raw.trim().toUpperCase();
  const valid = validateGstin(gstin);
  const stateCode = gstin.slice(0, 2);
  const base: GstinDetails = {
    gstin,
    valid,
    stateCode,
    state: GST_STATE_CODES[stateCode] ?? '',
    pan: gstin.slice(2, 12),
    source: 'derived'
  };
  if (!valid) {
    base.note = 'That does not look like a valid 15-character GSTIN.';
    return base;
  }

  const key = process.env.GST_API_KEY;
  if (!key) {
    base.note = 'State derived from the GSTIN. Add GST_API_KEY to auto-fill the legal name and address.';
    return base;
  }

  // Appyflow verify API — returns taxpayerInfo { lgnm, tradeNam, sts, pradr { adr } }.
  try {
    const res = await fetch(
      `https://appyflow.in/api/verifyGST?gstNo=${encodeURIComponent(gstin)}&key_secret=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(12000) }
    );
    const j = (await res.json()) as {
      error?: boolean | string;
      message?: string;
      taxpayerInfo?: { lgnm?: string; tradeNam?: string; sts?: string; pradr?: { adr?: string } };
    };
    const t = j.taxpayerInfo;
    if (t?.lgnm) {
      return {
        ...base,
        source: 'provider',
        legalName: t.lgnm,
        tradeName: t.tradeNam,
        address: t.pradr?.adr,
        status: t.sts
      };
    }
    base.note = typeof j.message === 'string' ? j.message : 'Provider returned no details; state derived from the GSTIN.';
    return base;
  } catch {
    base.note = 'Could not reach the GST provider; state derived from the GSTIN.';
    return base;
  }
}
