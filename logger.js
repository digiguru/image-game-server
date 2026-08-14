function normaliseDetails(details = {}) {
  return Object.fromEntries(
    Object.entries(details).filter(([, value]) => value !== undefined),
  );
}

function createLogger(scope, { log = console.log, error = console.error } = {}) {
  const write = (level, event, details) => {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      scope,
      event,
      ...normaliseDetails(details),
    };
    const sink = level === 'error' ? error : log;
    sink(JSON.stringify(payload));
  };

  return {
    info: (event, details) => write('info', event, details),
    warn: (event, details) => write('warn', event, details),
    error: (event, details) => write('error', event, details),
  };
}

module.exports = { createLogger };
