import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('2026 NASA Space Apps Challenge Branding Audit', () => {
  it('README.md contains 2026 event year, official challenge URL, clone URL, and co-pilot disclaimer', () => {
    const readme = fs.readFileSync(path.resolve(__dirname, '../../README.md'), 'utf-8');
    expect(readme).toContain('NASA Space Apps Challenge 2026');
    expect(readme).toContain('https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/');
    expect(readme).toContain('https://github.com/knet-the-traveller/Moon-Chanter.git');
    expect(readme).toContain('cd Moon-Chanter');
    expect(readme).toContain('supportive decision-exploration co-pilot');
    expect(readme).not.toContain('NASA Space Apps Challenge 2024');
    expect(readme).not.toContain('moon-chanter/fieldshift.git');
  });

  it('MethodologyModal and PrintablePlan reference 2026 Space Apps Challenge', () => {
    const modal = fs.readFileSync(path.resolve(__dirname, '../components/MethodologyModal.tsx'), 'utf-8');
    const printable = fs.readFileSync(path.resolve(__dirname, '../components/PrintablePlan.tsx'), 'utf-8');
    expect(modal).toContain('2026 NASA Space Apps Challenge');
    expect(modal).not.toContain('NASA Space Apps Challenge 2024');
    expect(printable).toContain('2026 NASA Space Apps Challenge');
    expect(printable).not.toContain('NASA Space Apps Challenge 2024');
  });

  it('AGENTS.md enforces 2026 challenge horizon and non-prescriptive mandate', () => {
    const agentsRules = fs.readFileSync(path.resolve(__dirname, '../../AGENTS.md'), 'utf-8');
    expect(agentsRules).toContain('2026 NASA Space Apps Challenge');
    expect(agentsRules).toContain('non-prescriptive');
  });
});
