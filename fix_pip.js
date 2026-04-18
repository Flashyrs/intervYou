const fs = require('fs');

let code = fs.readFileSync('components/VideoCall.tsx', 'utf8');

// The layout logic for Local Video
const localDivStart = `{(focusView === null || focusView === "local") && (<div className={\`relative bg-gray-900 rounded-lg overflow-hidden group flex items-center justify-center min-h-0 min-w-0 \${focusView === "local" && !remoteScreenActive && !screenShareActive ? "w-full" : "flex-1"}\`}>`;
const newLocalDivStart = `<div className={\`relative bg-gray-900 rounded-lg overflow-hidden group flex items-center justify-center min-h-0 min-w-0 \${focusView === "remote" ? "absolute z-20 top-4 right-4 w-32 md:w-48 aspect-[4/3] shadow-xl border border-white/20 transition-all duration-300" : "flex-1 transition-all duration-300"}\`}>`;
code = code.replace(localDivStart, newLocalDivStart);

// At the end of Local Video logic there is a closing bracket for the conditional inside `{...}`
code = code.replace(/You\r?\n\s*<\/div>\r?\n\s*<\/div>\)}/g, 'You\n               </div>\n            </div>');


// The layout logic for Remote Video
const remoteDivStart = `{(focusView === null || focusView === "remote") && (<div className={\`relative bg-gray-900 rounded-lg overflow-hidden group flex items-center justify-center min-h-0 min-w-0 \${focusView === "remote" && !remoteScreenActive && !screenShareActive ? "w-full" : "flex-1"}\`}>`;
const newRemoteDivStart = `<div className={\`relative bg-gray-900 rounded-lg overflow-hidden group flex items-center justify-center min-h-0 min-w-0 \${focusView === "local" ? "absolute z-20 top-4 right-4 w-32 md:w-48 aspect-[4/3] shadow-xl border border-white/20 transition-all duration-300" : "flex-1 transition-all duration-300"}\`}>`;
code = code.replace(remoteDivStart, newRemoteDivStart);

// At the end of Remote Video logic there is a closing bracket for the conditional inside `{...}`
code = code.replace(/\{active \? \"Remote\" \: connectionState === \"new\" \? \"Connecting\.\.\.\" \: \"Disconnected\"\}\r?\n\s*<\/div>\r?\n\s*<\/div>\)}/g, '{active ? "Remote" : connectionState === "new" ? "Connecting..." : "Disconnected"}\n                </div>\n            </div>');


// Also replace the w-full class from the flex row container to relative so absolute positioning is bounded inside the row!
// \`w-full flex flex-row gap-2 \${isScreenShareStandard ? 'h-[30%]' : 'flex-1'}\`
code = code.replace(/<div className=\{\`w-full flex flex-row gap-2 \$\{isScreenShareStandard \? 'h-\[30\%\]' \: 'flex-1'\}\`\}>/g, '<div className={`relative w-full flex flex-row gap-2 ${isScreenShareStandard ? "h-[30%]" : "flex-1"}`}>');

fs.writeFileSync('components/VideoCall.tsx', code);
console.log('VideoCall PiP modifications written!');

