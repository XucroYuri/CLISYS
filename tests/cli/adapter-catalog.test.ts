import { describe, expect, it } from 'vitest';
import {
  getAdapterDisplayEntries,
  getEnabledBuiltInAdapterNames,
} from '../../src/adapters/catalog.js';
import { getDefaultConfig } from '../../src/core/config/loader.js';

describe('Adapter catalog', () => {
  it('includes gemini as an enabled built-in adapter by default', () => {
    const config = getDefaultConfig();
    const entries = getAdapterDisplayEntries(config.adapters);
    const gemini = entries.find((entry) => entry.name === 'gemini');

    expect(gemini).toBeDefined();
    expect(gemini?.status).toBe('available');
    expect(gemini?.enabled).toBe(true);
  });

  it('returns only the requested built-in adapter when explicitly selected', () => {
    const config = getDefaultConfig();

    expect(getEnabledBuiltInAdapterNames(config.adapters, 'gemini')).toEqual(['gemini']);
  });

  it('throws when a requested adapter is not a supported built-in adapter', () => {
    const config = getDefaultConfig();

    expect(() => getEnabledBuiltInAdapterNames(config.adapters, 'opencode')).toThrow(
      'not a supported built-in adapter'
    );
  });

  it('throws when the requested built-in adapter is disabled in configuration', () => {
    const config = getDefaultConfig();
    config.adapters.gemini.enabled = false;

    expect(() => getEnabledBuiltInAdapterNames(config.adapters, 'gemini')).toThrow(
      'disabled in configuration'
    );
  });
});
