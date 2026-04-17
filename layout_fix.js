const fs = require('fs');

let code = fs.readFileSync('app/layout.tsx', 'utf8');

code = code.replace(/import \{ LatencyMonitor \} from '@\/components\/LatencyMonitor';/g, "import { LatencyMonitor } from '@/components/LatencyMonitor';\nimport { MatchmakingProvider } from '@/components/MatchmakingProvider';");
code = code.replace(/<ToastProvider>/g, "<ToastProvider>\n            <MatchmakingProvider>");
code = code.replace(/<\/ToastProvider>/g, "</MatchmakingProvider>\n          </ToastProvider>");

fs.writeFileSync('app/layout.tsx', code);
console.log('Layout patched successfully.');
