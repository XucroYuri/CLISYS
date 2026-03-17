/**
 * CLISYS Config Loader Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  loadFromTOML,
  saveToTOML,
  getDefaultConfig,
} from '../../src/core/config/loader.js';

const TEST_CONFIG_DIR = path.join(process.cwd(), '.test-config');

describe('Config Loader', () => {
  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(TEST_CONFIG_DIR)) {
      fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Cleanup test directory
    if (fs.existsSync(TEST_CONFIG_DIR)) {
      fs.rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
    }
  });

  it('should return default config when file not found', () => {
    const config = loadFromTOML('/nonexistent/path/config.toml');

    expect(config.version).toBe('1.0');
    expect(config.adapters).toBeDefined();
    expect(config.orchestrator).toBeDefined();
  });

  it('should save and load config correctly', () => {
    const configPath = path.join(TEST_CONFIG_DIR, 'test.toml');
    const config = getDefaultConfig();

    // Modify config
    config.logging.level = 'debug';
    config.orchestrator.maxParallelTasks = 5;

    saveToTOML(configPath, config);

    // Verify the file exists
    expect(fs.existsSync(configPath)).toBe(true);

    // Load and verify
    const loaded = loadFromTOML(configPath);
    expect(loaded.logging.level).toBe('debug');
    expect(loaded.orchestrator.maxParallelTasks).toBe(5);
  });

  it('should have correct default adapter config', () => {
    const config = getDefaultConfig();

    expect(config.adapters['claude-code']).toBeDefined();
    expect(config.adapters['claude-code'].enabled).toBe(true);
    expect(config.adapters['codex']).toBeDefined();
  });

  it('should have correct default orchestrator config', () => {
    const config = getDefaultConfig();

    expect(config.orchestrator.defaultStrategy).toBe('capability_based');
    expect(config.orchestrator.maxParallelTasks).toBe(3);
    expect(config.orchestrator.taskTimeout).toBe(300000);
  });
});
