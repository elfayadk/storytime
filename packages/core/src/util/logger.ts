/** Minimal leveled logger. Silent-friendly for library/CLI use. */
export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';

const ORDER: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

export interface Logger {
  level: LogLevel;
  error: (...a: unknown[]) => void;
  warn: (...a: unknown[]) => void;
  info: (...a: unknown[]) => void;
  debug: (...a: unknown[]) => void;
}

export function createLogger(level: LogLevel = 'info'): Logger {
  const at = (l: LogLevel) => ORDER[level] >= ORDER[l];
  return {
    level,
    error: (...a) => at('error') && console.error('✖', ...a),
    warn: (...a) => at('warn') && console.warn('⚠', ...a),
    info: (...a) => at('info') && console.error('•', ...a),
    debug: (...a) => at('debug') && console.error('·', ...a),
  };
}
