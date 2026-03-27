const fs = require("fs");
const path = require("path");

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

let currentLevel = LOG_LEVELS.INFO;

function setLogLevel(level) {
  if (LOG_LEVELS[level] !== undefined) {
    currentLevel = LOG_LEVELS[level];
  }
}

function formatMessage(level, message, data) {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` | ${JSON.stringify(data)}` : "";
  return `[${timestamp}] [${level}] ${message}${dataStr}`;
}

const logger = {
  debug(message, data) {
    if (currentLevel <= LOG_LEVELS.DEBUG) {
      console.log(formatMessage("DEBUG", message, data));
    }
  },
  info(message, data) {
    if (currentLevel <= LOG_LEVELS.INFO) {
      console.log(formatMessage("INFO", message, data));
    }
  },
  warn(message, data) {
    if (currentLevel <= LOG_LEVELS.WARN) {
      console.warn(formatMessage("WARN", message, data));
    }
  },
  error(message, data) {
    if (currentLevel <= LOG_LEVELS.ERROR) {
      console.error(formatMessage("ERROR", message, data));
    }
  }
};

module.exports = {
  logger,
  setLogLevel
};
