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
 */
export function findDuplicateListings(dbInstance: any = db): DuplicateGroup[] {
  const groupsStmt = dbInstance.prepare(`
    SELECT 
      owner, 
      LOWER(TRIM(title)) as normalized_title, 
      category, 
      kind, 
      COUNT(*) as count
    FROM listings
    GROUP BY owner, LOWER(TRIM(title)), category, kind
    HAVING COUNT(*) > 1
  `);

  const groups = groupsStmt.all() as Array<{
    owner: string;
    normalized_title: string;
    category: string;
    kind: string;
    count: number;
  }>;

  const results: DuplicateGroup[] = [];

  const listingsStmt = dbInstance.prepare(`
    SELECT id, created_at, status, revision
    FROM listings
    WHERE owner = ? AND LOWER(TRIM(title)) = ? AND category = ? AND kind = ?
    ORDER BY created_at ASC, id ASC
  `);

  for (const g of groups) {
    const items = listingsStmt.all(g.owner, g.normalized_title, g.category, g.kind) as Array<{
      id: string;
      created_at: number;
      status: string;
      revision: number;
    }>;

    if (items.length > 1) {
      // Prefer 'active' listings as canonical; otherwise oldest created
      const sorted = [...items].sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (b.status === 'active' && a.status !== 'active') return 1;
        return a.created_at - b.created_at;
      });

      const canonicalId = sorted[0].id;
      const duplicateIds = items.filter((it) => it.id !== canonicalId).map((it) => it.id);

      results.push({
        owner: g.owner,
        normalizedTitle: g.normalized_title,
        category: g.category,
        kind: g.kind,
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
