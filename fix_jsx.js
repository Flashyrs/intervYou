const fs = require('fs');

let content = fs.readFileSync('components/VideoCall.tsx', 'utf8');

const returnIdx = content.indexOf('return (');
if (returnIdx === -1) {
  console.error("Could not find 'return ('");
  process.exit(1);
}

const newJsx = `return (
    <div className={\`relative flex flex-col w-full h-full bg-black/95 \${!autoStart ? 'rounded-none' : ''}\`}>
      {/* 
        STATE 1 & 2: Default and Screen Share (non-fullscreen) 
      */}
      {!focusView && (
        <div className="flex-1 w-full h-full flex flex-col p-2 gap-2 relative">
          
          {/* Main Screenshare Area (State 2) */}
          {(screenShareActive || remoteScreenActive) && (
            <div className="flex-1 w-full flex bg-gray-950 rounded-lg overflow-hidden relative group border border-white/10 items-center justify-center">
              <button
                type="button"
                className="absolute top-2 right-2 z-10 rounded-full bg-black/60 p-2 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/75"
                onClick={() => setFocusView("screen")}
                title="Maximize shared screen"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <video
                ref={screenShareActive ? undefined : remoteScreenRef} // We rely on the existing refs logic for mounting src, except wait...
                /* actually, the file currently uses remoteScreenRef for remote screenshare. Local screenshare isn't shown directly to local user currently, or maybe it is? We will keep existing refs. */
                playsInline
                autoPlay
                muted={screenShareActive}
                className="max-h-full max-w-full object-contain"
              />
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full">
                Screen Share
              </div>
            </div>
          )}

          {/* Videos Row (State 1 & 2) */}
          <div className={\`w-full flex flex-row gap-2 \${(screenShareActive || remoteScreenActive) ? 'h-[30%]' : 'flex-1'}\`}>
            {/* Local Video */}
            <div className="flex-1 relative bg-gray-900 rounded-lg overflow-hidden group flex items-center justify-center">
              {!camOn ? (
                <div className="flex flex-col items-center justify-center text-white/50">
                  <VideoOff className="w-8 h-8 md:w-10 md:h-10 mb-2" />
                  <span className="text-xs">Camera Off</span>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="absolute top-2 right-2 z-10 rounded-full bg-black/60 p-2 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/75"
                    onClick={() => setFocusView("local")}
                    title="Maximize your camera"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                  <video
                    ref={localRef}
                    playsInline
                    muted
                    autoPlay
                    className="max-h-full max-w-full object-contain"
                  />
                </>
              )}
              <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1.5 z-10">
                <div className={\`w-1.5 h-1.5 rounded-full \${micOn ? 'bg-green-500' : 'bg-red-500'}\`} />
                You
              </div>
            </div>

            {/* Remote Video */}
            <div className="flex-1 relative bg-gray-900 rounded-lg overflow-hidden group flex items-center justify-center">
              <button
                type="button"
                className="absolute top-2 right-2 z-10 rounded-full bg-black/60 p-2 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/75"
                onClick={() => setFocusView("remote")}
                title="Maximize remote camera"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <video
                ref={remoteRef}
                playsInline
                autoPlay
                className="max-h-full max-w-full object-contain"
              />
              <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1.5 z-10">
                <div className={\`w-1.5 h-1.5 rounded-full \${active ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}\`} />
                {active ? "Remote" : connectionState === "new" ? "Connecting..." : "Disconnected"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE 3: Fullscreen Focus View */}
      {focusView && (
        <div className="fixed inset-0 z-[100] h-[100dvh] w-screen bg-black flex flex-row">
            
          {/* Main Fullscreen Area */}
          <div className="flex-1 h-full flex flex-col items-center justify-center relative p-2 md:p-6 transition-all duration-300">
            {focusView === "screen" && (!remoteScreenActive && !screenShareActive) ? (
              <div className="text-center text-white/70">
                <Monitor className="w-8 h-8 mx-auto mb-3" />
                <p className="text-sm">No screen share is active right now.</p>
              </div>
            ) : (
              <video
                ref={focusVideoRef}
                playsInline
                autoPlay
                muted={focusView === "local" || (focusView === "screen" && screenShareActive)}
                className="max-h-full max-w-full object-contain shrink-0 flex-1"
              />
            )}
               
            {/* Header / Info in Fullscreen */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
              <div className="pointer-events-auto">
                <h3 className="text-sm font-semibold text-white drop-shadow-md">
                  {focusView === "local"
                    ? "Your Camera"
                    : focusView === "remote"
                      ? "Participant Camera"
                      : "Shared Screen"}
                </h3>
              </div>
              <div className="flex items-center gap-2 pointer-events-auto">
                {sidebarMode === "hidden" && (
                  <button 
                    onClick={() => setSidebarMode("compact")}
                    className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition backdrop-blur mr-2"
                    title="Show Sidebar"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition backdrop-blur"
                  onClick={() => setFocusView(null)}
                  title="Close focused view (Esc)"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Absolute bottom controls if sidebar is hidden */}
            {sidebarMode === "hidden" && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-900/90 backdrop-blur border border-white/10 rounded-full px-6 py-3 flex items-center gap-4 shadow-2xl z-50">
                <button
                  className={\`p-3 rounded-full transition-all \${micOn ? "bg-gray-700 text-white" : "bg-red-500 text-white"}\`}
                  onClick={toggleMic}
                  title={micOn ? "Mute" : "Unmute"}
                >
                  {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>
                <button
                  className={\`p-3 rounded-full transition-all \${camOn ? "bg-gray-700 text-white" : "bg-red-500 text-white"}\`}
                  onClick={toggleCam}
                  title={camOn ? "Stop Camera" : "Start Camera"}
                >
                  {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>
                <button
                  className={\`p-3 rounded-full transition-all \${screenShareActive ? "bg-indigo-600 text-white" : "bg-gray-700 text-white"}\`}
                  onClick={() => screenShareActive ? stopScreenShare() : startScreenShare()}
                  title={screenShareActive ? "Stop Screen Share" : "Start Screen Share"}
                >
                  <Monitor className="w-5 h-5" />
                </button>
                <div className="w-px h-6 bg-gray-700 mx-1" />
                <button
                  className="p-3 rounded-full transition-all bg-gray-700 text-white hover:bg-gray-600"
                  onClick={() => setShowSettings(!showSettings)}
                  title="Settings"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          {sidebarMode !== "hidden" && (
            <div 
              className={\`h-full border-l border-white/10 bg-black/60 backdrop-blur transition-all duration-300 flex flex-col \${sidebarMode === "full" ? 'w-[25%] md:w-[20%] min-w-[200px] max-w-[300px]' : 'w-20'} shrink-0 z-40\`}
            >
              {/* Sidebar Header */}
              <div className="h-14 flex items-center justify-between px-4 border-b border-white/10 shrink-0">
                {sidebarMode === "full" && <span className="text-white text-sm font-semibold tracking-wide">Controls</span>}
                <button 
                  onClick={() => setSidebarMode(sidebarMode === "full" ? "compact" : "hidden")}
                  className="text-white/70 hover:text-white p-1 rounded transition ml-auto"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sidebar Videos (Full mode only) */}
              {sidebarMode === "full" && (
                <div className="flex-1 flex flex-col p-2 gap-2 overflow-y-auto w-full">
                  
                  {/* Sidebar Local Video */}
                  <div className="w-full flex-1 max-h-[50%] bg-gray-900 rounded-lg overflow-hidden relative flex items-center justify-center shrink-0">
                    {!camOn ? (
                      <div className="flex flex-col items-center justify-center text-white/50">
                        <VideoOff className="w-6 h-6 mb-1" />
                        <span className="text-[10px]">Camera Off</span>
                      </div>
                    ) : (
                      <video
                        muted
                        autoPlay
                        playsInline
                        className="max-h-full max-w-full object-contain"
                        // Since we can't reliably reuse the exact same ref in 2 places, we dynamically use localRef if it isn't in focusView
                        ref={focusView === "local" ? undefined : localRef} 
                      />
                    )}
                    <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1.5 z-10 w-fit">
                      <div className={\`w-1.5 h-1.5 rounded-full shrink-0 \${micOn ? 'bg-green-500' : 'bg-red-500'}\`} />
                      <span className="truncate max-w-[80px]">You</span>
                    </div>
                  </div>

                  {/* Sidebar Remote Video */}
                  <div className="w-full flex-1 max-h-[50%] bg-gray-900 rounded-lg overflow-hidden relative flex items-center justify-center shrink-0">
                    <video
                      autoPlay
                      playsInline
                      className="max-h-full max-w-full object-contain"
                      ref={focusView === "remote" ? undefined : remoteRef}
                    />
                    <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1.5 z-10 w-fit">
                      <div className={\`w-1.5 h-1.5 rounded-full shrink-0 \${active ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}\`} />
                      <span className="truncate max-w-[80px]">{active ? "Remote" : "Connecting"}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sidebar Controls (Compact & Full) */}
              <div className={\`mt-auto border-t border-white/10 shrink-0 \${sidebarMode === "compact" ? "p-3 flex flex-col gap-4 items-center" : "p-4 flex flex-wrap gap-2 justify-center"}\`}>
                <button
                  className={\`\${sidebarMode === "compact" ? "p-3" : "p-2 md:p-3"} shrink-0 rounded-full transition-all \${micOn ? "bg-gray-700 text-white" : "bg-red-500 text-white"}\`}
                  onClick={toggleMic}
                  title={micOn ? "Mute" : "Unmute"}
                >
                  {micOn ? <Mic className="w-4 h-4 md:w-5 md:h-5" /> : <MicOff className="w-4 h-4 md:w-5 md:h-5" />}
                </button>
                <button
                  className={\`\${sidebarMode === "compact" ? "p-3" : "p-2 md:p-3"} shrink-0 rounded-full transition-all \${camOn ? "bg-gray-700 text-white" : "bg-red-500 text-white"}\`}
                  onClick={toggleCam}
                  title={camOn ? "Stop Camera" : "Start Camera"}
                >
                  {camOn ? <Video className="w-4 h-4 md:w-5 md:h-5" /> : <VideoOff className="w-4 h-4 md:w-5 md:h-5" />}
                </button>
                <button
                  className={\`\${sidebarMode === "compact" ? "p-3" : "p-2 md:p-3"} shrink-0 rounded-full transition-all \${screenShareActive ? "bg-indigo-600 text-white" : "bg-gray-700 text-white hover:bg-gray-600"}\`}
                  onClick={() => screenShareActive ? stopScreenShare().catch(()=>{}) : startScreenShare().catch(()=>{})}
                  title={screenShareActive ? "Stop Screen Share" : "Start Screen Share"}
                >
                  <Monitor className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                <button
                  className={\`\${sidebarMode === "compact" ? "p-3" : "p-2 md:p-3"} shrink-0 rounded-full transition-all \${showSettings ? "bg-indigo-600 text-white" : "bg-gray-700 text-white hover:bg-gray-600"}\`}
                  onClick={() => setShowSettings(!showSettings)}
                  title="Settings"
                >
                  <Settings className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Global Non-Fullscreen Bottom Toolbar (State 1 & 2) */}
      {!focusView && (
        <div className="h-12 md:h-16 bg-gray-900/90 backdrop-blur border-t border-white/10 flex items-center justify-between px-2 md:px-6 shrink-0 w-full z-20">
          <div className="flex flex-col truncate w-[30%]">
            <span className="text-[10px] md:text-[11px] text-white/70 uppercase tracking-wider font-medium truncate">
              {active ? "Call Connected" : callChannelReady ? (role === "interviewee" ? "Starting Call..." : "Waiting For Candidate...") : "Connecting..."}
            </span>
          </div>

          <div className="flex items-center justify-center gap-2 md:gap-3 shrink-0">
            <button
              className={\`p-2 md:p-3 rounded-full transition-all duration-200 \${micOn ? "bg-gray-700 text-white hover:bg-gray-600 hover:scale-105" : "bg-red-500 text-white hover:bg-red-600 hover:scale-105"}\`}
              onClick={toggleMic}
            >
              {micOn ? <Mic className="w-4 h-4 md:w-5 md:h-5" /> : <MicOff className="w-4 h-4 md:w-5 md:h-5" />}
            </button>
            <button
              className={\`p-2 md:p-3 rounded-full transition-all duration-200 \${camOn ? "bg-gray-700 text-white hover:bg-gray-600 hover:scale-105" : "bg-red-500 text-white hover:bg-red-600 hover:scale-105"}\`}
              onClick={toggleCam}
            >
              {camOn ? <Video className="w-4 h-4 md:w-5 md:h-5" /> : <VideoOff className="w-4 h-4 md:w-5 md:h-5" />}
            </button>
            <button
              className={\`p-2 md:p-3 rounded-full transition-all duration-200 \${screenShareActive ? "bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105" : "bg-gray-700 text-white hover:bg-gray-600 hover:scale-105"}\`}
              onClick={() => screenShareActive ? stopScreenShare().catch(()=>{}) : startScreenShare().catch(()=>{})}
            >
              <Monitor className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <div className="w-px h-8 bg-gray-700 mx-1" />
            <button
              className={\`p-3 rounded-full transition-all duration-200 \${showSettings ? "bg-indigo-600 text-white shadow-lg" : "bg-gray-700 text-white hover:bg-gray-600"}\`}
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
          <div className="w-[30%] flex justify-end">
            <button
              type="button"
              className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition text-xs font-medium flex items-center gap-1.5"
              onClick={() => setSidebarMode("full")}
            >
              Sidebar
            </button>
          </div>
        </div>
      )}

      {/* Global Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-in fade-in duration-200 text-left">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4" /> Device Settings
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-gray-400 uppercase font-medium tracking-wider">Camera</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={videoDeviceId}
                  onChange={(e) => setVideoDeviceId(e.target.value)}
                >
                  <option value="">Default Camera</option>
                  {devices.filter((d) => d.kind === "videoinput").map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || \`Camera \${d.deviceId.slice(0, 8)}\`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-400 uppercase font-medium tracking-wider">Microphone</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={audioDeviceId}
                  onChange={(e) => setAudioDeviceId(e.target.value)}
                >
                  <option value="">Default Microphone</option>
                  {devices.filter((d) => d.kind === "audioinput").map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || \`Mic \${d.deviceId.slice(0, 8)}\`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pt-4 flex gap-2">
                <button
                  className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition text-sm"
                  onClick={() => setShowSettings(false)}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
                  onClick={switchDevices}
                >
                  Apply Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`;

content = content.substring(0, returnIdx) + newJsx;
fs.writeFileSync('components/VideoCall.tsx', content);
