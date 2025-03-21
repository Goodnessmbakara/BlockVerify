import winston from 'winston';

// Configure log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Determine log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development' ? 'debug' : 'info';
};

// Define custom format with colors
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define where logs should be stored
const transports = [
  // Console logs
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message} ${info.stack || ''} ${
          Object.keys(info).filter(key => 
            !['timestamp', 'level', 'message', 'stack'].includes(key)
          ).length > 0 
            ? JSON.stringify(Object.fromEntries(
                Object.entries(info).filter(([key]) => 
                  !['timestamp', 'level', 'message', 'stack'].includes(key)
                )
              )) 
            : ''
        }`
      )
    ),
  }),
  
  // File logs for errors
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
  }),
  
  // Combined logs
  new winston.transports.File({ 
    filename: 'logs/combined.log' 
  }),
];

// Create and export the logger
export const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  defaultMeta: { service: 'credential-api' },
});

// If we're not in production, log to the console with pretty format
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    })
  );
}