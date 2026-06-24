// 结构化日志模块 — 替代散落的 console.log/error/warn
// 生产环境输出 JSON 格式，开发环境输出可读格式

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getMinLevel(): LogLevel {
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getMinLevel()];
}

function formatEntry(entry: LogEntry): string {
  if (process.env.NODE_ENV === 'production') {
    return JSON.stringify(entry);
  }
  const prefix = `[${entry.level.toUpperCase()}] ${entry.timestamp}`;
  if (entry.data !== undefined) {
    return `${prefix} ${entry.message} ${JSON.stringify(entry.data)}`;
  }
  return `${prefix} ${entry.message}`;
}

function log(level: LogLevel, message: string, data?: unknown): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    data,
  };

  const formatted = formatEntry(entry);

  // 使用 console 作为底层输出，但通过 shouldLog 和格式化控制
  switch (level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }
}

export const logger = {
  debug(message: string, data?: unknown): void {
    log('debug', message, data);
  },
  info(message: string, data?: unknown): void {
    log('info', message, data);
  },
  warn(message: string, data?: unknown): void {
    log('warn', message, data);
  },
  error(message: string, error?: unknown): void {
    const data =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : error;
    log('error', message, data);
  },
};
