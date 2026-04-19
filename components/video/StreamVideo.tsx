import { useEffect, useRef } from "react";

function safePlay(el: HTMLVideoElement, label: string) {
  if (!el.srcObject && !el.src) return;
  if (!el.paused) return;
  const promise = el.play();
  if (promise !== undefined) {
    promise.catch((err: unknown) => {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.warn(`[VideoCall] ${label} play() failed:`, err);
    });
  }
}

export function StreamVideo({
  stream,
  muted = false,
  label,
  className,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  label: string;
  className: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.srcObject = stream;
    if (stream) {
      safePlay(el, label);
    } else {
      el.removeAttribute("src");
      el.load();
    }

    const resumePlayback = () => {
      if (ref.current) safePlay(ref.current, `${label}-resume`);
    };

    el.addEventListener("loadedmetadata", resumePlayback);
    document.addEventListener("visibilitychange", resumePlayback);
    window.addEventListener("focus", resumePlayback);
    window.addEventListener("resize", resumePlayback);

    return () => {
      el.removeEventListener("loadedmetadata", resumePlayback);
      document.removeEventListener("visibilitychange", resumePlayback);
      window.removeEventListener("focus", resumePlayback);
      window.removeEventListener("resize", resumePlayback);
    };
  }, [stream, label]);

  return <video ref={ref} playsInline autoPlay muted={muted} className={className} />;
}
