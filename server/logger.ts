export type LogLevel = 'info' | 'warn' | 'error';

export interface LogPayload {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  [key: string]: any;
}

export class Logger {
  private service: string;

  constructor(service: string = 'mcp-rooms-backend') {
    this.service = service;
  }

  private format(level: LogLevel, message: string, meta: Record<string, any> = {}): LogPayload {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      ...meta,
    };
  }

  info(message: string, meta?: Record<string, any>): void {
    const payload = this.format('info', message, meta);
    console.log(JSON.stringify(payload));
  }

  warn(message: string, meta?: Record<string, any>): void {
    const payload = this.format('warn', message, meta);
    console.warn(JSON.stringify(payload));
  }

  error(message: string, meta?: Record<string, any>): void {
    const payload = this.format('error', message, meta);
    console.error(JSON.stringify(payload));
  }
}

export const logger = new Logger();
