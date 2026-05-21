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
  // Source-of-truth documents named across roles. Deduplicated. This IS the
  // company's operating spine. Shown on the profile and fed to projects.
  // No per-role attribution exposed — only the deduplicated list.
  sourceOfTruthDocs: Array<{ name: string; mentionCount: number }>;
  // Roster: status + title + invitee email + (for completed roles) the
  // translation share so the owner can see at-a-glance which roles skew
  // automatable. Substance (raw activity quotes) is NOT exposed.
  roster: Array<{
    roleId: string;
    roleTitle: string;
    inviteeEmail: string | null;
    status: RoleDoc['status'];
    completedAt: number | null;
    inviteToken: string;
    translationShare: number | null; // 0..1 if completed, null otherwise
    totalActivities: number;
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
  const docCounts = new Map<string, number>();
  // Per-role splits, keyed by roleId, populated only for completed roles.
  const perRole = new Map<string, { translationShare: number; total: number }>();

  for (const role of roles) {
    if (role.sourceOfTruthDoc && role.sourceOfTruthDoc.trim()) {
      // Normalize for dedup: lowercase + collapse whitespace. Display uses the
      // first-seen casing.
      const raw = role.sourceOfTruthDoc.trim();
      const key = raw.toLowerCase().replace(/\s+/g, ' ');
      docCounts.set(key, (docCounts.get(key) ?? 0) + 1);
    }
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
    perRole.set(role.roleId, { translationShare: share, total });
    if (share > 0.6) translationHeavy++;
    if (jd / total > 0.6) judgementHeavy++;
  }

  // Build the deduplicated source-of-truth list, keeping the first-seen
  // casing for display.
  const firstSeenCasing = new Map<string, string>();
  for (const role of roles) {
    const raw = role.sourceOfTruthDoc?.trim();
    if (!raw) continue;
    const key = raw.toLowerCase().replace(/\s+/g, ' ');
    if (!firstSeenCasing.has(key)) firstSeenCasing.set(key, raw);
  }
  const sourceOfTruthDocs = [...docCounts.entries()]
    .map(([key, count]) => ({ name: firstSeenCasing.get(key) ?? key, mentionCount: count }))
    .sort((a, b) => b.mentionCount - a.mentionCount);

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
    sourceOfTruthDocs,
    roster: roles
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(r => {
        const split = perRole.get(r.roleId);
        return {
          roleId: r.roleId,
          roleTitle: r.roleTitle,
          inviteeEmail: r.inviteeEmail,
          status: r.status,
          completedAt: r.completedAt,
          inviteToken: r.inviteToken,
          translationShare: split?.translationShare ?? null,
          totalActivities: split?.total ?? 0
        };
      })
  };
}
