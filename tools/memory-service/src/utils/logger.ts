import pino from 'pino';
import { config, isDevelopment } from '../config/index.js';

export const logger = pino({
  level: config.LOG_LEVEL,
  ...(isDevelopment && config.LOG_PRETTY
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
  base: {
    service: 'egce-memory-service',
    version: process.env['npm_package_version'] ?? '0.1.0',
  },
});

export function createChildLogger(name: string) {
  return logger.child({ component: name });
}
