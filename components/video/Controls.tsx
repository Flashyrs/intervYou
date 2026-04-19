import { Mic, MicOff, Settings, Monitor, Video, VideoOff } from "lucide-react";

export function Controls({
  micOn,
  camOn,
  screenShareActive,
  showSettings,
  onToggleMic,
  onToggleCam,
  onToggleScreenShare,
  onToggleSettings,
}: {
  micOn: boolean;
  camOn: boolean;
  screenShareActive: boolean;
  showSettings: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreenShare: () => void;
  onToggleSettings: () => void;
}) {
  return (
    <>
      <button
        className={`rounded-full p-2 md:p-3 transition-all duration-200 ${
          micOn ? "bg-gray-700 text-white hover:bg-gray-600" : "bg-red-500 text-white hover:bg-red-600"
        }`}
        onClick={onToggleMic}
        title={micOn ? "Mute" : "Unmute"}
      >
        {micOn ? <Mic className="h-4 w-4 md:h-5 md:w-5" /> : <MicOff className="h-4 w-4 md:h-5 md:w-5" />}
      </button>
      <button
        className={`rounded-full p-2 md:p-3 transition-all duration-200 ${
          camOn ? "bg-gray-700 text-white hover:bg-gray-600" : "bg-red-500 text-white hover:bg-red-600"
        }`}
        onClick={onToggleCam}
        title={camOn ? "Stop Camera" : "Start Camera"}
      >
        {camOn ? <Video className="h-4 w-4 md:h-5 md:w-5" /> : <VideoOff className="h-4 w-4 md:h-5 md:w-5" />}
      </button>
      <button
        className={`rounded-full p-2 md:p-3 transition-all duration-200 ${
          screenShareActive ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-gray-700 text-white hover:bg-gray-600"
        }`}
        onClick={onToggleScreenShare}
        title={screenShareActive ? "Stop Screen Share" : "Start Screen Share"}
      >
        <Monitor className="h-4 w-4 md:h-5 md:w-5" />
      </button>
      <button
        className={`rounded-full p-2 md:p-3 transition-all duration-200 ${
          showSettings ? "bg-indigo-600 text-white" : "bg-gray-700 text-white hover:bg-gray-600"
        }`}
        onClick={onToggleSettings}
        title="Settings"
      >
        <Settings className="h-4 w-4 md:h-5 md:w-5" />
      </button>
    </>
  );
}
