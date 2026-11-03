#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MCP_TOOLS_MANIFEST } from '../server/mcp';

/**
 * Validates markdown documentation files in the repository:
 * 1. Checks that relative markdown links between docs are valid and targets exist.
 * 2. Checks that referenced images and static assets exist.
 * 3. Checks that all MCP tools in MCP_TOOLS_MANIFEST are properly documented in README.md.
 */

const ROOT_DIR = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT_DIR, 'docs');

export function getMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (
      entry.isDirectory() &&
      entry.name !== 'node_modules' &&
      entry.name !== '.git' &&
      entry.name !== '.agents' &&
      entry.name !== 'dist'
    ) {
      files.push(...getMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

export function validateLinksInFile(filePath: string): string[] {
  const errors: string[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const dir = path.dirname(filePath);

  // Match markdown links and images: [text](path) or ![alt](path)
  const linkRegex = /!?\[([^\]]*)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(content)) !== null) {
    const linkTarget = match[2].trim();

    // Skip external URLs, mailto, file URIs, and anchor-only links
    if (
      linkTarget.startsWith('http://') ||
      linkTarget.startsWith('https://') ||
      linkTarget.startsWith('mailto:') ||
      linkTarget.startsWith('file://') ||
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

export function validateMcpToolsDocumentation(): string[] {
  const errors: string[] = [];
  const readmePath = path.join(ROOT_DIR, 'README.md');
  if (!fs.existsSync(readmePath)) {
    errors.push('README.md not found in root directory');
    return errors;
  }

  const readmeContent = fs.readFileSync(readmePath, 'utf-8');

  for (const tool of MCP_TOOLS_MANIFEST) {
    // Check for `tool.name` in README.md
    if (!readmeContent.includes(`\`${tool.name}\``)) {
      errors.push(`MCP Tool "${tool.name}" from MCP_TOOLS_MANIFEST is missing in README.md table`);
    }
  }

  return errors;
}

export function validateAllDocs(): { ok: boolean; errors: string[]; mdCount: number; toolsCount: number } {
  const mdFiles = [
    path.join(ROOT_DIR, 'README.md'),
    path.join(ROOT_DIR, 'AGENTS.md'),
    ...getMarkdownFiles(DOCS_DIR),
  ];

  const totalErrors: string[] = [];

  for (const file of mdFiles) {
    if (!fs.existsSync(file)) continue;
    const errors = validateLinksInFile(file);
    totalErrors.push(...errors);
  }

  const mcpErrors = validateMcpToolsDocumentation();
  totalErrors.push(...mcpErrors);

  return {
    ok: totalErrors.length === 0,
    errors: totalErrors,
    mdCount: mdFiles.length,
    toolsCount: MCP_TOOLS_MANIFEST.length,
  };
}

function main() {
  console.log('🔍 Validating documentation integrity and MCP tools synchronization...');
  const result = validateAllDocs();

  if (!result.ok) {
    console.error(`❌ Found ${result.errors.length} documentation validation errors:`);
    for (const err of result.errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }

  console.log(
    `✅ All ${result.mdCount} markdown documents passed link validation.`
  );
  console.log(
    `✅ All ${result.toolsCount} MCP tools in MCP_TOOLS_MANIFEST are documented in README.md.`
  );
}

const currentFilePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && (invokedPath === currentFilePath || invokedPath.includes('validate-docs'))) {
  main();
}
