/* oxlint-disable import/no-named-as-default, import/no-named-as-default-member -- Hls is the intended default export API */
import Hls, { ErrorTypes, Events as HlsEvents } from "hls.js";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const HLS_BASE = import.meta.env.VITE_HLS_BASE ?? "https://hls.example.com";

const SECONDS_PER_MINUTE = 60;
const PAD_LENGTH = 2;
const DEFAULT_MAX_DURATION = 100;

interface PlayerProps {
  sessionId: string;
  isLive?: boolean;
}

function useHlsPlayer(playlistUrl: string, isLive: boolean) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (Hls.isSupported()) {
      return setupHls({ audio, hlsRef, playlistUrl, isLive, setError });
    } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
      audio.src = playlistUrl;
    } else {
      setError("HLS playback is not supported in this browser");
    }
  }, [playlistUrl, isLive]);

  return { audioRef, hlsRef, error };
}

function setupHls(opts: {
  audio: HTMLAudioElement;
  hlsRef: React.RefObject<Hls | undefined>;
  playlistUrl: string;
  isLive: boolean;
  setError: (error: string | undefined) => void;
}) {
  const hls = new Hls({ enableWorker: true, lowLatencyMode: opts.isLive });
  opts.hlsRef.current = hls;

  hls.loadSource(opts.playlistUrl);
  hls.attachMedia(opts.audio);

  hls.on(HlsEvents.MANIFEST_PARSED, () => opts.setError(undefined));
  hls.on(HlsEvents.ERROR, (_, data) => {
    if (!data.fatal) return;
    recoverOrDestroy(hls, data.type, opts.setError);
  });

  return () => {
    hls.destroy();
    opts.hlsRef.current = undefined;
  };
}

function recoverOrDestroy(
  hls: Hls,
  type: ErrorTypes,
  setError: (error: string | undefined) => void,
) {
  if (type === ErrorTypes.NETWORK_ERROR) {
    setError("Network error - trying to recover...");
    hls.startLoad();
  } else if (type === ErrorTypes.MEDIA_ERROR) {
    setError("Media error - trying to recover...");
    hls.recoverMediaError();
  } else {
    setError("Playback failed");
    hls.destroy();
  }
}

function useAudioEvents(audioRef: React.RefObject<HTMLAudioElement | null>) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlers = {
      timeupdate: () => setCurrentTime(audio.currentTime),
      durationchange: () => setDuration(audio.duration),
      play: () => setIsPlaying(true),
      pause: () => setIsPlaying(false),
    } as const;

    for (const [event, handler] of Object.entries(handlers)) {
      audio.addEventListener(event, handler);
    }
    return () => {
      for (const [event, handler] of Object.entries(handlers)) {
        audio.removeEventListener(event, handler);
      }
    };
  }, [audioRef]);

  return { isPlaying, isMuted, setIsMuted, currentTime, setCurrentTime, duration };
}

export function Player({ sessionId, isLive = false }: PlayerProps) {
  const playlistUrl = `${HLS_BASE}/${sessionId}/${isLive ? "live" : "vod"}/index.m3u8`;
  const { audioRef, error } = useHlsPlayer(playlistUrl, isLive);
  const { isPlaying, isMuted, setIsMuted, currentTime, setCurrentTime, duration } =
    useAudioEvents(audioRef);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.pause();
    else void audio.play();
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setIsMuted(audio.muted);
  };

  const seek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = parseFloat(event.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- audio-only player, no captions needed */}
      <audio ref={audioRef} />

      {error && <div className="mb-4 text-sm text-red-400">{error}</div>}

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-white hover:bg-green-700"
        >
          {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="ml-1 h-6 w-6" />}
        </button>

        <div className="flex-1">
          {isLive ? (
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <span className="text-sm font-medium text-red-400">LIVE</span>
            </div>
          ) : (
            <SeekBar currentTime={currentTime} duration={duration} onSeek={seek} />
          )}
        </div>

        <button type="button" onClick={toggleMute} className="text-zinc-400 hover:text-zinc-100">
          {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / SECONDS_PER_MINUTE);
  const secs = Math.floor(seconds % SECONDS_PER_MINUTE);
  return `${mins}:${String(secs).padStart(PAD_LENGTH, "0")}`;
}

function SeekBar({
  currentTime,
  duration,
  onSeek,
}: {
  currentTime: number;
  duration: number;
  onSeek: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-1">
      <input
        type="range"
        min={0}
        max={duration || DEFAULT_MAX_DURATION}
        value={currentTime}
        onChange={onSeek}
        className="w-full cursor-pointer accent-green-500"
      />
      <TimeDisplay currentTime={formatTime(currentTime)} duration={formatTime(duration)} />
    </div>
  );
}

function TimeDisplay({ currentTime, duration }: { currentTime: string; duration: string }) {
  return (
    <div className="flex justify-between text-xs text-zinc-500">
      <span>{currentTime}</span>
      <span>{duration}</span>
    </div>
  );
}
