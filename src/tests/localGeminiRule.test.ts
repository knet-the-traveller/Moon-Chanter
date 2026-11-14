import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const geminiPath = path.resolve(__dirname, '../../GEMINI.md');
const hasLocalGemini = fs.existsSync(geminiPath);

describe('Local GEMINI.md Rule Audit', () => {
  it('.gitignore ignores GEMINI.md under local rules', () => {
    const gitignore = fs.readFileSync(path.resolve(__dirname, '../../.gitignore'), 'utf-8');
    expect(gitignore).toContain('GEMINI.md');
  });

  it.runIf(hasLocalGemini)('GEMINI.md exists locally and defines brainstorming spec and PR draft mandates', () => {
    expect(fs.existsSync(geminiPath)).toBe(true);
    const content = fs.readFileSync(geminiPath, 'utf-8');
    expect(content).toContain('docs/superpowers/specs/');
    expect(content).toContain('finishing-a-development-branch');
    expect(content).toContain('Agent: Antigravity / Gemini');
  });

  it.runIf(hasLocalGemini)('GEMINI.md defines merged branch and PR advisory mandate', () => {
    expect(fs.existsSync(geminiPath)).toBe(true);
    const content = fs.readFileSync(geminiPath, 'utf-8');
    expect(content).toContain('Merged Branch & PR Form Advisory Mandate');
    expect(content).toContain('No Forced Branch Creation');
    expect(content).toContain('Stay on this branch');
    expect(content).toContain('Spin up a fresh branch');
  });
});
