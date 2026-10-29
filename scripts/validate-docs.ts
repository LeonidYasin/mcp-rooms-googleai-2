import fs from 'fs';
import path from 'path';

const REQUIRED_DOCS = [
  'README.md',
  'AGENTS.md',
  'docs/README.md',
  'docs/session_coordination.md',
  'docs/roadmap.md',
];

console.log('Validating repository documentation...');

let errorsCount = 0;

for (const docRelativePath of REQUIRED_DOCS) {
  const fullPath = path.resolve(process.cwd(), docRelativePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Missing required documentation file: ${docRelativePath}`);
    errorsCount++;
    continue;
  }

  const stat = fs.statSync(fullPath);
  if (stat.size === 0) {
    console.error(`❌ Documentation file is empty: ${docRelativePath}`);
    errorsCount++;
    continue;
  }

  console.log(`✓ ${docRelativePath} (${stat.size} bytes)`);
}

if (errorsCount > 0) {
  console.error(`\nDocumentation validation failed with ${errorsCount} error(s).`);
  process.exit(1);
}

console.log('All required documentation files are valid.');
