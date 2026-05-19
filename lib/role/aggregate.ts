import 'server-only';
import { adminDb } from '@/lib/firebase/admin';
import type { RoleClaim, RoleDoc } from '@/lib/model/role';

export interface RoleAggregate {
  rolesInvited: number;
  rolesStarted: number;
  rolesCompleted: number;
  // Aggregate of completed roles only. Each role contributes its translation %.
  averageTranslationShare: number | null;
  totalActivities: number;
  totalTranslationActivities: number;
  totalJudgementActivities: number;
  translationHeavyRoleCount: number; // > 60% translation
  judgementHeavyRoleCount: number;   // > 60% judgement
  // Roster: status + title + invitee email (or "—"). Substance is not exposed.
  roster: Array<{
    roleId: string;
    roleTitle: string;
    inviteeEmail: string | null;
    status: RoleDoc['status'];
    completedAt: number | null;
    inviteToken: string;
  }>;
}

export async function computeRoleAggregate(companyId: string): Promise<RoleAggregate> {
  const db = adminDb();
  const rolesSnap = await db
    .collection('companies')
    .doc(companyId)
    .collection('roles')
    .get();

  const roles = rolesSnap.docs.map(d => d.data() as RoleDoc);

  let totalActivities = 0;
  let totalTranslation = 0;
  let totalJudgement = 0;
  let translationHeavy = 0;
  let judgementHeavy = 0;
  const completedShares: number[] = [];

  for (const role of roles) {
    if (role.status !== 'completed') continue;
    const claimsSnap = await db
      .collection('companies')
      .doc(companyId)
      .collection('roles')
      .doc(role.roleId)
      .collection('claims')
      .get();
    const live = claimsSnap.docs
      .map(d => d.data() as RoleClaim)
      .filter(c => c.supersededBy === null);
    const activities = live.filter(c => c.kind === 'role_activity');
    if (activities.length === 0) continue;

    let tr = 0;
    let jd = 0;
    for (const a of activities) {
      if (a.content.classification === 'translation') tr++;
      else if (a.content.classification === 'judgement') jd++;
    }
    const total = tr + jd;
    if (total === 0) continue;
    totalActivities += total;
    totalTranslation += tr;
    totalJudgement += jd;
    const share = tr / total;
    completedShares.push(share);
    if (share > 0.6) translationHeavy++;
    if (jd / total > 0.6) judgementHeavy++;
  }

  return {
    rolesInvited: roles.length,
    rolesStarted: roles.filter(r => r.status !== 'pending').length,
    rolesCompleted: roles.filter(r => r.status === 'completed').length,
    averageTranslationShare:
      completedShares.length > 0
        ? completedShares.reduce((a, b) => a + b, 0) / completedShares.length
        : null,
    totalActivities,
    totalTranslationActivities: totalTranslation,
    totalJudgementActivities: totalJudgement,
    translationHeavyRoleCount: translationHeavy,
    judgementHeavyRoleCount: judgementHeavy,
    roster: roles
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(r => ({
        roleId: r.roleId,
        roleTitle: r.roleTitle,
        inviteeEmail: r.inviteeEmail,
        status: r.status,
        completedAt: r.completedAt,
        inviteToken: r.inviteToken
      }))
  };
}
