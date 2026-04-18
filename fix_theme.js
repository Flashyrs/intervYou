const fs = require('fs');
let code = fs.readFileSync('components/MatchmakingProvider.tsx', 'utf8');

code = code.replace(/className="bg-indigo-600 px-4 py-2 flex items-center justify-between"/g, 'className="bg-black px-4 py-3 flex items-center justify-between border-b border-gray-200"');
code = code.replace(/bg-green-500 hover:bg-green-600 text-white/g, 'bg-black hover:bg-gray-800 text-white');
// Wait, the popup originally had line 230:
// <div className="bg-white border rounded-lg shadow-xl overflow-hidden animate-in slide-in-from-right-4 fade-in duration-300">
// This is already fine.
// And Cancel button:
// bg-gray-100 hover:bg-gray-200 text-gray-700
// We can change that to border border-gray-300 hover:bg-gray-50 text-gray-800
code = code.replace(/bg-gray-100 hover:bg-gray-200 text-gray-700/g, 'border border-gray-300 hover:bg-gray-50 text-gray-800');

fs.writeFileSync('components/MatchmakingProvider.tsx', code);
console.log('Theme patched to black and white!');
