'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthProvider';
import {
  Upload, Folder, File, Trash2, Download, Link, Plus, Search,
  Cloud, RefreshCw, X, Check, Copy, Image, Video, Music,
  Archive, FileText, Code, Edit,
  CheckSquare, Square, FolderPlus, Clock,
  HardDrive, FileUp,
  Link2, FileSpreadsheet, Edit3, Move, Loader2, Package
} from 'lucide-react';

interface FileItem {
  id: string;
  user_id: string;
  bucket: string;
  key: string;
  file_name: string;
  mime_type: string;
  size: number;
  telegram_file_id: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, string>;
}

interface BucketInfo {
  name: string;
  file_count: number;
  total_size: number;
}

// Skeleton Components
function FileSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-[#27272a]">
      <div className="w-5 h-5 rounded bg-[#1e1e2e] animate-pulse" />
      <div className="w-5 h-5 rounded bg-[#1e1e2e] animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 bg-[#1e1e2e] rounded animate-pulse" />
        <div className="h-3 w-1/4 bg-[#1e1e2e] rounded animate-pulse" />
      </div>
      <div className="flex gap-1">
        <div className="w-8 h-8 rounded-lg bg-[#1e1e2e] animate-pulse" />
        <div className="w-8 h-8 rounded-lg bg-[#1e1e2e] animate-pulse" />
        <div className="w-8 h-8 rounded-lg bg-[#1e1e2e] animate-pulse" />
      </div>
    </div>
  );
}

function BucketSkeleton() {
  return (
    <div className="flex-shrink-0 w-28 h-10 rounded-xl bg-[#1e1e2e] animate-pulse" />
  );
}

function StatSkeleton() {
  return (
    <div className="h-4 w-20 bg-[#1e1e2e] rounded animate-pulse" />
  );
}

// Popup Component
function Popup({ isOpen, onClose, title, children, size = 'md' }: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  if (!isOpen) return null;
  
  const sizeClass = size === 'lg' ? 'max-w-2xl' : size === 'sm' ? 'max-w-sm' : 'max-w-md';
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className={`w-full ${sizeClass} bg-[#111118] border border-[#27272a] rounded-2xl shadow-2xl animate-fadeIn max-h-[90vh] overflow-hidden flex flex-col`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[#27272a] flex-shrink-0">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#1e1e2e] transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function FileManager() {
  const { user, refreshUser } = useAuth();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [buckets, setBuckets] = useState<BucketInfo[]>([]);
  const [allBuckets, setAllBuckets] = useState<string[]>(['default']); // Includes empty buckets
  const [currentBucket, setCurrentBucket] = useState('default');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; file: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Popup states
  const [showUploadPopup, setShowUploadPopup] = useState(false);
  const [showUrlBatchPopup, setShowUrlBatchPopup] = useState(false);
  const [showCsvPopup, setShowCsvPopup] = useState(false);
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [showBatchPopup, setShowBatchPopup] = useState(false);
  const [showFileDetails, setShowFileDetails] = useState(false);
  const [showNewBucketPopup, setShowNewBucketPopup] = useState(false);
  const [showBucketActions, setShowBucketActions] = useState<string | null>(null);
  const [showMovePopup, setShowMovePopup] = useState(false);
  
  // Edit states
  const [editingFile, setEditingFile] = useState<FileItem | null>(null);
  const [editFileName, setEditFileName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  
  // Upload states
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [urlBatch, setUrlBatch] = useState('');
  const [csvContent, setCsvContent] = useState('');
  const [moveTargetBucket, setMoveTargetBucket] = useState('default');
  
  // Bucket action state
  const [bucketToManage, setBucketToManage] = useState<string | null>(null);
  const [newBucketName, setNewBucketName] = useState('');

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/files?bucket=${currentBucket}`);
      const data = await res.json();
      setFiles(data.files || []);
      
      // Combine buckets with files and all known buckets
      const bucketsWithFiles = data.buckets || [];
      const bucketNames = new Set(['default', ...allBuckets, ...bucketsWithFiles.map((b: BucketInfo) => b.name)]);
      
      const combinedBuckets = Array.from(bucketNames).map(name => {
        const existing = bucketsWithFiles.find((b: BucketInfo) => b.name === name);
        return existing || { name, file_count: 0, total_size: 0 };
      });
      
      setBuckets(combinedBuckets);
    } catch (error) {
      console.error('Failed to fetch files:', error);
    } finally {
      setLoading(false);
    }
  }, [currentBucket, allBuckets]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  // Multi-file upload handler
  const handleMultiFileUpload = async () => {
    if (uploadFiles.length === 0) return;
    
    setUploading(true);
    const total = uploadFiles.length;
    
    for (let i = 0; i < uploadFiles.length; i++) {
      const file = uploadFiles[i];
      setUploadProgress({ current: i + 1, total, file: file.name });
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', currentBucket);
      formData.append('key', file.name);

      try {
        const res = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        
        if (!res.ok) {
          console.error(`Failed to upload ${file.name}:`, data.error);
        }
      } catch (error) {
        console.error(`Upload failed for ${file.name}:`, error);
      }
    }

    await fetchFiles();
    await refreshUser();
    setShowUploadPopup(false);
    setUploadFiles([]);
    setUploadProgress(null);
    setUploading(false);
  };

  // URL batch upload handler
  const handleUrlBatchUpload = async () => {
    const urls = urlBatch.split('\n').map(u => u.trim()).filter(Boolean);
    if (urls.length === 0) return;
    
    setUploading(true);
    const total = urls.length;
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const filename = url.split('/').pop()?.split('?')[0] || `file-${i + 1}`;
      setUploadProgress({ current: i + 1, total, file: filename });
      
      try {
        const formData = new FormData();
        formData.append('url', url);
        formData.append('bucket', currentBucket);
        formData.append('key', filename);

        await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
        });
      } catch (error) {
        console.error(`URL upload failed for ${url}:`, error);
      }
    }

    await fetchFiles();
    await refreshUser();
    setShowUrlBatchPopup(false);
    setUrlBatch('');
    setUploadProgress(null);
    setUploading(false);
  };

  // CSV import handler
  const handleCsvUpload = async () => {
    const lines = csvContent.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    
    setUploading(true);
    const total = lines.length;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Parse CSV: filename, link, description
      const parts = line.split(',').map(p => p.trim());
      const filename = parts[0] || `file-${i + 1}`;
      const url = parts[1] || '';
      const description = parts[2] || '';
      
      setUploadProgress({ current: i + 1, total, file: filename });
      
      if (url) {
        try {
          const formData = new FormData();
          formData.append('url', url);
          formData.append('bucket', currentBucket);
          formData.append('key', filename);
          formData.append('metadata', JSON.stringify({ description }));

          await fetch('/api/files/upload', {
            method: 'POST',
            body: formData,
          });
        } catch (error) {
          console.error(`CSV upload failed for ${filename}:`, error);
        }
      }
    }

    await fetchFiles();
    await refreshUser();
    setShowCsvPopup(false);
    setCsvContent('');
    setUploadProgress(null);
    setUploading(false);
  };

  // Delete file
  const handleDelete = async (fileId: string, key: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      const res = await fetch('/api/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: currentBucket, key }),
      });

      if (res.ok) {
        setFiles(files.filter((f) => f.id !== fileId));
        setSelectedFiles(prev => { const next = new Set(prev); next.delete(fileId); return next; });
        await refreshUser();
      }
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  // Batch delete
  const handleBatchDelete = async () => {
    if (!confirm(`Delete ${selectedFiles.size} files?`)) return;
    
    for (const fileId of selectedFiles) {
      const file = files.find(f => f.id === fileId);
      if (file) {
        await fetch('/api/files', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bucket: currentBucket, key: file.key }),
        });
      }
    }
    
    setSelectedFiles(new Set());
    setShowBatchPopup(false);
    await fetchFiles();
    await refreshUser();
  };

  // Batch download as ZIP
  const handleBatchDownloadZip = async () => {
    try {
      const res = await fetch('/api/files/download-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bucket: currentBucket,
          fileIds: Array.from(selectedFiles),
        }),
      });
      
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentBucket}-files.zip`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('ZIP download failed:', error);
      alert('ZIP download is not yet available. Please download files individually.');
    }
    setShowBatchPopup(false);
  };

  // Download file
  const handleDownload = async (file: FileItem) => {
    try {
      const res = await fetch(`/api/files/download?bucket=${currentBucket}&key=${file.key}`);
      const data = await res.json();
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  // Edit file metadata
  const handleEditFile = async () => {
    if (!editingFile) return;
    
    try {
      const res = await fetch('/api/files/metadata', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId: editingFile.id,
          fileName: editFileName,
          metadata: { description: editDescription }
        }),
      });
      
      if (res.ok) {
        await fetchFiles();
        setShowEditPopup(false);
        setEditingFile(null);
      }
    } catch (error) {
      console.error('Edit failed:', error);
    }
  };

  // Move files to another bucket
  const handleMoveFiles = async () => {
    if (!bucketToManage || moveTargetBucket === bucketToManage) return;
    
    setUploading(true);
    const bucketFiles = files.filter(f => f.bucket === bucketToManage);
    
    for (const file of bucketFiles) {
      try {
        await fetch('/api/files/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileId: file.id,
            sourceBucket: bucketToManage,
            targetBucket: moveTargetBucket,
          }),
        });
      } catch (error) {
        console.error('Move failed:', error);
      }
    }
    
    // Update allBuckets
    setAllBuckets(prev => [...new Set([...prev, moveTargetBucket])]);
    
    await fetchFiles();
    setShowMovePopup(false);
    setBucketToManage(null);
    setUploading(false);
  };

  // Delete bucket with all files
  const handleDeleteBucket = async (bucketName: string) => {
    if (!confirm(`Delete bucket "${bucketName}" and all its files? This cannot be undone.`)) return;
    
    try {
      const res = await fetch('/api/files/bucket', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket: bucketName }),
      });
      
      if (res.ok) {
        setAllBuckets(prev => prev.filter(b => b !== bucketName));
        if (currentBucket === bucketName) {
          setCurrentBucket('default');
        }
        await fetchFiles();
      }
      setShowBucketActions(null);
    } catch (error) {
      console.error('Delete bucket failed:', error);
    }
  };

  // Rename bucket
  const handleRenameBucket = async () => {
    if (!bucketToManage || !newBucketName.trim()) return;
    
    try {
      await fetch('/api/files/bucket/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldName: bucketToManage,
          newName: newBucketName.trim(),
        }),
      });
      
      setAllBuckets(prev => prev.map(b => b === bucketToManage ? newBucketName.trim() : b));
      if (currentBucket === bucketToManage) {
        setCurrentBucket(newBucketName.trim());
      }
      await fetchFiles();
      setShowBucketActions(null);
      setBucketToManage(null);
      setNewBucketName('');
    } catch (error) {
      console.error('Rename bucket failed:', error);
    }
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Format size
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  // Get file icon
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="w-5 h-5 text-pink-400" />;
    if (mimeType.startsWith('video/')) return <Video className="w-5 h-5 text-purple-400" />;
    if (mimeType.startsWith('audio/')) return <Music className="w-5 h-5 text-blue-400" />;
    if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('tar')) return <Archive className="w-5 h-5 text-yellow-400" />;
    if (mimeType.includes('json') || mimeType.includes('javascript') || mimeType.includes('html')) return <Code className="w-5 h-5 text-green-400" />;
    return <FileText className="w-5 h-5 text-gray-400" />;
  };

  // Toggle file selection
  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  // Select all files
  const toggleSelectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map(f => f.id)));
    }
  };

  // Create new bucket
  const handleCreateBucket = () => {
    if (newBucketName.trim()) {
      setAllBuckets(prev => [...new Set([...prev, newBucketName.trim()])]);
      setCurrentBucket(newBucketName.trim());
      setNewBucketName('');
      setShowNewBucketPopup(false);
    }
  };

  const filteredFiles = files.filter((file) =>
    file.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const storagePercent = user ? (user.storage_used / user.storage_limit) * 100 : 0;

  // Group files by date
  const groupedFiles = filteredFiles.reduce((acc, file) => {
    const date = formatDate(file.created_at);
    if (!acc[date]) acc[date] = [];
    acc[date].push(file);
    return acc;
  }, {} as Record<string, FileItem[]>);

  return (
    <div className="min-h-screen bg-[#0a0a0f] pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#111118]/95 backdrop-blur-xl border-b border-[#27272a]">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex-shrink-0">
                <Cloud className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-white truncate">TeleCloud</h1>
                <p className="text-xs text-gray-500 hidden sm:block">S3-Compatible Storage</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Storage indicator */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#1e1e2e] rounded-lg">
                <HardDrive className="w-4 h-4 text-gray-400" />
                <div className="w-20 h-1.5 bg-[#27272a] rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#6366f1] to-[#22d3ee] rounded-full" style={{ width: `${Math.min(storagePercent, 100)}%` }} />
                </div>
                <span className="text-xs text-gray-400">{formatSize(user?.storage_used || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Bucket Navigation - Two Horizontal Rows */}
      <div className="bg-[#111118]/50 border-b border-[#27272a]">
        <div className="max-w-7xl mx-auto px-4 py-3">
          {/* Primary: Bucket List */}
          {loading ? (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <BucketSkeleton />
              <BucketSkeleton />
              <BucketSkeleton />
            </div>
          ) : (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {buckets.map((bucket) => (
                <button
                  key={bucket.name}
                  onClick={() => {
                    setCurrentBucket(bucket.name);
                    setSelectedFiles(new Set());
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                    currentBucket === bucket.name
                      ? 'bg-[#6366f1] text-white'
                      : 'bg-[#1e1e2e] text-gray-400 hover:bg-[#27272a]'
                  }`}
                >
                  <Folder className="w-4 h-4" />
                  {bucket.name}
                  <span className="text-xs opacity-70">({bucket.file_count})</span>
                </button>
              ))}
              
              <button
                onClick={() => setShowNewBucketPopup(true)}
                className="flex-shrink-0 p-2 rounded-xl bg-[#1e1e2e] text-gray-400 hover:text-white hover:bg-[#27272a] transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          )}
          
          {/* Secondary: Bucket Operations (shown when bucket selected) */}
          {!loading && currentBucket !== 'default' && (
            <div className="flex items-center gap-2 pt-2 border-t border-[#27272a] mt-2 overflow-x-auto scrollbar-hide">
              <span className="text-xs text-gray-500 flex-shrink-0">Actions:</span>
              <button
                onClick={() => {
                  setBucketToManage(currentBucket);
                  setNewBucketName(currentBucket);
                  setShowBucketActions('rename');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e1e2e] hover:bg-[#27272a] text-gray-300 hover:text-white rounded-lg text-sm transition-colors whitespace-nowrap"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Rename
              </button>
              <button
                onClick={() => {
                  setBucketToManage(currentBucket);
                  setMoveTargetBucket('default');
                  setShowMovePopup(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e1e2e] hover:bg-[#27272a] text-gray-300 hover:text-white rounded-lg text-sm transition-colors whitespace-nowrap"
              >
                <Move className="w-3.5 h-3.5" />
                Move Files
              </button>
              <button
                onClick={() => handleDeleteBucket(currentBucket)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition-colors whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Bucket
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#1e1e2e] border border-[#27272a] rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#6366f1] transition-colors"
            />
          </div>

          <div className="flex items-center gap-2">
            {selectedFiles.size > 0 && (
              <button
                onClick={() => setShowBatchPopup(true)}
                className="flex items-center gap-2 px-3 py-2 bg-[#6366f1] text-white rounded-xl text-sm font-medium"
              >
                <CheckSquare className="w-4 h-4" />
                {selectedFiles.size} selected
              </button>
            )}
            
            <button
              onClick={fetchFiles}
              className="p-2 rounded-lg bg-[#1e1e2e] text-gray-400 hover:text-white hover:bg-[#27272a] transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* File List with Timeline */}
      <main className="max-w-7xl mx-auto px-4">
        {loading ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 py-2 px-3 bg-[#111118] rounded-xl border border-[#27272a]">
              <div className="w-5 h-5 rounded bg-[#1e1e2e] animate-pulse" />
              <StatSkeleton />
            </div>
            <div className="bg-[#111118] border border-[#27272a] rounded-xl overflow-hidden">
              {[...Array(5)].map((_, i) => <FileSkeleton key={i} />)}
            </div>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-4 rounded-2xl bg-[#1e1e2e] mb-4">
              <Cloud className="w-12 h-12 text-gray-600" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              {files.length === 0 ? 'No files yet' : 'No files match your search'}
            </h3>
            <p className="text-gray-500 mb-4">
              {files.length === 0 ? 'Upload your first file to get started' : 'Try a different search term'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Select All */}
            <div className="flex items-center gap-3 py-2 px-3 bg-[#111118] rounded-xl border border-[#27272a]">
              <button onClick={toggleSelectAll} className="p-1">
                {selectedFiles.size === files.length && files.length > 0 ? (
                  <CheckSquare className="w-5 h-5 text-[#6366f1]" />
                ) : (
                  <Square className="w-5 h-5 text-gray-500" />
                )}
              </button>
              <span className="text-sm text-gray-400">
                {selectedFiles.size > 0 ? `${selectedFiles.size} selected` : 'Select all'}
              </span>
              <span className="text-sm text-gray-500 ml-auto">{files.length} files</span>
            </div>

            {/* Grouped Files by Date */}
            {Object.entries(groupedFiles).map(([date, dateFiles]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-400">{date}</span>
                  <div className="flex-1 h-px bg-[#27272a]" />
                </div>
                
                <div className="bg-[#111118] border border-[#27272a] rounded-xl overflow-hidden">
                  {dateFiles.map((file, index) => (
                    <div
                      key={file.id}
                      className={`flex items-center gap-3 px-4 py-3 hover:bg-[#1e1e2e]/50 transition-colors cursor-pointer ${
                        index !== dateFiles.length - 1 ? 'border-b border-[#27272a]' : ''
                      }`}
                      onClick={() => {
                        setEditingFile(file);
                        setEditFileName(file.file_name);
                        setEditDescription(file.metadata?.description || '');
                        setShowFileDetails(true);
                      }}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFileSelection(file.id);
                        }}
                        className="p-1 flex-shrink-0"
                      >
                        {selectedFiles.has(file.id) ? (
                          <CheckSquare className="w-5 h-5 text-[#6366f1]" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-500 hover:text-gray-400" />
                        )}
                      </button>

                      {/* File Icon */}
                      <div className="flex-shrink-0">
                        {getFileIcon(file.mime_type)}
                      </div>

                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white truncate font-medium">{file.file_name}</p>
                        <p className="text-xs text-gray-500">{formatSize(file.size)} • {file.mime_type.split('/')[1]?.toUpperCase() || 'FILE'}</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(file);
                          }}
                          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#27272a] transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(`/api/s3/${currentBucket}/${file.key}`, file.id);
                          }}
                          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#27272a] transition-colors"
                          title="Copy link"
                        >
                          {copiedId === file.id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingFile(file);
                            setEditFileName(file.file_name);
                            setEditDescription(file.metadata?.description || '');
                            setShowEditPopup(true);
                          }}
                          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#27272a] transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(file.id, file.key);
                          }}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Floating Upload Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <div className="relative">
          <button
            onClick={() => setShowUploadPopup(true)}
            className="w-14 h-14 rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] hover:from-[#818cf8] hover:to-[#a78bfa] text-white shadow-lg shadow-[#6366f1]/30 flex items-center justify-center transition-all hover:scale-110"
          >
            <Upload className="w-6 h-6" />
          </button>
          
          {/* Quick action indicators */}
          {uploading && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#22c55e] rounded-full flex items-center justify-center">
              <Loader2 className="w-3 h-3 text-white animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Upload Popup */}
      <Popup isOpen={showUploadPopup} onClose={() => { setShowUploadPopup(false); setUploadFiles([]); }} title="Upload Files">
        <div className="space-y-4">
          {/* Multi-file upload */}
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#27272a] rounded-xl hover:border-[#6366f1] transition-colors cursor-pointer">
            {uploading ? (
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-[#6366f1] animate-spin mx-auto mb-2" />
                <p className="text-gray-400 text-sm">
                  {uploadProgress ? `${uploadProgress.current}/${uploadProgress.total}` : 'Uploading...'}
                </p>
                {uploadProgress && (
                  <p className="text-gray-500 text-xs truncate max-w-[200px] mx-auto">{uploadProgress.file}</p>
                )}
              </div>
            ) : uploadFiles.length > 0 ? (
              <div className="text-center">
                <FileUp className="w-8 h-8 text-[#6366f1] mx-auto mb-2" />
                <p className="text-white text-sm">{uploadFiles.length} file(s) selected</p>
                <p className="text-gray-500 text-xs">{uploadFiles.map(f => f.name).slice(0, 3).join(', ')}{uploadFiles.length > 3 && '...'}</p>
              </div>
            ) : (
              <div className="text-center">
                <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Click to upload</p>
                <p className="text-gray-500 text-xs">Multiple files supported • Max 50MB each</p>
              </div>
            )}
            <input 
              ref={fileInputRef}
              type="file" 
              className="hidden" 
              multiple
              onChange={(e) => setUploadFiles(Array.from(e.target.files || []))} 
              disabled={uploading} 
            />
          </label>

          {uploadFiles.length > 0 && !uploading && (
            <button onClick={handleMultiFileUpload} className="w-full py-2.5 bg-[#6366f1] hover:bg-[#818cf8] text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" />
              Upload {uploadFiles.length} file(s) to {currentBucket}
            </button>
          )}

          <div className="relative">
            <div className="absolute inset-x-0 top-0 flex items-center">
              <div className="w-full border-t border-[#27272a]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-[#111118] text-gray-500">or upload via</span>
            </div>
          </div>

          {/* Quick upload options */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setShowUploadPopup(false); setShowUrlBatchPopup(true); }}
              className="flex flex-col items-center gap-2 p-4 bg-[#1e1e2e] hover:bg-[#27272a] rounded-xl transition-colors"
            >
              <Link2 className="w-6 h-6 text-[#22d3ee]" />
              <span className="text-sm text-white">URL Batch</span>
            </button>
            <button
              onClick={() => { setShowUploadPopup(false); setShowCsvPopup(true); }}
              className="flex flex-col items-center gap-2 p-4 bg-[#1e1e2e] hover:bg-[#27272a] rounded-xl transition-colors"
            >
              <FileSpreadsheet className="w-6 h-6 text-[#22c55e]" />
              <span className="text-sm text-white">CSV Import</span>
            </button>
          </div>
        </div>
      </Popup>

      {/* URL Batch Upload Popup */}
      <Popup isOpen={showUrlBatchPopup} onClose={() => { setShowUrlBatchPopup(false); setUrlBatch(''); }} title="Upload from URLs">
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">Enter one URL per line. Files will be uploaded sequentially.</p>
          <textarea
            value={urlBatch}
            onChange={(e) => setUrlBatch(e.target.value)}
            rows={6}
            placeholder="https://example.com/file1.jpg&#10;https://example.com/file2.pdf&#10;https://example.com/file3.zip"
            className="w-full px-3 py-2.5 bg-[#1e1e2e] border border-[#27272a] rounded-xl text-white text-sm resize-none focus:outline-none focus:border-[#6366f1] font-mono"
          />
          
          {uploading && uploadProgress && (
            <div className="flex items-center gap-3 p-3 bg-[#1e1e2e] rounded-xl">
              <Loader2 className="w-5 h-5 text-[#6366f1] animate-spin" />
              <div className="flex-1">
                <p className="text-white text-sm">{uploadProgress.current}/{uploadProgress.total}</p>
                <p className="text-gray-500 text-xs truncate">{uploadProgress.file}</p>
              </div>
            </div>
          )}
          
          <button
            onClick={handleUrlBatchUpload}
            disabled={!urlBatch.trim() || uploading}
            className="w-full py-2.5 bg-[#6366f1] hover:bg-[#818cf8] text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            {uploading ? 'Uploading...' : 'Upload from URLs'}
          </button>
        </div>
      </Popup>

      {/* CSV Import Popup */}
      <Popup isOpen={showCsvPopup} onClose={() => { setShowCsvPopup(false); setCsvContent(''); }} title="CSV Import">
        <div className="space-y-4">
          <div className="p-3 bg-[#1e1e2e] rounded-xl text-sm">
            <p className="text-gray-400 mb-2">CSV Format (one file per line):</p>
            <code className="text-[#22d3ee] text-xs">filename, url, description</code>
            <p className="text-gray-500 text-xs mt-2">Example:</p>
            <code className="text-gray-400 text-xs block">vacation.jpg, https://example.com/img.jpg, Summer 2024</code>
          </div>
          
          <textarea
            value={csvContent}
            onChange={(e) => setCsvContent(e.target.value)}
            rows={6}
            placeholder="file1.jpg, https://example.com/file1.jpg, Description 1&#10;file2.pdf, https://example.com/file2.pdf, Description 2"
            className="w-full px-3 py-2.5 bg-[#1e1e2e] border border-[#27272a] rounded-xl text-white text-sm resize-none focus:outline-none focus:border-[#6366f1] font-mono"
          />
          
          {uploading && uploadProgress && (
            <div className="flex items-center gap-3 p-3 bg-[#1e1e2e] rounded-xl">
              <Loader2 className="w-5 h-5 text-[#6366f1] animate-spin" />
              <div className="flex-1">
                <p className="text-white text-sm">{uploadProgress.current}/{uploadProgress.total}</p>
                <p className="text-gray-500 text-xs truncate">{uploadProgress.file}</p>
              </div>
            </div>
          )}
          
          <button
            onClick={handleCsvUpload}
            disabled={!csvContent.trim() || uploading}
            className="w-full py-2.5 bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            {uploading ? 'Importing...' : 'Import from CSV'}
          </button>
        </div>
      </Popup>

      {/* Edit File Popup */}
      <Popup isOpen={showEditPopup} onClose={() => { setShowEditPopup(false); setEditingFile(null); }} title="Edit File">
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Filename</label>
            <input
              type="text"
              value={editFileName}
              onChange={(e) => setEditFileName(e.target.value)}
              className="w-full px-3 py-2.5 bg-[#1e1e2e] border border-[#27272a] rounded-xl text-white focus:outline-none focus:border-[#6366f1]"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 bg-[#1e1e2e] border border-[#27272a] rounded-xl text-white resize-none focus:outline-none focus:border-[#6366f1]"
              placeholder="Add a description..."
            />
          </div>
          <button onClick={handleEditFile} className="w-full py-2.5 bg-[#6366f1] hover:bg-[#818cf8] text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
            <Edit className="w-4 h-4" />
            Save Changes (syncs to Telegram)
          </button>
        </div>
      </Popup>

      {/* File Details Popup */}
      <Popup isOpen={showFileDetails} onClose={() => { setShowFileDetails(false); setEditingFile(null); }} title="File Details">
        {editingFile && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-[#1e1e2e] rounded-xl">
              {getFileIcon(editingFile.mime_type)}
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{editingFile.file_name}</p>
                <p className="text-xs text-gray-500">{formatSize(editingFile.size)}</p>
              </div>
            </div>
            
            {editingFile.metadata?.description && (
              <div className="p-3 bg-[#1e1e2e] rounded-xl">
                <p className="text-gray-500 text-xs mb-1">Description</p>
                <p className="text-white text-sm">{editingFile.metadata.description}</p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-[#1e1e2e] rounded-xl">
                <p className="text-gray-500 text-xs">Type</p>
                <p className="text-white truncate">{editingFile.mime_type}</p>
              </div>
              <div className="p-3 bg-[#1e1e2e] rounded-xl">
                <p className="text-gray-500 text-xs">Size</p>
                <p className="text-white">{formatSize(editingFile.size)}</p>
              </div>
              <div className="p-3 bg-[#1e1e2e] rounded-xl">
                <p className="text-gray-500 text-xs">Bucket</p>
                <p className="text-white">{editingFile.bucket}</p>
              </div>
              <div className="p-3 bg-[#1e1e2e] rounded-xl">
                <p className="text-gray-500 text-xs">Created</p>
                <p className="text-white">{new Date(editingFile.created_at).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => handleDownload(editingFile)} className="flex-1 py-2.5 bg-[#6366f1] hover:bg-[#818cf8] text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
                <Download className="w-4 h-4" /> Download
              </button>
              <button onClick={() => { setShowFileDetails(false); setShowEditPopup(true); }} className="flex-1 py-2.5 bg-[#1e1e2e] hover:bg-[#27272a] text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
                <Edit className="w-4 h-4" /> Edit
              </button>
            </div>
          </div>
        )}
      </Popup>

      {/* Batch Operations Popup */}
      <Popup isOpen={showBatchPopup} onClose={() => setShowBatchPopup(false)} title="Batch Operations">
        <div className="space-y-3">
          <p className="text-gray-400 text-sm">{selectedFiles.size} files selected</p>
          
          <button
            onClick={handleBatchDownloadZip}
            className="w-full py-3 bg-[#6366f1]/20 hover:bg-[#6366f1]/30 text-[#6366f1] rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Package className="w-4 h-4" /> Download as ZIP
          </button>
          
          <button
            onClick={() => {
              const links = Array.from(selectedFiles).map(id => {
                const file = files.find(f => f.id === id);
                return file ? `/api/s3/${currentBucket}/${file.key}` : '';
              }).filter(Boolean).join('\n');
              navigator.clipboard.writeText(links);
              setShowBatchPopup(false);
            }}
            className="w-full py-3 bg-[#1e1e2e] hover:bg-[#27272a] text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Copy className="w-4 h-4" /> Copy All Links
          </button>
          
          <button
            onClick={handleBatchDelete}
            className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> Delete All Selected
          </button>
        </div>
      </Popup>

      {/* New Bucket Popup */}
      <Popup isOpen={showNewBucketPopup} onClose={() => { setShowNewBucketPopup(false); setNewBucketName(''); }} title="Create Bucket">
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Bucket name (e.g., images, documents)"
            value={newBucketName}
            onChange={(e) => setNewBucketName(e.target.value)}
            className="w-full px-3 py-2.5 bg-[#1e1e2e] border border-[#27272a] rounded-xl text-white focus:outline-none focus:border-[#6366f1]"
          />
          <button onClick={handleCreateBucket} className="w-full py-2.5 bg-[#6366f1] hover:bg-[#818cf8] text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
            <FolderPlus className="w-4 h-4" />
            Create Bucket
          </button>
        </div>
      </Popup>

      {/* Move Files Popup */}
      <Popup isOpen={showMovePopup} onClose={() => { setShowMovePopup(false); setBucketToManage(null); }} title="Move Files">
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            Move all files from <span className="text-white font-medium">{bucketToManage}</span> to:
          </p>
          
          <select
            value={moveTargetBucket}
            onChange={(e) => setMoveTargetBucket(e.target.value)}
            className="w-full px-3 py-2.5 bg-[#1e1e2e] border border-[#27272a] rounded-xl text-white focus:outline-none focus:border-[#6366f1]"
          >
            {allBuckets.filter(b => b !== bucketToManage).map(bucket => (
              <option key={bucket} value={bucket}>{bucket}</option>
            ))}
            <option value="_new">Create new bucket...</option>
          </select>
          
          {moveTargetBucket === '_new' && (
            <input
              type="text"
              placeholder="New bucket name"
              value={newBucketName}
              onChange={(e) => setNewBucketName(e.target.value)}
              className="w-full px-3 py-2.5 bg-[#1e1e2e] border border-[#27272a] rounded-xl text-white focus:outline-none focus:border-[#6366f1]"
            />
          )}
          
          <button
            onClick={handleMoveFiles}
            disabled={uploading}
            className="w-full py-2.5 bg-[#6366f1] hover:bg-[#818cf8] text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Move className="w-4 h-4" />}
            {uploading ? 'Moving...' : 'Move Files'}
          </button>
        </div>
      </Popup>

      {/* Rename Bucket Popup */}
      <Popup isOpen={showBucketActions === 'rename'} onClose={() => { setShowBucketActions(null); setBucketToManage(null); setNewBucketName(''); }} title="Rename Bucket">
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            Rename bucket <span className="text-white font-medium">{bucketToManage}</span> to:
          </p>
          
          <input
            type="text"
            placeholder="New bucket name"
            value={newBucketName}
            onChange={(e) => setNewBucketName(e.target.value)}
            className="w-full px-3 py-2.5 bg-[#1e1e2e] border border-[#27272a] rounded-xl text-white focus:outline-none focus:border-[#6366f1]"
          />
          
          <button
            onClick={handleRenameBucket}
            className="w-full py-2.5 bg-[#6366f1] hover:bg-[#818cf8] text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Edit3 className="w-4 h-4" />
            Rename Bucket
          </button>
        </div>
      </Popup>

    </div>
  );
}
