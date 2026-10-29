import fs from 'fs';
import path from 'path';

const docsDir = path.resolve(process.cwd(), 'docs');

if (!fs.existsSync(docsDir)) {
  console.error('Error: docs directory missing!');
  process.exit(1);
}

function getMarkdownFiles(dir: string): string[] {
  let files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

const mdFiles = getMarkdownFiles(docsDir);

if (mdFiles.length === 0) {
  console.error('Error: No markdown files found in docs/');
  process.exit(1);
}

let hasErrors = false;

for (const filepath of mdFiles) {
  const content = fs.readFileSync(filepath, 'utf-8').trim();
  const relPath = path.relative(process.cwd(), filepath);

  if (content.length === 0) {
    console.error(`Validation Error: ${relPath} is empty`);
    hasErrors = true;
  }
}

if (hasErrors) {
  process.exit(1);
}

console.log(`Validated ${mdFiles.length} documentation files successfully.`);
