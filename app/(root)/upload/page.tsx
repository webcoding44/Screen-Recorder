'use client';

import { useState, FormEvent, ChangeEvent, useEffect } from 'react';
import {
  getVideoUploadUrl,
  getThumbnailUploadUrl,
  saveVideoDetails,
} from '@/lib/actions/video';
import { useRouter } from 'next/navigation';
import { FileInput, FormField } from '@/components';
import { useFileInput } from '@/lib/hooks/useFileInput';
import { MAX_THUMBNAIL_SIZE, MAX_VIDEO_SIZE } from '@/constants';

const uploadFileToStorage = (
  file: File,
  uploadUrl: string,
  onProgress: (progress: number) => void,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', uploadUrl);
    request.setRequestHeader('Content-Type', file.type);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${request.status}`));
      }
    };
    request.onerror = () => reject(new Error('Network error while uploading.'));
    request.onabort = () => reject(new Error('Upload was cancelled.'));
    request.send(file);
  });

const UploadPage = () => {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [formData, setFormData] = useState<VideoFormValues>({
    title: '',
    description: '',
    tags: '',
    visibility: 'public',
  });
  const video = useFileInput(MAX_VIDEO_SIZE, 'video/');
  const thumbnail = useFileInput(MAX_THUMBNAIL_SIZE, 'image/');

  useEffect(() => {
    if (video.duration !== null) {
      setVideoDuration(video.duration);
    }
  }, [video.duration]);

  useEffect(() => {
    const checkForRecordedVideo = async () => {
      try {
        const stored = sessionStorage.getItem('recordedVideo');
        if (!stored) return;

        const { url, name, type, duration } = JSON.parse(stored);
        const blob = await fetch(url).then((res) => res.blob());
        const file = new File([blob], name, { type, lastModified: Date.now() });

        if (video.inputRef.current) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          video.inputRef.current.files = dataTransfer.files;

          const event = new Event('change', { bubbles: true });
          video.inputRef.current.dispatchEvent(event);

          video.handleFileChange({
            target: { files: dataTransfer.files },
          } as ChangeEvent<HTMLInputElement>);
        }

        if (duration) setVideoDuration(duration);

        sessionStorage.removeItem('recordedVideo');
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Error loading recorded video:', err);
      }
    };

    checkForRecordedVideo();
  }, [video]);

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    setError(null);
    setUploadProgress(0);
    setIsSubmitting(true);

    try {
      if (!video.file || !thumbnail.file) {
        setError('Please upload video and thumbnail files.');
        return;
      }

      if (!formData.title || !formData.description) {
        setError('Please fill in all required fields.');
        return;
      }

      const {
        videoId,
        uploadUrl: videoUploadUrl,
        videoUri,
        contentType: videoContentType,
      } = await getVideoUploadUrl(video.file.type, video.file.size);

      if (!videoUploadUrl || !videoUri)
        throw new Error('Failed to get video upload credentials');

      await uploadFileToStorage(
        new File([video.file], video.file.name, {
          type: videoContentType,
        }),
        videoUploadUrl,
        (progress) => setUploadProgress(Math.round(progress * 0.8)),
      );

      const {
        uploadUrl: thumbnailUploadUrl,
        thumbnailUri,
        contentType: thumbnailContentType,
      } = await getThumbnailUploadUrl(
        videoId,
        thumbnail.file.type,
        thumbnail.file.size,
      );

      if (!thumbnailUploadUrl || !thumbnailUri)
        throw new Error('Failed to get thumbnail upload credentials');

      await uploadFileToStorage(
        new File([thumbnail.file], thumbnail.file.name, {
          type: thumbnailContentType,
        }),
        thumbnailUploadUrl,
        (progress) => setUploadProgress(80 + Math.round(progress * 0.18)),
      );

      await saveVideoDetails({
        videoId,
        thumbnailUrl: thumbnailUri,
        videoUri,
        ...formData,
        duration: videoDuration,
      });

      setUploadProgress(100);
      router.push(`/video/${videoId}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred.';
      setError(message);
      setUploadProgress(0);
      console.error('Error submitting form:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className='wrapper-md upload-page'>
      <h1>Upload a video</h1>
      {error && <div className='error-field'>{error}</div>}
      <form
        className='rounded-20 gap-6 w-full flex flex-col shadow-10 px-5 py-7.5'
        onSubmit={onSubmit}
      >
        <FormField
          id='title'
          label='Title'
          value={formData.title}
          onChange={handleInputChange}
          placeholder='Enter a clear and concise video title'
        />

        <FormField
          id='description'
          label='Description'
          value={formData.description}
          onChange={handleInputChange}
          placeholder='Briefly describe what this video is about'
          as='textarea'
        />

        <FileInput
          id='video'
          label='Video'
          accept='video/*'
          file={video.file}
          previewUrl={video.previewUrl}
          inputRef={video.inputRef}
          onChange={video.handleFileChange}
          onFileSelect={video.handleFileSelect}
          onReset={video.resetFile}
          error={video.error}
          type='video'
        />

        <FileInput
          id='thumbnail'
          label='Thumbnail'
          accept='image/*'
          file={thumbnail.file}
          previewUrl={thumbnail.previewUrl}
          inputRef={thumbnail.inputRef}
          onChange={thumbnail.handleFileChange}
          onFileSelect={thumbnail.handleFileSelect}
          onReset={thumbnail.resetFile}
          error={thumbnail.error}
          type='image'
        />

        <FormField
          id='visibility'
          label='Visibility'
          value={formData.visibility}
          onChange={handleInputChange}
          as='select'
          options={[
            { value: 'public', label: 'Public' },
            { value: 'private', label: 'Private' },
          ]}
        />

        <button
          type='submit'
          disabled={isSubmitting}
          className='submit-button'
        >
          {isSubmitting ? 'Uploading...' : 'Upload Video'}
        </button>
        {isSubmitting && (
          <div className='upload-progress' role='status' aria-live='polite'>
            <div className='upload-progress-heading'>
              <span>Uploading video and thumbnail</span>
              <span>{uploadProgress}%</span>
            </div>
            <progress value={uploadProgress} max={100} />
          </div>
        )}
      </form>
    </main>
  );
};

export default UploadPage;
