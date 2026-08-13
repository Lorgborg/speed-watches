import { Router } from 'express'
import fs from 'fs'
import path from 'path'

const router = Router()

const methodFolders = ['get', 'post', 'remove', 'update'] as const

for (const method of methodFolders) {
  const dirPath = path.join(__dirname, method)

  if (!fs.existsSync(dirPath)) continue

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'))

  for (const file of files) {
    const route = require(path.join(dirPath, file)).default
    router.use(route) // each file's own router already defines the method (get/post) and path
  }
}

export default router