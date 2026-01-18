const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load .env manually since we can't rely on dotenv-cli being installed
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
    });
}

console.log('Environment loaded from .env');
console.log('Running prisma db push with prisma/prisma.config.mjs...');

try {
    execSync('npx prisma db push --config prisma/prisma.config.mjs', { stdio: 'inherit', env: process.env });
} catch (error) {
    console.error('DB Push failed:', error.message);
    process.exit(1);
}
