import { initDatabase } from '../server/db';
import { issueApiKey } from '../server/auth';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

async function mcpCall(token: string, method: string, params: any) {
  const res = await fetch(`${BASE_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MCP call failed with HTTP ${res.status}: ${text}`);
  }
  const data: any = await res.json();
  if (data.error) {
    throw new Error(`MCP error ${data.error.code}: ${data.error.message}`);
  }
  return data.result;
}

async function callTool(token: string, name: string, args: any) {
  const result = await mcpCall(token, 'tools/call', { name, arguments: args });
  return result?.data;
}

async function run() {
  console.log('🚀 [E2E Live Scenarios] Starting end-to-end verification against', BASE_URL);

  // 1. Initialize DB and issue real credentials
  initDatabase();
  const founder = issueApiKey('user:leonid-founder', 'Леонид Основатель');
  const agent = issueApiKey('agent:ai-partner', 'AI Агент Партнер');

  console.log('🔑 Issued Founder Key:', founder.key, `(${founder.principalId})`);
  console.log('🔑 Issued Agent Key:', agent.key, `(${agent.principalId})`);

  // 2. Scenario 1: Founder publishes an Offer (Services)
  console.log('\n📦 Step 1: Founder creates draft offer...');
  const offerDraft = await callTool(founder.key, 'create_listing', {
    title: 'Разработка и внедрение MCP-серверов и AI-агентов под ключ',
    description: 'Команда экспертов разрабатывает кастомные MCP (Model Context Protocol) инструменты для Gemini и Claude, интегрирует корпоративные базы данных и разворачивает безопасные локальные переговорные комнаты.',
    category: 'services',
    kind: 'offer',
    locality: 'Москва',
    price_rubles: 50000,
    modes: ['online'],
    condition: 'b2b-интеграция',
  });
  const offerListingId = offerDraft.created_listing?.id || offerDraft.id;
  console.log('✅ Offer draft created with ID:', offerListingId);

  console.log('🔍 Step 2: Requesting consent token (preview)...');
  const offerPreview = await callTool(founder.key, 'preview_listing', {
    listing_id: offerListingId,
  });
  console.log('✅ Consent token acquired. Revision:', offerPreview.revision);

  console.log('📢 Step 3: Publishing offer to public catalog...');
  const publishedOffer = await callTool(founder.key, 'publish_listing', {
    listing_id: offerListingId,
    consent_token: offerPreview.consent_token,
    revision: offerPreview.revision,
  });
  console.log('✅ Offer published! ID:', publishedOffer.published_listing?.id || offerListingId);

  // 3. Scenario 2: Counterparty publishes a Request (Business)
  console.log('\n📦 Step 4: Counterparty creates draft request...');
  const reqDraft = await callTool(agent.key, 'create_listing', {
    title: 'Ищу техническую команду для создания платформы автономных комнат',
    description: 'Требуется опытная команда для интеграции MCP-протокола, развертывания безопасных SQLite комнат и настройки LLM-переговоров для B2B-маркетплейса.',
    category: 'business',
    kind: 'request',
    locality: 'Москва',
    price_rubles: 100000,
    modes: ['online'],
  });
  const reqListingId = reqDraft.created_listing?.id || reqDraft.id;

  const reqPreview = await callTool(agent.key, 'preview_listing', {
    listing_id: reqListingId,
  });
  const publishedReq = await callTool(agent.key, 'publish_listing', {
    listing_id: reqListingId,
    consent_token: reqPreview.consent_token,
    revision: reqPreview.revision,
  });
  console.log('✅ Request published with ID:', publishedReq.published_listing?.id || reqListingId);

  // 4. Scenario 3: Asymmetric semantic matching
  console.log('\n🤝 Step 5: Testing match_listings (asymmetric matching)...');
  const matchResult = await callTool(agent.key, 'match_listings', {
    query: 'Нужна разработка MCP серверов и интеграция агентов',
    query_kind: 'request',
    category: 'services',
  });
  console.log('✅ Match results returned successfully. Matches:', matchResult?.matches?.length ?? 0);

  // 5. Scenario 4: Shared Room Negotiation
  console.log('\n💬 Step 6: Counterparty joins Shared Room on Offer...');
  const roomResult = await callTool(agent.key, 'join_room', {
    listing_id: offerListingId,
    initial_message: 'Здравствуйте, Леонид! Нас очень заинтересовал ваш оффер по внедрению MCP. Хотим обсудить ТЗ.',
  });
  const roomId = roomResult.room_id || roomResult.id;
  console.log('✅ Shared Room created/joined with ID:', roomId);

  console.log('✉️ Step 7: Founder responds in the room...');
  await callTool(founder.key, 'send_message', {
    room_id: roomId,
    role: 'human',
    text: 'Приветствую! Рады сотрудничеству. Готовы созвониться и согласовать скоуп первого спринта.',
  });
  console.log('✅ Founder message delivered to room.');

  // 6. Step 8: Verify Room History
  console.log('\n📜 Step 8: Verifying complete room message history...');
  const history = await callTool(founder.key, 'get_room_history', {
    room_id: roomId,
  });
  const msgs = history.messages || [];
  console.log(`✅ Room history has ${msgs.length} messages:`);
  for (const msg of msgs) {
    console.log(`   [${msg.sender} (${msg.role})]: ${msg.text}`);
  }

  // 7. Step 9: Verify public catalog resources
  console.log('\n📚 Step 9: Reading listings://all resource via MCP...');
  const resListings = await mcpCall(founder.key, 'resources/read', {
    uri: 'listings://all',
  });
  const allListings = JSON.parse(resListings.contents[0].text);
  console.log(`✅ Live public catalog contains ${allListings.length} published listings.`);

  console.log('\n🎉 ALL E2E SCENARIOS SUCCESSFULLY COMPLETED!');
  console.log('================================================================');
  console.log('🔑 CREDENTIALS FOR WEB UI LOGIN (https://leonid-mcp.duckdns.org/):');
  console.log(`Founder API Key : ${founder.key}`);
  console.log(`Agent API Key   : ${agent.key}`);
  console.log('================================================================');
}

run().catch((err) => {
  console.error('❌ E2E Scenarios failed:', err);
  process.exit(1);
});
