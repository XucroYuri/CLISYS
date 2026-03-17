/**
 * CLISYS Task Parser Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskParser } from '../../src/core/orchestrator/TaskParser.js';

describe('TaskParser', () => {
  let parser: TaskParser;

  beforeEach(() => {
    parser = new TaskParser({
      defaultPriority: 'medium',
      defaultWorkingDirectory: process.cwd(),
    });
  });

  it('should parse a simple task', () => {
    const result = parser.parse('Create a simple HTTP server');

    expect(result.type).toBe('code_generation');
    expect(result.originalInput).toBe('Create a simple HTTP server');
    expect(result.priority).toBe('medium');
    expect(result.subtasks.length).toBeGreaterThanOrEqual(1);
  });

  it('should detect code review tasks', () => {
    const result = parser.parse('Review this code for bugs');

    expect(result.type).toBe('code_review');
  });

  it('should detect debugging tasks', () => {
    const result = parser.parse('Fix the bug in the authentication module');

    expect(result.type).toBe('debugging');
  });

  it('should detect documentation tasks', () => {
    const result = parser.parse('Add documentation to the API');

    expect(result.type).toBe('documentation');
  });

  it('should detect high priority tasks', () => {
    const result = parser.parse('Urgent: Fix the critical bug');

    expect(result.priority).toBe('high');
  });

  it('should detect low priority tasks', () => {
    const result = parser.parse('Eventually add this feature');

    expect(result.priority).toBe('low');
  });

  it('should decompose multi-step tasks', () => {
    const result = parser.parse('Create the API then write tests');

    expect(result.subtasks.length).toBe(2);
    expect(result.subtasks[0].description).toContain('Create the API');
    expect(result.subtasks[1].dependencies).toContain(result.subtasks[0].id);
  });

  it('should include required capabilities', () => {
    const result = parser.parse('Create a simple HTTP server');

    expect(result.requiredCapabilities.length).toBeGreaterThan(0);
  });

  it('should use context when provided', () => {
    const result = parser.parse('Create a component', {
      workingDirectory: '/test/path',
      language: 'TypeScript',
    });

    expect(result.context.workingDirectory).toBe('/test/path');
  });
});
