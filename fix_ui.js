const fs = require('fs');
let code = fs.readFileSync('components/VideoCall.tsx', 'utf8');

// 1. Remove Auto Fullscreen Mode
code = code.replace(/\/\/ Auto fullscreen when screen sharing starts\r?\n\s*useEffect\(\(\) => \{\r?\n\s*if \(remoteScreenActive\) setFocusView\("screen"\);\r?\n\s*\}, \[remoteScreenActive\]\);\r?\n/g, '');

// 2. Add aspect ratio locking to Fullscreen Sidebar local video feed
const sidebarLocalRegex = /<div className="flex-1 w-1\/2 md:w-full md:max-h-\[50%\] bg-gray-900 rounded-lg overflow-hidden relative flex items-center justify-center shrink-0">/g;
code = code.replace(sidebarLocalRegex, '<div className="w-1/2 md:w-full aspect-[4/3] bg-gray-900 rounded-lg overflow-hidden relative flex items-center justify-center shrink-0">');

// 3. Add aspect ratio locking to Fullscreen Sidebar remote video feed
// Wait! If the above regex matches multiple? Let's check how many there are.
// Actually, they both use exactly `flex-1 w-1/2 md:w-full md:max-h-[50%]`
// By replacing all globally, it will seamlessly shrink both!

// 4. Update the actual <video> classes in State 1 & 2 to forcefully bounds via inset-0
// Around line 601 and 627, we have: `className="max-h-full max-w-full object-contain"`
// Replacing all instances inside the file where this is used for standard cameras:
code = code.replace(/<video([^>]*?)className="max-h-full max-w-full object-contain"([^>]*?)>/g, '<video$1className="absolute inset-0 w-full h-full object-contain"$2>');

// 5. Uncollapse Button for Hidden Sidebar explicitly added to Fullscreen Mode
const fullScreenLayoutEndRegex = /\{\/\* Right Sidebar \*\/\}/g;
const newHiddenSidebarButton = `
            {/* Show Sidebar Floating Button when Hidden */}
            {sidebarMode === "hidden" && isVideoFullscreen && (
               <button 
                  onClick={() => setSidebarMode("full")}
                  className="absolute top-4 right-4 z-[110] bg-black/60 hover:bg-black/80 backdrop-blur-md text-white p-2 rounded-lg shadow-2xl transition border border-white/10 flex items-center gap-2"
               >
                  <Users className="w-5 h-5" />
                  <span className="text-xs font-semibold pr-1">Show Participants</span>
               </button>
            )}

            {/* Right Sidebar */}`;
code = code.replace(fullScreenLayoutEndRegex, newHiddenSidebarButton);


// Imports correction
if (!code.includes('Users')) {
   code = code.replace(/import \{ X, Minimize2, Settings, UsersRound, Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, Copy, Check, Users/g, 'import { X, Minimize2, Settings, UsersRound, Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, Copy, Check, Users');
   if(!code.includes('Users ')) {
      // It might be imported but we need to ensure lucide-react has 'Users'
      code = code.replace(/import \{\s*/, 'import { Users, ');
   }
}


fs.writeFileSync('components/VideoCall.tsx', code);
console.log('VideoCall bugfixes complete.');
