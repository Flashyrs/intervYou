const fs = require('fs');
let content = fs.readFileSync('app/dashboard/page.tsx', 'utf8');

const startIdx = content.indexOf('{incoming && (');
const endIdx = content.indexOf(')}', startIdx) + 2;

if (startIdx !== -1 && endIdx !== -1) {
  const newUI = `{incoming.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl max-h-[80vh] overflow-y-auto space-y-4">
            <h2 className="text-xl font-semibold mb-2">Random Interview Requests</h2>
            <p className="text-gray-500 mb-4 text-sm">Multiple users are looking for an interviewer. Accepting one will automatically decline the rest.</p>
            {incoming.map((invite) => (
              <div key={invite.tempId} className="border border-gray-200 rounded-lg p-4 bg-gray-50 shadow-sm">
                <p className="text-gray-800 font-medium mb-3">
                  {invite.name || "A user"} <span className="font-normal text-gray-500">is looking for an interviewer.</span>
                </p>
                <div className="flex gap-3">
                  <button
                    className="flex-1 px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition text-sm font-medium"
                    onClick={() => accept(invite)}
                  >
                    Accept
                  </button>
                  <button
                    className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition text-sm font-medium text-gray-700 bg-white"
                    onClick={() => setIncoming((prev) => prev.filter((p) => p.tempId !== invite.tempId))}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}`;
  content = content.substring(0, startIdx) + newUI + content.substring(endIdx);
  fs.writeFileSync('app/dashboard/page.tsx', content);
  console.log('Replaced UI successfully');
} else {
  console.log('Could not find UI block bounds');
}
