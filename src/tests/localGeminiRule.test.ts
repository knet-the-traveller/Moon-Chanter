import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Local GEMINI.md Rule Audit', () => {
  it('.gitignore ignores GEMINI.md under local rules', () => {
    const gitignore = fs.readFileSync(path.resolve(__dirname, '../../.gitignore'), 'utf-8');
    expect(gitignore).toContain('GEMINI.md');
  });

  it('GEMINI.md exists locally and defines brainstorming spec and PR draft mandates', () => {
    const geminiPath = path.resolve(__dirname, '../../GEMINI.md');
    expect(fs.existsSync(geminiPath)).toBe(true);
    const content = fs.readFileSync(geminiPath, 'utf-8');
    expect(content).toContain('docs/superpowers/specs/');
    expect(content).toContain('finishing-a-development-branch');
    expect(content).toContain('Agent: Antigravity / Gemini');
  });
});
