import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateAllDocs,
  validateMcpToolsDocumentation,
  validateLinksInFile,
  getMarkdownFiles,
} from '../scripts/validate-docs';
import { MCP_TOOLS_MANIFEST } from '../server/mcp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('TASK-13: Documentation Integrity & Doc-Linter (validate-docs)', () => {
  it('validates that all markdown files in repo have valid links and existing targets', () => {
    const result = validateAllDocs();
    if (!result.ok) {
      console.error('Validation errors found in docs:', result.errors);
    }
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.mdCount).toBeGreaterThan(5);
  });

  it('validates that all MCP tools in MCP_TOOLS_MANIFEST are documented in README.md', () => {
    const errors = validateMcpToolsDocumentation();
    expect(errors).toEqual([]);

    expect(MCP_TOOLS_MANIFEST.length).toBeGreaterThanOrEqual(13);
    const readmeContent = fs.readFileSync(path.resolve(__dirname, '../README.md'), 'utf-8');
    for (const tool of MCP_TOOLS_MANIFEST) {
      expect(readmeContent).toContain(`\`${tool.name}\``);
    }
  });

  it('detects broken relative links in invalid markdown content', () => {
    const tempFile = path.resolve(__dirname, 'temp-broken-test.md');
    try {
      fs.writeFileSync(
        tempFile,
        '# Test Doc\n\nLink to [Missing File](missing-file-nonexistent-123.md) and [Valid README](../README.md)'
      );
      const errors = validateLinksInFile(tempFile);
      expect(errors.length).toBe(1);
      expect(errors[0]).toContain('missing-file-nonexistent-123.md');
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  });

  it('collects markdown files excluding node_modules and .git', () => {
    const rootDir = path.resolve(__dirname, '..');
    const files = getMarkdownFiles(path.join(rootDir, 'docs'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(file.endsWith('.md')).toBe(true);
      expect(file).not.toContain('node_modules');
      expect(file).not.toContain('.git');
    }
  });
});
