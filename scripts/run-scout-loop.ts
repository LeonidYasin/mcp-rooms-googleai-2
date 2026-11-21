#!/usr/bin/env node
import { runAutonomousScoutCycle } from '../server/scout-worker';
import { getPublicDealsFromDb, getScoutProfilesFromDb, initDatabase } from '../server/db';

async function main() {
  initDatabase();
  const args = process.argv.slice(2);
  const isWatch = args.includes('--watch');
  const itemsArg = args.find((a) => a.startsWith('--items='));
  const thresholdArg = args.find((a) => a.startsWith('--threshold='));

  const maxItems = itemsArg ? Number(itemsArg.split('=')[1]) : 25;
  const matchThreshold = thresholdArg ? Number(thresholdArg.split('=')[1]) : 0.70;

  console.log('='.repeat(70));
  console.log('🤖 MCP Rooms Autonomous Scout & Public Ledger Pipeline');
  console.log(`🎯 Config: maxItems=${maxItems}, matchThreshold=${matchThreshold}, mode=${isWatch ? 'continuous' : 'single run'}`);
  console.log('='.repeat(70));

  const run = async () => {
    const res = await runAutonomousScoutCycle({ maxItems, matchThreshold });
    console.log('\n📊 Cycle Results:');
    console.log(`  - Duration: ${((res.completedAt - res.startedAt) / 1000).toFixed(1)}s`);
    console.log(`  - Discovered raw items: ${res.itemsDiscovered}`);
    console.log(`  - Profiles indexed: ${res.profilesIndexed}`);
    console.log(`  - New Deals formed: ${res.dealsFormed}`);
    console.log(`  - Total Scout Profiles in DB: ${res.totalProfilesInDb}`);
    console.log(`  - Total Published Deals in DB: ${res.totalDealsInDb}`);

    if (res.errors.length > 0) {
      console.log('  - Errors encountered:', res.errors);
    }

    const deals = getPublicDealsFromDb({ limit: 5 });
    if (deals.length > 0) {
      console.log('\n🏆 Recent Deals in Public Ledger:');
      for (const d of deals) {
        console.log(`  • [${Math.round(d.compatibilityScore * 100)}%] @${d.actorA.handle} (${d.actorA.platform}) ↔ @${d.actorB.handle} (${d.actorB.platform})`);
        console.log(`    Exchange: ${d.exchangeSummary.slice(0, 90)}...`);
        console.log(`    Room ID: ${d.roomId}`);
      }
    }
  };

  await run();

  if (isWatch) {
    const intervalMin = Number(process.env.SCOUT_INTERVAL_MINUTES) || 60;
    console.log(`\n⏳ Continuous mode active. Next run in ${intervalMin} minutes.`);
    setInterval(run, intervalMin * 60 * 1000);
  }
}

main().catch((err) => {
  console.error('Fatal scout error:', err);
  process.exit(1);
});
