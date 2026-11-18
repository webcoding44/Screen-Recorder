import { ChangeEvent, useRef, useState } from "react";

export const useFileInput = (maxSize: number, allowedType: string) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.type.startsWith(allowedType)) {
      setError(`Choose a valid ${allowedType.replace("/", "")} file.`);
      return;
    }
    if (selectedFile.size > maxSize) {
      setError(`File must be smaller than ${Math.round(maxSize / 1024 / 1024)} MB.`);
      return;
    }

    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setFile(selectedFile);
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);

    if (selectedFile.type.startsWith("video/")) {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        setDuration(
          Number.isFinite(video.duration) && video.duration > 0
            ? Math.round(video.duration)
            : null,
        );
        URL.revokeObjectURL(video.src);
      };
      video.src = objectUrl;
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) handleFileSelect(selectedFile);
  };

  const resetFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setDuration(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return {
    file,
    previewUrl,
    duration,
    error,
    inputRef,
    handleFileChange,
    handleFileSelect,
    resetFile,
  };
};
