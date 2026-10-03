import React, { useEffect, useRef, useState } from "react";

const WAVEFORM_HEIGHTS = [
    25, 45, 60, 30, 75, 90, 50, 40, 70, 85,
    60, 35, 80, 95, 65, 40, 55, 75, 45, 30
];

const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

export const AudioPlayer = ({ audioUrl, duration = 0, isMyMessage = false }) => {
    const audioRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [audioDuration, setAudioDuration] = useState(duration || 0);
    const [playbackRate, setPlaybackRate] = useState(1);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
        };

        const handleLoadedMetadata = () => {
            if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
                setAudioDuration(audio.duration);
            }
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
        };

        audio.addEventListener("timeupdate", handleTimeUpdate);
        audio.addEventListener("loadedmetadata", handleLoadedMetadata);
        audio.addEventListener("ended", handleEnded);

        return () => {
            audio.removeEventListener("timeupdate", handleTimeUpdate);
            audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
            audio.removeEventListener("ended", handleEnded);
        };
    }, []);

    const togglePlay = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
        } else {
            audio.play().then(() => {
                setIsPlaying(true);
            }).catch((err) => {
                console.error("Audio playback error:", err);
            });
        }
    };

    const handleSeek = (index) => {
        const audio = audioRef.current;
        if (!audio || !audioDuration) return;

        const targetPercent = index / WAVEFORM_HEIGHTS.length;
        const targetTime = targetPercent * audioDuration;
        audio.currentTime = targetTime;
        setCurrentTime(targetTime);
    };

    const toggleSpeed = () => {
        const audio = audioRef.current;
        if (!audio) return;

        const speeds = [1, 1.5, 2];
        const nextSpeed = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
        audio.playbackRate = nextSpeed;
        setPlaybackRate(nextSpeed);
    };

    const progressPercent = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

    return (
        <div className="flex items-center gap-3 py-1 select-none min-w-[240px] max-w-xs">
            <audio ref={audioRef} src={audioUrl} preload="metadata" />

            {/* Play/Pause Button */}
            <button
                type="button"
                onClick={togglePlay}
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-md ${
                    isMyMessage
                        ? "bg-white text-purple-700 hover:bg-zinc-100"
                        : "bg-purple-600 text-white hover:bg-purple-500 shadow-purple-600/30"
                }`}
                title={isPlaying ? "Pause" : "Play"}
            >
                {isPlaying ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75.75v12a.75.75 0 01-1.5 0v-12a.75.75 0 01.75-.75zm10.5 0a.75.75 0 01.75.75v12a.75.75 0 01-1.5 0v-12a.75.75 0 01.75-.75z" clipRule="evenodd" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 fill-current translate-x-0.5" viewBox="0 0 24 24">
                        <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                    </svg>
                )}
            </button>

            {/* Waveform & Scrubber */}
            <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
                <div className="flex items-center gap-[3px] h-7 cursor-pointer py-1">
                    {WAVEFORM_HEIGHTS.map((height, index) => {
                        const barPercent = (index / WAVEFORM_HEIGHTS.length) * 100;
                        const isPlayed = barPercent <= progressPercent;

                        return (
                            <div
                                key={index}
                                onClick={() => handleSeek(index)}
                                className={`flex-1 rounded-full transition-all duration-100 ${
                                    isMyMessage
                                        ? isPlayed
                                            ? "bg-white"
                                            : "bg-white/35 hover:bg-white/60"
                                        : isPlayed
                                        ? "bg-purple-400"
                                        : "bg-white/20 hover:bg-white/40"
                                }`}
                                style={{
                                    height: `${Math.max(15, height)}%`,
                                }}
                            />
                        );
                    })}
                </div>

                {/* Timing & Speed Controller */}
                <div className="flex items-center justify-between text-[11px] font-mono leading-none">
                    <span className={isMyMessage ? "text-purple-100/90" : "text-zinc-400"}>
                        {formatDuration(isPlaying ? currentTime : audioDuration)}
                    </span>

                    <button
                        type="button"
                        onClick={toggleSpeed}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold transition-all ${
                            isMyMessage
                                ? "bg-white/15 hover:bg-white/25 text-white"
                                : "bg-white/5 hover:bg-white/10 text-purple-300"
                        }`}
                        title="Toggle playback speed"
                    >
                        {playbackRate}x
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AudioPlayer;
