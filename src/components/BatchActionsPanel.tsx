'use client';

import { useState } from 'react';
import { Move, Copy, Check, Trash2 } from 'lucide-react';

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

interface BatchActionsPanelProps {
  selectedFiles: Set<string>;
  files: FileItem[];
  currentBucket: string;
  allBuckets: string[];
  onMoveFiles: (bucket: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function BatchActionsPanel({ selectedFiles, files, currentBucket, allBuckets, onMoveFiles, onDelete }: BatchActionsPanelProps) {
  const [showMove, setShowMove] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const [moveBucket, setMoveBucket] = useState(allBuckets.find(b => b !== currentBucket) || 'default');
  const [linkTab, setLinkTab] = useState<'s3' | 'preview' | 'download'>('s3');
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const selectedFilesList = Array.from(selectedFiles).map(id => files.find(f => f.id === id)).filter(Boolean) as FileItem[];

  const getLinks = (tab: 's3' | 'preview' | 'download') => {
    return selectedFilesList.map(file => {
      switch (tab) {
        case 's3': return `${baseUrl}/api/s3/${currentBucket}/${file.key}`;
        case 'preview': return `${baseUrl}/preview/${file.id}`;
        case 'download': return `${baseUrl}/api/files/download?bucket=${currentBucket}&key=${file.key}`;
      }
    }).join('\n');
  };

  const copyLinks = async () => {
    await navigator.clipboard.writeText(getLinks(linkTab));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      {/* Move to */}
      <button onClick={() => { setShowMove(!showMove); setShowLinks(false); }}
        className="w-full py-3 bg-[#1e1e2e] hover:bg-[#27272a] text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
        <Move className="w-4 h-4" /> Move to
      </button>
      {showMove && (
        <div className="p-3 bg-[#1e1e2e] rounded-xl space-y-3 border border-[#27272a]">
          <select value={moveBucket} onChange={e => setMoveBucket(e.target.value)}
            className="w-full px-3 py-2.5 bg-[#0a0a0f] border border-[#27272a] rounded-xl text-white text-sm focus:outline-none focus:border-[#6366f1]">
            {allBuckets.filter(b => b !== currentBucket).map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <button onClick={() => onMoveFiles(moveBucket)}
            className="w-full py-2 bg-[#6366f1] hover:bg-[#818cf8] text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
            <Move className="w-3.5 h-3.5" /> Move {selectedFiles.size} files to {moveBucket}
          </button>
        </div>
      )}

      {/* Copy Selected Links */}
      <button onClick={() => { setShowLinks(!showLinks); setShowMove(false); }}
        className="w-full py-3 bg-[#1e1e2e] hover:bg-[#27272a] text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
        <Copy className="w-4 h-4" /> Copy Selected Links
      </button>
      {showLinks && (
        <div className="p-3 bg-[#1e1e2e] rounded-xl space-y-3 border border-[#27272a]">
          <div className="flex gap-1">
            {(['s3', 'preview', 'download'] as const).map(tab => (
              <button key={tab} onClick={() => setLinkTab(tab)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  linkTab === tab ? 'bg-[#6366f1] text-white' : 'bg-[#0a0a0f] text-gray-400 hover:text-white'
                }`}>
                {tab === 's3' ? 'S3 Links' : tab === 'preview' ? 'Preview Links' : 'Download Links'}
              </button>
            ))}
          </div>
          <div className="relative">
            <textarea disabled value={getLinks(linkTab)} rows={4}
              className="w-full px-3 py-2 bg-[#0a0a0f] border border-[#27272a] rounded-xl text-gray-400 text-xs font-mono resize-none" />
            <button onClick={copyLinks}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-[#27272a] hover:bg-[#6366f1] text-gray-400 hover:text-white transition-colors">
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            {copied && <span className="absolute top-2.5 right-10 text-[10px] text-green-400 font-medium">Copied!</span>}
          </div>
        </div>
      )}

      {/* Delete All Selected */}
      <button onClick={onDelete}
        className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
        <Trash2 className="w-4 h-4" /> Delete All Selected
      </button>
    </div>
  );
}
