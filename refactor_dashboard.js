const fs = require('fs');

let code = fs.readFileSync('app/dashboard/page.tsx', 'utf8');

// 1. Imports
code = code.replace(/import \{ supabase \} from "@\/lib\/supabase";\r?\n/g, '');
code = code.replace(/import \{ presenceChannel \} from "@\/lib\/presence";\r?\n/g, '');
code = code.replace(/import \{ useSession, signIn \} from "next-auth\/react";/g, 'import { useSession, signIn } from "next-auth/react";\nimport { useMatchmaking } from "@/components/MatchmakingProvider";');

// 2. States
const stateBlockRegex = /const \[incoming, setIncoming\] = useState([\s\S]*?)const \[online, setOnline\] = useState<string\[\]>\(\[\]\);/g;
code = code.replace(stateBlockRegex, 'const { online, incoming, status, startRandom, acceptRandom, declineRandom } = useMatchmaking();\n  const [loadingHistory, setLoadingHistory] = useState(false); // Used internally below it seems, wait, we do not need to delete unrelated states');

// Let's just manually replace the exact block:
code = code.replace(/const \[incoming, setIncoming\] = useState[^\n]*\n/g, '');
code = code.replace(/const \[status, setStatus\] = useState[^\n]*\n/g, '');
code = code.replace(/const \[tempId, setTempId\] = useState[^\n]*\n/g, '');
code = code.replace(/const \[lobbyReady, setLobbyReady\] = useState[^\n]*\n/g, '');
code = code.replace(/const channelRef = useRef[^\n]*\n/g, '');
code = code.replace(/const tempIdRef = useRef[^\n]*\n/g, '');
code = code.replace(/const presenceRef = useRef[^\n]*\n/g, '');
code = code.replace(/const \[online, setOnline\] = useState[^\n]*\n/g, '');
code = code.replace(/  const \{ data: session, status: authStatus \} = useSession\(\);\n/g, '  const { data: session, status: authStatus } = useSession();\n  const { online, incoming, status, startRandom, acceptRandom, declineRandom } = useMatchmaking();\n');

// 3. Effects to delete
code = code.replace(/useEffect\(\(\) => \{\s*tempIdRef\.current = tempId;\s*\}, \[tempId\]\);\r?\n/g, '');
code = code.replace(/const userName = session\?\.user\?\.name;\s*const userEmail = session\?\.user\?\.email;\r?\n/g, '');

const effect1Regex = /useEffect\(\(\) => \{\s*if \(\!supabase\)[^]*?\{\s*if \(channelRef\.current \&\& supabase\) supabase\.removeChannel\(channelRef\.current\);\s*\}\;\s*\}, \[router, userId, push\]\);\r?\n/g;
code = code.replace(effect1Regex, '');

const effect2Regex = /useEffect\(\(\) => \{\s*if \(\!supabase \|\| \!userId\) return;[^]*?\{\s*setOnline\(\[\]\);\s*if \(presenceRef\.current \&\& supabase\) supabase\.removeChannel\(presenceRef\.current\);\s*\}\;\s*\}, \[userId, userName, userEmail\]\);\r?\n/g;
code = code.replace(effect2Regex, '');

const startRandomRegex = /const startRandom = async \(\) => \{[^]*?const handleViewRecords = \(sessionId: string\) => \{/g;
code = code.replace(startRandomRegex, 'const handleViewRecords = (sessionId: string) => {\n');

// 4. Change acceptRandom call
code = code.replace(/<button\s*onClick=\{.*\}\s*className="flex-1 bg-green-500.*"\>\s*<PhoneCall className="w-3.5 h-3.5" \/> Accept Match\s*<\/button>/g, '<button onClick={() => acceptRandom(req)} className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold py-2 rounded flex items-center justify-center gap-2 transition"><PhoneCall className="w-3.5 h-3.5" /> Accept Match</button>');

// 5. Change declineRandom call
code = code.replace(/onClick=\{\(\) => setIncoming\(\(prev\) => prev.filter\(\(p\) => p.tempId !== req.tempId\)\)\}/g, 'onClick={() => declineRandom(req.tempId)}');


fs.writeFileSync('app/dashboard/page.tsx', code);
console.log('Script written!');
