// prisma/prisma.config.ts
import 'dotenv/config' // To explicitly load .env variables locally
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  // This is where you move the database URL configuration for the CLI tools
  datasource: {
    url: env('DATABASE_URL'),
    // Add other fields here if needed, like shadowDatabaseUrl
  },
})