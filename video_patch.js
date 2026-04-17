const fs = require('fs');
let code = fs.readFileSync('components/VideoCall.tsx', 'utf8');

// 1. Remove Auto Fullscreen useEffect
code = code.replace(/\/\/ Auto fullscreen when screen sharing starts\n\s*useEffect\(\(\) => \{\n\s*if \(remoteScreenActive\) setFocusView\(\"screen\"\);\n\s*\}, \[remoteScreenActive\]\);\n/g, '');

// 2. Change isVideoFullscreen logic
code = code.replace(/const isVideoFullscreen = focusView === \"screen\" \|\| focusView === \"local\" \|\| focusView === \"remote\";/g, 'const isVideoFullscreen = focusView === "screen";');

// 3. Fix the local video render conditional in State 1/2
code = code.replace(/\{\/\* Local Video \*\/\}\n\s*<div className=\"flex-1 relative bg-gray-900 rounded-lg overflow-hidden group flex items-center justify-center\">/g, '{/* Local Video */}\n            {(focusView === null || focusView === "local" || focusView === "screen") && (<div className={`relative bg-gray-900 rounded-lg overflow-hidden group flex items-center justify-center min-h-0 min-w-0 ${focusView === "local" && !remoteScreenActive && !screenShareActive ? "w-full" : "flex-1"}`}>');
code = code.replace(/You\n\s*<\/div>\n\s*<\/div>\n\s*\{\/\* Remote Video \*\/\}/g, 'You\n               </div>\n            </div>)}\n\n            {/* Remote Video */}');

// 4. Fix remote video render conditional
code = code.replace(/\{\/\* Remote Video \*\/\}\n\s*<div className=\"flex-1 relative bg-gray-900 rounded-lg overflow-hidden group flex items-center justify-center\">/g, '{/* Remote Video */}\n            {(focusView === null || focusView === "remote" || focusView === "screen") && (<div className={`relative bg-gray-900 rounded-lg overflow-hidden group flex items-center justify-center min-h-0 min-w-0 ${focusView === "remote" && !remoteScreenActive && !screenShareActive ? "w-full" : "flex-1"}`}>');
code = code.replace(/\{active \? \"Remote\" \: connectionState === \"new\" \? \"Connecting\.\.\.\" \: \"Disconnected\"\}\n\s*<\/div>\n\s*<\/div>\n\s*<\/div>\n\s*<\/div>/g, '{active ? "Remote" : connectionState === "new" ? "Connecting..." : "Disconnected"}\n                </div>\n            </div>)}\n          </div>\n        </div>');

// 5. Update local Maximize buttons
code = code.replace(/onClick=\{\(\) => setFocusView\(\"local\"\)\}/g, 'onClick={() => setFocusView(focusView === "local" ? null : "local")}');
code = code.replace(/onClick=\{\(\) => setFocusView\(\"remote\"\)\}/g, 'onClick={() => setFocusView(focusView === "remote" ? null : "remote")}');
code = code.replace(/title="Maximize your camera"/g, 'title={focusView === "local" ? "Minimize your camera" : "Maximize your camera"}');
code = code.replace(/title="Maximize remote camera"/g, 'title={focusView === "remote" ? "Minimize remote camera" : "Maximize remote camera"}');

// 6. Update Videos Row wrapping div to have generic sizing
code = code.replace(/<div className=\{\`w-full flex flex-row gap-2 \$\(isScreenShareStandard \? 'h-\[30\%\]' : 'flex-1'\`\}>/g, '<div className={`w-full flex flex-row gap-2 ${isScreenShareStandard ? "h-[30%]" : "flex-1"} min-h-0 min-w-0`}>');

fs.writeFileSync('components/VideoCall.tsx', code);
console.log('VideoCall logic patched!');
