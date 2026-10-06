import React, { useState } from "react";

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * WhatsApp-Style Circular Upload & Download Progress Indicator
 * Overlaid on images, videos, and documents
 */
export const CircularTransferProgress = ({
  status = "download_available", // uploading, downloading, download_available, completed, failed, expired, checking_sender, waiting_for_sender, unavailable
  progress = 0, // 0 to 100
  loadedBytes = 0,
  totalBytes = 0,
  fileSize = 0,
  onStartDownload,
  onCancel,
  onRetry,
  onRedownloadAgain,
  size = 50,
  strokeWidth = 3.5,
  isOverlay = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const normalizedProgress = Math.min(100, Math.max(0, Math.round(progress)));
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (normalizedProgress / 100) * circumference;

  const isUploading = status === "uploading";
  const isDownloading = status === "downloading";
  const isTransferring = isUploading || isDownloading;

  const displayTotal = totalBytes || fileSize;
  const hasBytes = displayTotal > 0;

  return (
    <div
      className={`inline-flex flex-col items-center justify-center select-none ${
        isOverlay ? "relative z-10" : ""
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Circle Container */}
      <div
        className="relative flex items-center justify-center cursor-pointer transition-transform duration-150 active:scale-95 group"
        style={{ width: size, height: size }}
        onClick={(e) => {
          e.stopPropagation();
          if (isTransferring && onCancel) {
            onCancel();
          } else if (
            (status === "download_available" ||
              status === "available" ||
              status === "pending_delivery") &&
            onStartDownload
          ) {
            onStartDownload();
          } else if (status === "failed" && onRetry) {
            onRetry();
          } else if (status === "expired" && onRedownloadAgain) {
            onRedownloadAgain();
          }
        }}
      >
        {/* Backdrop Disc for WhatsApp Contrast */}
        <div
          className="absolute inset-0 rounded-full bg-black/65 backdrop-blur-md border border-white/10 shadow-lg"
          style={{ width: size, height: size }}
        />

        {/* SVG Progress Ring */}
        <svg
          className={`absolute transform -rotate-90 ${
            status === "checking_sender" ? "animate-spin" : ""
          }`}
          width={size}
          height={size}
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />

          {/* Progress circle */}
          {(isTransferring || normalizedProgress > 0) && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={isUploading ? "#a855f7" : "#10b981"}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              style={{
                transition: "stroke-dashoffset 200ms ease-out",
              }}
            />
          )}

          {/* Pulsing ring for checking sender */}
          {status === "checking_sender" && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#38bdf8"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference / 3}
              strokeDashoffset={0}
              strokeLinecap="round"
              fill="transparent"
            />
          )}
        </svg>

        {/* Inner Center Icon / Content */}
        <div className="relative z-10 flex items-center justify-center text-white">
          {/* Transferring State: Show % or Cancel X on hover */}
          {isTransferring && (
            <>
              {isHovered && onCancel ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4 text-white/90 group-hover:text-red-400 transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <span className="text-[11px] font-bold font-mono tracking-tighter text-white">
                  {normalizedProgress}%
                </span>
              )}
            </>
          )}

          {/* Waiting / Download Available State: WhatsApp-style Down Arrow */}
          {!isTransferring &&
            (status === "download_available" ||
              status === "available" ||
              status === "pending_delivery") && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 text-white group-hover:translate-y-0.5 transition-transform"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
            )}

          {/* Failed State: Retry Icon */}
          {!isTransferring && status === "failed" && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 text-red-400 group-hover:rotate-180 transition-transform duration-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          )}

          {/* Expired State: Download Again Icon */}
          {!isTransferring && status === "expired" && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5 text-amber-300 group-hover:rotate-180 transition-transform duration-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          )}

          {/* Checking Sender State: Searching Dots */}
          {!isTransferring && status === "checking_sender" && (
            <div className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
          )}

          {/* Waiting for Sender State: Clock */}
          {!isTransferring && status === "waiting_for_sender" && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 text-sky-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}

          {/* Unavailable State: Crossed Cloud */}
          {!isTransferring && status === "unavailable" && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Optional Status Label / Byte Counter below */}
      {isTransferring && hasBytes && (
        <span className="mt-1 text-[10px] font-mono text-white/90 bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-md">
          {loadedBytes > 0
            ? `${formatBytes(loadedBytes)} / ${formatBytes(displayTotal)}`
            : formatBytes(displayTotal)}
        </span>
      )}

      {/* Available File Size Badge */}
      {!isTransferring &&
        (status === "download_available" ||
          status === "available" ||
          status === "pending_delivery") &&
        hasBytes && (
          <span className="mt-1 text-[10px] font-semibold text-white/95 bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-md">
            {formatBytes(displayTotal)}
          </span>
        )}

      {/* Status Badges */}
      {status === "failed" && (
        <span className="mt-1 text-[10px] font-medium text-red-300 bg-red-950/80 px-2 py-0.5 rounded-full border border-red-500/30">
          Retry
        </span>
      )}

      {status === "expired" && (
        <span className="mt-1 text-[10px] font-medium text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-500/30">
          Download Again
        </span>
      )}

      {status === "checking_sender" && (
        <span className="mt-1 text-[10px] font-medium text-sky-300 bg-sky-950/80 px-2 py-0.5 rounded-full border border-sky-500/30 text-center max-w-[140px] truncate">
          Checking sender...
        </span>
      )}

      {status === "waiting_for_sender" && (
        <span className="mt-1 text-[10px] font-medium text-sky-200 bg-zinc-900/90 px-2 py-0.5 rounded-full border border-zinc-700/50 text-center max-w-[150px] truncate">
          Waiting for sender
        </span>
      )}

      {status === "unavailable" && (
        <span className="mt-1 text-[10px] font-medium text-zinc-400 bg-zinc-900/90 px-2 py-0.5 rounded-full border border-zinc-700/50">
          Unavailable
        </span>
      )}
    </div>
  );
};

export default CircularTransferProgress;
