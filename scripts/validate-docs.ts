#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

/**
 * Validates markdown documentation files in the repository:
 * 1. Checks that relative markdown links between docs are valid and targets exist.
 * 2. Checks that referenced code files exist.
 */

const ROOT_DIR = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT_DIR, 'docs');

function getMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
      files.push(...getMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

function validateLinksInFile(filePath: string): string[] {
  const errors: string[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const dir = path.dirname(filePath);

  // Match markdown links: [text](path)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(content)) !== null) {
    const linkTarget = match[2].trim();

    // Skip external URLs, mailto, anchor-only links
    if (
      linkTarget.startsWith('http://') ||
      linkTarget.startsWith('https://') ||
      linkTarget.startsWith('mailto:') ||
      linkTarget.startsWith('#')
    ) {
      continue;
    }

    // Strip anchor #...
    const cleanTarget = linkTarget.split('#')[0];
    if (!cleanTarget) continue;

    const resolvedPath = path.resolve(dir, cleanTarget);
    if (!fs.existsSync(resolvedPath)) {
      errors.push(
        `Broken relative link in ${path.relative(ROOT_DIR, filePath)}: "${linkTarget}" -> target not found at ${path.relative(ROOT_DIR, resolvedPath)}`
      );
    }
  }

  return errors;
}

function main() {
  console.log('🔍 Validating documentation files...');
  const mdFiles = [
    path.join(ROOT_DIR, 'README.md'),
    path.join(ROOT_DIR, 'AGENTS.md'),
    ...getMarkdownFiles(DOCS_DIR),
  ];

  let totalErrors: string[] = [];

  for (const file of mdFiles) {
    if (!fs.existsSync(file)) continue;
    const errors = validateLinksInFile(file);
    totalErrors.push(...errors);
  }

  if (totalErrors.length > 0) {
    console.error(`❌ Found ${totalErrors.length} documentation link errors:`);
    for (const err of totalErrors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log(`✅ All ${mdFiles.length} markdown documents passed link validation successfully.`);
}

main();
