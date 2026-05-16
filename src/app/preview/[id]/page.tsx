'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Download, Copy, Check, FileText, Image, Video,
  Music, Archive, Code, File, Loader2, ExternalLink, Maximize2,
  X
} from 'lucide-react';

interface FileData {
  id: string;
  file_name: string;
  mime_type: string;
  size: number;
  bucket: string;
  key: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, string>;
}

function formatSize(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileIcon(mime: string) {
  if (mime.startsWith('image/')) return <Image className="w-5 h-5 text-[#a78bfa]" />;
  if (mime.startsWith('video/')) return <Video className="w-5 h-5 text-[#f472b6]" />;
  if (mime.startsWith('audio/')) return <Music className="w-5 h-5 text-[#34d399]" />;
  if (mime.includes('pdf')) return <FileText className="w-5 h-5 text-[#f87171]" />;
  if (mime.includes('zip') || mime.includes('rar') || mime.includes('tar') || mime.includes('gz'))
    return <Archive className="w-5 h-5 text-[#fbbf24]" />;
  if (mime.includes('json') || mime.includes('javascript') || mime.includes('typescript') || mime.includes('xml') || mime.includes('html') || mime.includes('css'))
    return <Code className="w-5 h-5 text-[#60a5fa]" />;
  if (mime.startsWith('text/')) return <FileText className="w-5 h-5 text-[#94a3b8]" />;
  return <File className="w-5 h-5 text-[#64748b]" />;
}

export default function PreviewPage() {
  const params = useParams();
  const router = useRouter();
  const fileId = params.id as string;
  const [file, setFile] = useState<FileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchFile = async () => {
      try {
        const res = await fetch(`/api/files?id=${fileId}`);
        if (!res.ok) throw new Error('File not found');
        const data = await res.json();
        setFile(data.file);

        // For text files, fetch content
        if (data.file.mime_type.startsWith('text/') ||
            data.file.mime_type.includes('json') ||
            data.file.mime_type.includes('xml') ||
            data.file.mime_type.includes('javascript') ||
            data.file.mime_type.includes('css') ||
            data.file.mime_type.includes('html')) {
          try {
            const textRes = await fetch(`/api/files/preview?id=${fileId}`);
            if (textRes.ok) {
              const text = await textRes.text();
              setTextContent(text);
            }
          } catch { /* ignore */ }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load file');
      } finally {
        setLoading(false);
      }
    };
    fetchFile();
  }, [fileId]);

  const handleDownload = async () => {
    try {
      const res = await fetch(`/api/files/download?bucket=${file?.bucket}&key=${file?.key}`);
      const data = await res.json();
      if (data.url) window.open(data.url, '_blank');
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const copyLink = async () => {
    if (!file) return;
    await navigator.clipboard.writeText(`${window.location.origin}/api/s3/${file.bucket}/${file.key}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleFullscreen = () => {
    if (!previewRef.current) return;
    if (!document.fullscreenElement) {
      previewRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#6366f1] animate-spin" />
      </div>
    );
  }

  if (error || !file) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'File not found'}</p>
          <button onClick={() => router.back()} className="text-[#6366f1] hover:underline">Go back</button>
        </div>
      </div>
    );
  }

  const isImage = file.mime_type.startsWith('image/');
  const isVideo = file.mime_type.startsWith('video/');
  const isAudio = file.mime_type.startsWith('audio/');
  const isPdf = file.mime_type.includes('pdf');
  const isText = textContent !== null;
  const previewUrl = `/api/files/preview?id=${file.id}`;

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-[#111118]/90 backdrop-blur-xl border-b border-[#27272a]">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#1e1e2e] transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              {getFileIcon(file.mime_type)}
              <h1 className="text-white font-medium truncate">{file.file_name}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={copyLink}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#1e1e2e] transition-colors"
              title="Copy link"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
            {(isImage || isVideo) && (
              <button
                onClick={toggleFullscreen}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#1e1e2e] transition-colors"
                title="Fullscreen"
              >
                {isFullscreen ? <X className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-2 bg-[#6366f1] hover:bg-[#818cf8] text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </button>
          </div>
        </div>
      </div>

      {/* Preview area */}
      <div ref={previewRef} className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-[#0a0a0f]">
        {isImage ? (
          <img
            src={previewUrl}
            alt={file.file_name}
            className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
          />
        ) : isVideo ? (
          <video
            controls
            autoPlay={false}
            className="max-w-full max-h-[80vh] rounded-lg shadow-2xl bg-black"
            preload="metadata"
          >
            <source src={previewUrl} type={file.mime_type} />
            Your browser does not support video playback.
          </video>
        ) : isAudio ? (
          <div className="w-full max-w-lg bg-[#111118] rounded-2xl p-8 border border-[#27272a]">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#34d399] to-[#059669] flex items-center justify-center">
                <Music className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg">{file.file_name}</h2>
                <p className="text-gray-400 text-sm">{formatSize(file.size)}</p>
              </div>
            </div>
            <audio controls className="w-full" preload="metadata">
              <source src={previewUrl} type={file.mime_type} />
              Your browser does not support audio playback.
            </audio>
          </div>
        ) : isPdf ? (
          <iframe
            src={previewUrl}
            className="w-full max-w-4xl h-[80vh] rounded-lg border border-[#27272a]"
            title={file.file_name}
          />
        ) : isText ? (
          <div className="w-full max-w-4xl bg-[#111118] rounded-2xl border border-[#27272a] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#27272a] flex items-center gap-2">
              <Code className="w-4 h-4 text-[#60a5fa]" />
              <span className="text-sm text-gray-400">{file.mime_type}</span>
            </div>
            <pre className="p-4 text-sm text-gray-300 overflow-auto max-h-[70vh] font-mono leading-relaxed whitespace-pre-wrap break-words">
              {textContent}
            </pre>
          </div>
        ) : (
          <div className="text-center bg-[#111118] rounded-2xl p-12 border border-[#27272a] max-w-md">
            <div className="w-20 h-20 rounded-2xl bg-[#1e1e2e] flex items-center justify-center mx-auto mb-4">
              {getFileIcon(file.mime_type)}
            </div>
            <h2 className="text-white font-semibold text-lg mb-1">{file.file_name}</h2>
            <p className="text-gray-400 text-sm mb-1">{file.mime_type}</p>
            <p className="text-gray-500 text-sm mb-6">{formatSize(file.size)}</p>
            <p className="text-gray-500 text-sm mb-4">Preview not available for this file type.</p>
            <button
              onClick={handleDownload}
              className="px-6 py-3 bg-[#6366f1] hover:bg-[#818cf8] text-white rounded-xl font-medium transition-colors flex items-center gap-2 mx-auto"
            >
              <Download className="w-4 h-4" /> Download File
            </button>
          </div>
        )}
      </div>

      {/* File info bar */}
      <div className="border-t border-[#27272a] bg-[#111118]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4 text-xs text-gray-500">
          <span>{file.mime_type}</span>
          <span>•</span>
          <span>{formatSize(file.size)}</span>
          <span>•</span>
          <span>Bucket: {file.bucket}</span>
          <span>•</span>
          <span>Uploaded: {new Date(file.created_at).toLocaleDateString()}</span>
          {file.metadata?.description && (
            <>
              <span>•</span>
              <span className="text-gray-400">{file.metadata.description}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
