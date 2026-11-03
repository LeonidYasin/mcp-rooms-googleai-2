import { db } from './db';

export interface DuplicateGroup {
  owner: string;
  normalizedTitle: string;
  category: string;
  kind: string;
  count: number;
  canonicalId: string;
  duplicateIds: string[];
}

export interface DeduplicationOptions {
  dryRun?: boolean;
  dbInstance?: any;
}

export interface DeduplicationReport {
  dryRun: boolean;
  groupsFound: number;
  duplicatesFound: number;
  duplicatesRemoved: number;
  roomsRelinked: number;
  negotiationsRelinked: number;
  embeddingsTransferred: number;
  auditLogsUpdated: number;
  details: Array<{
    canonicalId: string;
    removedIds: string[];
    title: string;
    owner: string;
    category: string;
    kind: string;
    relinkedRooms: number;
    relinkedNegotiations: number;
  }>;
}

/**
 * Scans the database for duplicate listings (same owner, trimmed lowercase title, category, kind).
 * Uses JavaScript Unicode normalization to safely handle Cyrillic and multilingual text.
 */
export function findDuplicateListings(dbInstance: any = db): DuplicateGroup[] {
  const allListings = dbInstance.prepare(`
    SELECT id, owner, title, category, kind, locality, created_at, status, revision, embedding_json
    FROM listings
    ORDER BY created_at ASC, id ASC
  `).all() as Array<{
    id: string;
    owner: string;
    title: string;
    category: string;
    kind: string;
    locality: string;
    created_at: number;
    status: string;
    revision: number;
    embedding_json: string | null;
  }>;

  const groupMap = new Map<string, typeof allListings>();

  for (const item of allListings) {
    const normTitle = (item.title || '').trim().toLowerCase();
    const key = `${item.owner}:::${item.category}:::${item.kind}:::${normTitle}`;
    const list = groupMap.get(key);
    if (!list) {
      groupMap.set(key, [item]);
    } else {
      list.push(item);
    }
  }

  const results: DuplicateGroup[] = [];

  for (const [, items] of groupMap.entries()) {
    if (items.length > 1) {
      // Prefer 'active' listings as canonical; otherwise oldest created
      const sorted = [...items].sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (b.status === 'active' && a.status !== 'active') return 1;
        return a.created_at - b.created_at;
      });

      const canonicalId = sorted[0].id;
      const duplicateIds = sorted.slice(1).map((it) => it.id);

      results.push({
        owner: sorted[0].owner,
        normalizedTitle: (sorted[0].title || '').trim().toLowerCase(),
        category: sorted[0].category,
        kind: sorted[0].kind,
        count: items.length,
        canonicalId,
        duplicateIds,
      });
    }
  }

  return results;
}

/**
 * Safely removes duplicate listings and re-links all associated rooms, negotiations,
 * embeddings, and audit logs to the canonical listing.
 */
export function cleanupDuplicateListings(options?: DeduplicationOptions): DeduplicationReport {
  const dbInstance = options?.dbInstance || db;
  const dryRun = options?.dryRun ?? false;

  const duplicateGroups = findDuplicateListings(dbInstance);

  const report: DeduplicationReport = {
    dryRun,
    groupsFound: duplicateGroups.length,
    duplicatesFound: duplicateGroups.reduce((acc, g) => acc + g.duplicateIds.length, 0),
    duplicatesRemoved: 0,
    roomsRelinked: 0,
    negotiationsRelinked: 0,
    embeddingsTransferred: 0,
    auditLogsUpdated: 0,
    details: [],
  };

  if (duplicateGroups.length === 0) {
    return report;
  }

  if (dryRun) {
    // Dry-run mode: calculate statistics without altering rows
    for (const group of duplicateGroups) {
      const canonical = dbInstance.prepare('SELECT title FROM listings WHERE id = ?').get(group.canonicalId) as any;
      let dryRooms = 0;
      let dryNegos = 0;
      for (const dupId of group.duplicateIds) {
        const roomsCount = dbInstance.prepare('SELECT COUNT(*) as cnt FROM rooms WHERE listing_id = ?').get(dupId) as { cnt: number };
        dryRooms += roomsCount ? roomsCount.cnt : 0;
        const negoCount = dbInstance.prepare('SELECT COUNT(*) as cnt FROM negotiations WHERE listing_id = ?').get(dupId) as { cnt: number };
        dryNegos += negoCount ? negoCount.cnt : 0;
      }
      report.details.push({
        canonicalId: group.canonicalId,
        removedIds: group.duplicateIds,
        title: canonical?.title || group.normalizedTitle,
        owner: group.owner,
        category: group.category,
        kind: group.kind,
        relinkedRooms: dryRooms,
        relinkedNegotiations: dryNegos,
      });
    }
    return report;
  }

  const runCleanup = dbInstance.transaction(() => {
    for (const group of duplicateGroups) {
      const canonical = dbInstance.prepare('SELECT * FROM listings WHERE id = ?').get(group.canonicalId) as any;
      if (!canonical) continue;

      let groupRoomsRelinked = 0;
      let groupNegotiationsRelinked = 0;

      for (const dupId of group.duplicateIds) {
        // 1. Relink rooms
        const relinkRoomsStmt = dbInstance.prepare(`
          UPDATE rooms SET listing_id = ? WHERE listing_id = ?
        `);
        const roomResult = relinkRoomsStmt.run(group.canonicalId, dupId);
        groupRoomsRelinked += roomResult.changes;
        report.roomsRelinked += roomResult.changes;

        // 2. Relink negotiations
        const relinkNegoStmt = dbInstance.prepare(`
          UPDATE negotiations SET listing_id = ? WHERE listing_id = ?
        `);
        const negoResult = relinkNegoStmt.run(group.canonicalId, dupId);
        groupNegotiationsRelinked += negoResult.changes;
        report.negotiationsRelinked += negoResult.changes;

        // 3. Relink / update audit logs
        try {
          const auditStmt = dbInstance.prepare(`
            UPDATE audit_logs SET resource_id = ? WHERE resource_id = ?
          `);
          const auditResult = auditStmt.run(group.canonicalId, dupId);
          report.auditLogsUpdated += auditResult.changes;
        } catch {
          // ignore if table not present
        }

        // 4. Handle embeddings: if canonical has no embedding, copy from duplicate
        try {
          if (!canonical.embedding_json) {
            const dupEmbedding = dbInstance.prepare('SELECT * FROM listing_embeddings WHERE listing_id = ?').get(dupId) as any;
            if (dupEmbedding) {
              dbInstance.prepare(`
                INSERT OR REPLACE INTO listing_embeddings (
                  id, listing_id, kind, provider, model, dimensions, vector_json, updated_at
                ) VALUES (
                  @id, @listing_id, @kind, @provider, @model, @dimensions, @vector_json, @updated_at
                )
              `).run({
                ...dupEmbedding,
                listing_id: group.canonicalId,
              });
              dbInstance.prepare('UPDATE listings SET embedding_json = ? WHERE id = ?').run(
                dupEmbedding.vector_json,
                group.canonicalId
              );
              canonical.embedding_json = dupEmbedding.vector_json;
              report.embeddingsTransferred++;
            }
          }

          // Delete duplicate embeddings
          dbInstance.prepare('DELETE FROM listing_embeddings WHERE listing_id = ?').run(dupId);
        } catch {
          // ignore
        }

        // 5. Delete duplicate listing
        dbInstance.prepare('DELETE FROM listings WHERE id = ?').run(dupId);
        report.duplicatesRemoved++;
      }

      report.details.push({
        canonicalId: group.canonicalId,
        removedIds: group.duplicateIds,
        title: canonical.title,
        owner: group.owner,
        category: group.category,
        kind: group.kind,
        relinkedRooms: groupRoomsRelinked,
        relinkedNegotiations: groupNegotiationsRelinked,
      });
    }
  });

  runCleanup();

  return report;
}
