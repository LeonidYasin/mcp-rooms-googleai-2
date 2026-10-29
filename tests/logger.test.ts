import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '../server/logger';

describe('Structured JSON Logger', () => {
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formats info log output as valid JSON with required metadata fields', () => {
    const logger = new Logger('test-service');
    logger.info('Server started', { port: 3000 });

    expect(consoleLogSpy).toHaveBeenCalledOnce();
    const output = consoleLogSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);

    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('Server started');
    expect(parsed.service).toBe('test-service');
    expect(parsed.port).toBe(3000);
    expect(typeof parsed.timestamp).toBe('string');
  });

  it('formats warn log output as valid JSON', () => {
    const logger = new Logger('test-service');
    logger.warn('Rate limit warning', { ip: '127.0.0.1' });

    expect(consoleWarnSpy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(consoleWarnSpy.mock.calls[0][0]);

    expect(parsed.level).toBe('warn');
    expect(parsed.message).toBe('Rate limit warning');
    expect(parsed.ip).toBe('127.0.0.1');
  });

  it('formats error log output as valid JSON', () => {
    const logger = new Logger('test-service');
    logger.error('Database connection failed', { error: 'ECONNREFUSED' });

    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    const parsed = JSON.parse(consoleErrorSpy.mock.calls[0][0]);

    expect(parsed.level).toBe('error');
    expect(parsed.message).toBe('Database connection failed');
    expect(parsed.error).toBe('ECONNREFUSED');
  });
});
