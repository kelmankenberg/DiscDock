import log from 'electron-log/main'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

export function initializeLogging(): void {
  const logsDirectory = path.join(app.getPath('userData'), 'logs')
  fs.mkdirSync(logsDirectory, { recursive: true })
  log.transports.file.resolvePathFn = () => path.join(logsDirectory, 'main.log')
  log.transports.file.level = 'info'
  log.info('DiscDock starting', { version: app.getVersion(), platform: process.platform })

  process.on('uncaughtException', (error) => {
    log.error('Uncaught main-process exception', error)
  })
  process.on('unhandledRejection', (reason) => {
    log.error('Unhandled main-process rejection', reason)
  })
}

export function logShutdown(): void {
  log.info('DiscDock shutting down')
}

export { log }