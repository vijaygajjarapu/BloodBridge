type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function formatMessage(level: LogLevel, message: string, ...args: any[]): string {
  const timestamp = new Date().toISOString();
  const formattedArgs = args.length > 0 ? ' ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ') : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${formattedArgs}`;
}

export const logger = {
  info(message: string, ...args: any[]) {
    console.log('\x1b[36m%s\x1b[0m', formatMessage('info', message, ...args));
  },
  warn(message: string, ...args: any[]) {
    console.warn('\x1b[33m%s\x1b[0m', formatMessage('warn', message, ...args));
  },
  error(message: string, ...args: any[]) {
    console.error('\x1b[31m%s\x1b[0m', formatMessage('error', message, ...args));
  },
  debug(message: string, ...args: any[]) {
    if (process.env.NODE_ENV === 'development') {
      console.debug('\x1b[90m%s\x1b[0m', formatMessage('debug', message, ...args));
    }
  },
};
