import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Music } from 'lucide-react';
import { formatMediaTime } from './YouTubeWebPlayer';

interface YouTubeWebAudioPlayerProps {
  src: string;
  fileName: string;
  fileSize?: string;
  autoPlay?: boolean;
  onError?: () => void;
}

export const YouTubeWebAudioPlayer: React.FC<YouTubeWebAudioPlayerProps> = ({
  src,
  fileName,
  fileSize,
  autoPlay = false,
  onError
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (autoPlay) {
      audio.play().catch(console.error);
    }
  }, [autoPlay, src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || isDragging) return;
    setCurrentTime(audio.currentTime);
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setDuration(audio.duration || 0);
  };

  const handleSeek = (clientX: number) => {
    const scrubber = scrubberRef.current;
    const audio = audioRef.current;
    if (!scrubber || !audio || !duration) return;

    const rect = scrubber.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = pos * duration;
    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const handleScrubberMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleSeek(e.clientX);

    const onMouseMove = (moveEvent: MouseEvent) => {
      handleSeek(moveEvent.clientX);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleScrubberMouseMove = (e: React.MouseEvent) => {
    const scrubber = scrubberRef.current;
    if (!scrubber || !duration) return;
    const rect = scrubber.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos * 100);
    setHoverTime(pos * duration);
  };

  const handleScrubberMouseLeave = () => {
    setHoverTime(null);
  };

  const skipTime = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + seconds));
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto p-4 select-none">
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onError={onError}
      />

      {/* Rotating Vinyl Record (Turnable Disc) */}
      <div className="relative w-40 h-40 flex items-center justify-center my-3 select-none">
        {/* Glow ambient background */}
        <div
          className={`absolute inset-0 rounded-full bg-purple-600/20 blur-xl transition-opacity duration-700 ${
            isPlaying ? 'opacity-100' : 'opacity-40'
          }`}
        />

        {/* Rotating Vinyl Record */}
        <div
          className="relative w-36 h-36 rounded-full bg-[#13121A] border-2 border-purple-500/40 flex items-center justify-center shadow-2xl shadow-purple-950/80 transition-transform"
          style={{
            animation: 'spin 8s linear infinite',
            animationPlayState: isPlaying ? 'running' : 'paused'
          }}
        >
          {/* Concentric Grooves */}
          <div className="absolute w-30 h-30 rounded-full border border-white/[0.08]" />
          <div className="absolute w-24 h-24 rounded-full border border-white/[0.08]" />
          <div className="absolute w-18 h-18 rounded-full border border-white/[0.08]" />

          {/* Vinyl Center Label */}
          <div className="relative w-14 h-14 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-500 border-2 border-purple-300/50 flex items-center justify-center shadow-lg">
            <Music size={20} className="text-white drop-shadow" />
            {/* Center Spindle Hole */}
            <div className="absolute w-2.5 h-2.5 rounded-full bg-[#13121A] border border-white/30" />
          </div>
        </div>
      </div>

      {/* Title & Size */}
      <h3 className="text-white font-bold text-base text-center line-clamp-2 px-2 mb-1 break-words">
        {fileName}
      </h3>
      {fileSize && (
        <span className="text-xs font-medium text-slate-400 mb-5">{fileSize} • Audio Track</span>
      )}

      {/* Sleek YouTube / Spotify Line Scrubber */}
      <div className="w-full px-2 mb-2">
        <div
          ref={scrubberRef}
          onMouseDown={handleScrubberMouseDown}
          onMouseMove={handleScrubberMouseMove}
          onMouseLeave={handleScrubberMouseLeave}
          className="relative w-full h-6 flex items-center cursor-pointer group/bar"
        >
          {/* Hover Time Tooltip */}
          {hoverTime !== null && (
            <div
              className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded bg-slate-900/95 border border-slate-700/60 text-[11px] font-mono text-white shadow-lg pointer-events-none"
              style={{ left: `${hoverPosition}%` }}
            >
              {formatMediaTime(hoverTime, duration)}
            </div>
          )}

          {/* Background Track (Sleek 3.5px line, expands to 5px on hover) */}
          <div className="relative w-full h-[3.5px] group-hover/bar:h-[5px] bg-white/20 rounded-full overflow-hidden transition-all duration-150">
            {/* Active Played Progress (Smooth Continuous Purple) */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-purple-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Scrubber Thumb Dot */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-purple-500 border-2 border-white shadow-md pointer-events-none transition-transform duration-100 ${
              isDragging ? 'w-4 h-4 scale-125' : 'w-3.5 h-3.5 scale-0 group-hover/bar:scale-100'
            }`}
            style={{ left: `${progressPercent}%` }}
          />
        </div>

        {/* Synchronized Time Display: HH:MM:SS or MM:SS */}
        <div className="flex items-center justify-between font-mono text-xs text-slate-400 mt-1 select-none">
          <span className="text-white font-medium">{formatMediaTime(currentTime, duration)}</span>
          <span>{formatMediaTime(duration, duration)}</span>
        </div>
      </div>

      {/* Centered Audio Playback Controls (Middle below slide bar) */}
      <div className="flex items-center justify-center gap-7 w-full mt-3">
        <button
          onClick={() => skipTime(-10)}
          className="p-3 rounded-full text-slate-300 hover:text-white hover:bg-white/10 active:scale-90 transition-all flex items-center justify-center"
          title="Replay 10 seconds"
        >
          <RotateCcw size={22} />
        </button>

        <button
          onClick={togglePlay}
          className="w-15 h-15 rounded-full bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center shadow-xl shadow-purple-600/40 active:scale-95 hover:scale-105 transition-all"
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={28} className="fill-white" /> : <Play size={28} className="fill-white translate-x-0.5" />}
        </button>

        <button
          onClick={() => skipTime(10)}
          className="p-3 rounded-full text-slate-300 hover:text-white hover:bg-white/10 active:scale-90 transition-all flex items-center justify-center"
          title="Forward 10 seconds"
        >
          <RotateCw size={22} />
        </button>
      </div>
    </div>
  );
};
