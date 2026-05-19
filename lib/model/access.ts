import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import type { CompanyDoc } from './claims';

export interface CompanyAccess {
  companyId: string;
  company: CompanyDoc;
  canEdit: boolean;
  isOwner: boolean;
  isAnonymousSessionMatch: boolean;
}

export async function loadCompanyForAccess(opts: {
  companyId: string;
  uid: string | null;
  sessionId: string | null;
}): Promise<CompanyAccess | null> {
  const snap = await adminDb().collection('companies').doc(opts.companyId).get();
  if (!snap.exists) return null;
  const company = snap.data() as CompanyDoc;

  const isOwner = !!opts.uid && company.ownerUid === opts.uid;
  const isAnonymousSessionMatch =
    company.ownerUid === null && !!opts.sessionId && company.sessionId === opts.sessionId;

  return {
    companyId: opts.companyId,
    company,
    canEdit: isOwner || isAnonymousSessionMatch,
    isOwner,
    isAnonymousSessionMatch
  };
}
