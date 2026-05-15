'use client';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  const baseClass = 'animate-pulse rounded-lg bg-gray-200 dark:bg-[#27272a]';
  return (
    <div className={`${baseClass} ${className || ''}`} />
  );
}

export function FileCardSkeleton() {
  return (
    <div className="bg-white dark:bg-[#111118] border border-gray-200 dark:border-[#27272a] rounded-xl p-4">
      <Skeleton className="w-full h-20 mb-3" />
      <Skeleton className="w-3/4 h-4 mb-2" />
      <Skeleton className="w-1/2 h-3" />
    </div>
  );
}

export function FileListSkeleton() {
  return (
    <div className="bg-white dark:bg-[#111118] border border-gray-200 dark:border-[#27272a] rounded-xl overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-[#27272a]">
        <div className="flex items-center gap-4">
          <Skeleton className="w-8 h-8 rounded" />
          <div className="flex-1">
            <Skeleton className="w-1/3 h-4 mb-2" />
            <Skeleton className="w-1/4 h-3" />
          </div>
          <Skeleton className="w-1/6 h-3" />
          <Skeleton className="w-1/6 h-3" />
          <Skeleton className="w-20 h-8 rounded-lg" />
        </div>
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="p-4 border-b border-gray-200 dark:border-[#27272a]">
          <div className="flex items-center gap-4">
            <Skeleton className="w-8 h-8 rounded" />
            <div className="flex-1">
              <Skeleton className="w-1/3 h-4 mb-2" />
              <Skeleton className="w-1/4 h-3" />
            </div>
            <Skeleton className="w-16 h-3" />
            <Skeleton className="w-20 h-3" />
            <Skeleton className="w-24 h-8 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0f] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div>
              <Skeleton className="w-32 h-6 mb-1" />
              <Skeleton className="w-24 h-3" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="w-48 h-8 rounded-xl" />
            <Skeleton className="w-24 h-8 rounded-xl" />
          </div>
        </div>

        {/* Buckets skeleton */}
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="w-24 h-10 rounded-xl" />
          ))}
        </div>

        {/* Files grid skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <FileCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="border-b border-gray-200 dark:border-[#27272a]">
      {[...Array(columns)].map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="w-full h-5" />
        </td>
      ))}
    </tr>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white dark:bg-[#111118] border border-gray-200 dark:border-[#27272a] rounded-xl p-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <div>
          <Skeleton className="w-20 h-3 mb-2" />
          <Skeleton className="w-16 h-8" />
        </div>
      </div>
    </div>
  );
}
