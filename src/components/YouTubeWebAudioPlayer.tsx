import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Music } from 'lucide-react';
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
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
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

  const handleVolumeChange = (newVolume: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const safeVol = Math.max(0, Math.min(1, newVolume));
    audio.volume = safeVol;
    setVolume(safeVol);
    setIsMuted(safeVol === 0);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isMuted) {
      audio.muted = false;
      setIsMuted(false);
      audio.volume = volume > 0 ? volume : 0.5;
    } else {
      audio.muted = true;
      setIsMuted(true);
    }
  };

  const changeSpeed = (speed: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = speed;
    setPlaybackSpeed(speed);
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

      {/* Album / Music Art */}
      <div className="relative w-28 h-28 rounded-3xl bg-gradient-to-tr from-purple-600/30 via-indigo-600/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-xl shadow-purple-500/10 mb-4 group">
        <Music size={52} className={`transition-transform duration-500 ${isPlaying ? 'scale-110 text-purple-300' : 'scale-100'}`} />
        {isPlaying && (
          <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-purple-500"></span>
          </span>
        )}
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
            {/* Active Played Progress (Smooth Continuous Purple/Blue) */}
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

      {/* Audio Playback Controls */}
      <div className="flex items-center justify-between w-full px-4 mt-2">
        {/* Speed Selector */}
        <div className="flex items-center gap-1">
          {[0.75, 1, 1.25, 1.5].map((spd) => (
            <button
              key={spd}
              onClick={() => changeSpeed(spd)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                playbackSpeed === spd
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/5 hover:bg-white/10 text-slate-400'
              }`}
            >
              {spd}x
            </button>
          ))}
        </div>

        {/* Center Main Controls: 10s Replay, Play/Pause, 10s Forward */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => skipTime(-10)}
            className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
            title="Replay 10 seconds"
          >
            <RotateCcw size={18} />
          </button>

          <button
            onClick={togglePlay}
            className="w-13 h-13 rounded-full bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center shadow-lg shadow-purple-600/30 active:scale-95 hover:scale-105 transition-all"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={24} className="fill-white" /> : <Play size={24} className="fill-white translate-x-0.5" />}
          </button>

          <button
            onClick={() => skipTime(10)}
            className="p-2 rounded-full text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
            title="Forward 10 seconds"
          >
            <RotateCw size={18} />
          </button>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleMute}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="w-14 h-1 accent-purple-500 bg-white/20 rounded-lg cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
