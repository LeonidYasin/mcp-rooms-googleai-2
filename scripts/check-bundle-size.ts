import fs from 'fs';
import path from 'path';

const distDir = path.resolve(process.cwd(), 'dist');

if (!fs.existsSync(distDir)) {
  console.log('dist directory missing, skipping size check (run after npm run build)');
  process.exit(0);
}

function getFiles(dir: string): string[] {
  let files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = getFiles(distDir);
let totalSize = 0;

for (const file of files) {
  const stat = fs.statSync(file);
  totalSize += stat.size;
}

const sizeInMb = totalSize / (1024 * 1024);
console.log(`Production bundle size: ${sizeInMb.toFixed(2)} MB (${files.length} files)`);

if (sizeInMb > 25) {
  console.error(`Error: Bundle size exceeds limit (${sizeInMb.toFixed(2)} MB > 25 MB)`);
  process.exit(1);
}
