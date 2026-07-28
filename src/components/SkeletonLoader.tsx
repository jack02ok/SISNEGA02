import React from 'react';

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, cols = 5 }) => {
  return (
    <div className="w-full space-y-3 animate-pulse">
      <div className="h-10 bg-slate-200/80 rounded-xl w-full"></div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="flex items-center gap-3 p-3 bg-slate-100/70 rounded-xl border border-slate-200/50">
            {Array.from({ length: cols }).map((_, cIdx) => (
              <div
                key={cIdx}
                className={`h-4 bg-slate-200 rounded-md ${
                  cIdx === 0 ? 'w-10' : cIdx === 1 ? 'w-1/3 flex-1' : 'w-1/6'
                }`}
              ></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

interface CardSkeletonProps {
  count?: number;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ count = 3 }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="p-5 bg-white border border-slate-200/70 rounded-2xl space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="h-4 bg-slate-200 rounded-md w-1/2"></div>
            <div className="h-8 w-8 bg-slate-200 rounded-xl"></div>
          </div>
          <div className="h-8 bg-slate-200 rounded-lg w-1/3"></div>
          <div className="h-3 bg-slate-100 rounded-md w-3/4"></div>
        </div>
      ))}
    </div>
  );
};

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-12 bg-slate-200 rounded-2xl w-2/3"></div>
      <CardSkeleton count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-slate-200 rounded-2xl"></div>
        <div className="h-64 bg-slate-200 rounded-2xl"></div>
      </div>
    </div>
  );
};

export const ProfileSkeleton: React.FC = () => {
  return (
    <div className="p-6 bg-white border border-slate-200 rounded-2xl space-y-4 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-slate-200 rounded-2xl"></div>
        <div className="space-y-2 flex-1">
          <div className="h-5 bg-slate-200 rounded-md w-1/3"></div>
          <div className="h-3 bg-slate-200 rounded-md w-1/4"></div>
        </div>
      </div>
      <div className="space-y-2 pt-2 border-t">
        <div className="h-3 bg-slate-200 rounded-md w-full"></div>
        <div className="h-3 bg-slate-200 rounded-md w-4/5"></div>
        <div className="h-3 bg-slate-200 rounded-md w-2/3"></div>
      </div>
    </div>
  );
};
