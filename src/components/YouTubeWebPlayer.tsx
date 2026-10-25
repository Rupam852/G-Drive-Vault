import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

interface YouTubeWebPlayerProps {
  src: string;
  poster?: string;
  onError?: () => void;
  className?: string;
}

export function formatMediaTime(seconds: number, refDuration: number = seconds): string {
  if (!seconds || isNaN(seconds) || seconds < 0) {
    return refDuration >= 3600 ? '00:00:00' : '00:00';
  }
  const totalSecs = Math.floor(seconds);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;

  const refHours = Math.floor(refDuration / 3600);

  const pad = (n: number) => n.toString().padStart(2, '0');
  if (refHours > 0 || hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  } else {
    return `${pad(minutes)}:${pad(secs)}`;
  }
}

export const YouTubeWebPlayer: React.FC<YouTubeWebPlayerProps> = ({
  src,
  poster,
  onError,
  className = ''
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedTime, setBufferedTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState(0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }
    if (isPlaying && !isDragging) {
      hideControlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setShowSpeedMenu(false);
      }, 2500);
    }
  }, [isPlaying, isDragging]);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
    };
  }, [resetHideTimer]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(console.error);
    } else {
      video.pause();
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || isDragging) return;
    setCurrentTime(video.currentTime);

    // Update buffered progress
    if (video.buffered.length > 0) {
      try {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        setBufferedTime(bufferedEnd);
      } catch {}
    }
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration || 0);
  };

  const handleSeek = (clientX: number) => {
    const scrubber = scrubberRef.current;
    const video = videoRef.current;
    if (!scrubber || !video || !duration) return;

    const rect = scrubber.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = pos * duration;
    video.currentTime = targetTime;
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
    const video = videoRef.current;
    if (!video) return;
    const safeVol = Math.max(0, Math.min(1, newVolume));
    video.volume = safeVol;
    setVolume(safeVol);
    setIsMuted(safeVol === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted) {
      video.muted = false;
      setIsMuted(false);
      video.volume = volume > 0 ? volume : 0.5;
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(console.error);
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(console.error);
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const changeSpeed = (speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
  };

  const skipTime = (seconds: number) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration > 0 ? (bufferedTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={resetHideTimer}
      onClick={resetHideTimer}
      className={`relative w-full h-full bg-black rounded-2xl overflow-hidden group select-none flex items-center justify-center ${className}`}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        className="w-full h-full object-contain cursor-pointer"
        onClick={togglePlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onError={onError}
      />

      {/* Floating Center Play Button if paused */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute z-20 w-16 h-16 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-2xl backdrop-blur-sm hover:scale-110 active:scale-95 transition-all"
        >
          <Play size={28} className="fill-white translate-x-0.5" />
        </button>
      )}

      {/* YouTube / Netflix Control Overlay */}
      <div
        className={`absolute inset-x-0 bottom-0 z-30 flex flex-col justify-end pt-12 pb-3 px-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 ${
          showControls || !isPlaying ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Timeline Scrubber Bar */}
        <div
          ref={scrubberRef}
          onMouseDown={handleScrubberMouseDown}
          onMouseMove={handleScrubberMouseMove}
          onMouseLeave={handleScrubberMouseLeave}
          className="relative w-full h-6 flex items-center cursor-pointer group/bar mb-2"
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
            {/* Buffered Progress */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-white/35 rounded-full"
              style={{ width: `${bufferedPercent}%` }}
            />
            {/* Active Played Progress (Continuous Blue) */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-blue-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Scrubber Thumb Dot (Blue circle with white ring, expands on hover/drag) */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-blue-500 border-2 border-white shadow-md pointer-events-none transition-transform duration-100 ${
              isDragging ? 'w-4 h-4 scale-125' : 'w-3.5 h-3.5 scale-0 group-hover/bar:scale-100'
            }`}
            style={{ left: `${progressPercent}%` }}
          />
        </div>

        {/* Bottom Controls Row */}
        <div className="flex items-center justify-between text-white text-xs gap-3">
          {/* Left Controls: Play, Replay 10, Forward 10, Volume, Time Display */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="p-1 rounded-lg hover:bg-white/10 active:scale-95 transition-all text-white"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause size={18} className="fill-white" /> : <Play size={18} className="fill-white" />}
            </button>

            <button
              onClick={() => skipTime(-10)}
              className="p-1 rounded-lg hover:bg-white/10 active:scale-95 transition-all text-slate-300 hover:text-white"
              title="Replay 10 seconds"
            >
              <RotateCcw size={16} />
            </button>

            <button
              onClick={() => skipTime(10)}
              className="p-1 rounded-lg hover:bg-white/10 active:scale-95 transition-all text-slate-300 hover:text-white"
              title="Forward 10 seconds"
            >
              <RotateCw size={16} />
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-1.5 group/vol">
              <button
                onClick={toggleMute}
                className="p-1 rounded-lg hover:bg-white/10 active:scale-95 transition-all text-slate-300 hover:text-white"
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-14 h-1 accent-blue-500 bg-white/20 rounded-lg cursor-pointer"
              />
            </div>

            {/* Synchronized Formatted Time Display: HH:MM:SS or MM:SS */}
            <div className="flex items-center gap-1 font-mono text-[12px] text-slate-300 select-none ml-1">
              <span className="font-semibold text-white">{formatMediaTime(currentTime, duration)}</span>
              <span className="text-slate-500">/</span>
              <span>{formatMediaTime(duration, duration)}</span>
            </div>
          </div>

          {/* Right Controls: Playback Speed, Fullscreen */}
          <div className="flex items-center gap-2">
            {/* Speed Selector */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-slate-200"
              >
                {playbackSpeed}x
              </button>

              {showSpeedMenu && (
                <div className="absolute right-0 bottom-full mb-2 bg-slate-900/95 border border-slate-700/70 rounded-xl p-1 shadow-2xl backdrop-blur-md flex flex-col gap-0.5 z-40 min-w-[70px]">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => changeSpeed(spd)}
                      className={`px-2 py-1 text-[11px] rounded-lg text-left font-medium transition-all ${
                        playbackSpeed === spd
                          ? 'bg-blue-600 text-white font-bold'
                          : 'text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-1 rounded-lg hover:bg-white/10 active:scale-95 transition-all text-slate-300 hover:text-white"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
