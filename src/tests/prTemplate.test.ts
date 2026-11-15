import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('GitHub Pull Request Template Audit', () => {
  const templatePath = path.resolve(__dirname, '../../.github/pull_request_template.md');

  it('.github/pull_request_template.md exists', () => {
    expect(fs.existsSync(templatePath)).toBe(true);
  });

  it('contains mandatory sections tailored to AniTala', () => {
    const content = fs.readFileSync(templatePath, 'utf-8');
    expect(content).toContain('## Summary');
    expect(content).toContain('## Type of change');
    expect(content).toContain('## Screenshots (UI changes)');
    expect(content).toContain('## Data & Agronomic Engine');
    expect(content).toContain('## AI involvement');
    expect(content).toContain('## Quality gates checklist');
    expect(content).toContain('## How to test');
  });

  it('contains AniTala-specific verification checks and zero legacy database references', () => {
    const content = fs.readFileSync(templatePath, 'utf-8');
    expect(content).toContain('npm test');
    expect(content).toContain('npm run lint');
    expect(content).toContain('npx tsc -b');
    expect(content).toContain('AGRO-RULE');
    expect(content).toContain('docs/LOCAL_TESTING_GUIDE.md');
    expect(content).not.toContain('supabase');
    expect(content).not.toContain('apps/mobile');
  });
});
