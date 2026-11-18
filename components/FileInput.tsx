"use client";

import Image from "next/image";
import { DragEvent, useState } from "react";

const FileInput = ({
  id,
  label,
  accept,
  file,
  previewUrl,
  inputRef,
  onChange,
  onFileSelect,
  onReset,
  error,
  type,
}: FileInputProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) onFileSelect(droppedFile);
  };

  return (
    <section className="file-input">
      <label htmlFor={id}>{label}</label>
      <input
        type="file"
        id={id}
        accept={accept}
        hidden
        ref={inputRef}
        onChange={onChange}
      />

      {!previewUrl ? (
        <figure
          className={isDragging ? "is-dragging" : ""}
          onClick={() => inputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <Image
            src="/assets/icons/upload.svg"
            alt=""
            width={24}
            height={24}
          />
          <p>Drop your {id} here or click to browse</p>
        </figure>
      ) : (
        <div>
          {type === "video" ? (
            <video src={previewUrl} controls />
          ) : (
            <Image src={previewUrl} alt={`Selected ${id}`} fill />
          )}
          <button type="button" onClick={onReset} aria-label={`Remove ${id}`}>
            <Image
              src="/assets/icons/close.svg"
              alt=""
              width={16}
              height={16}
            />
          </button>
          <p>{file?.name}</p>
        </div>
      )}
      {error && <p className="file-error" role="alert">{error}</p>}
    </section>
  );
};

export default FileInput;
