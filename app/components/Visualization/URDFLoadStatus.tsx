'use client';

import { Loader2, CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react';

interface URDFLoadStatusProps {
  loading?: boolean;
  error?: string | null;
  success?: boolean;
  progress?: {
    loaded: number;
    total: number;
    currentFile?: string;
  };
  onClose?: () => void;
}

export default function URDFLoadStatus({ loading, error, success, progress, onClose }: URDFLoadStatusProps) {
  if (!loading && !error && !success) {
    return null;
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-950/90 backdrop-blur-sm z-20">
      <div className="max-w-md w-full mx-4">
        {loading && (
          <div className="bg-gray-900/90 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              <h3 className="text-lg font-semibold text-gray-200">Loading URDF</h3>
            </div>
            
            {progress && progress.total > 0 && (
              <div>
                <div className="flex justify-between text-sm text-gray-400 mb-2">
                  <span>Loading meshes...</span>
                  <span>{progress.loaded} / {progress.total}</span>
                </div>
                
                <div className="w-full bg-gray-800 rounded-full h-2 mb-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.loaded / progress.total) * 100}%` }}
                  />
                </div>
                
                {progress.currentFile && (
                  <p className="text-xs text-gray-500 truncate">
                    {progress.currentFile}
                  </p>
                )}
              </div>
            )}
            
            {(!progress || progress.total === 0) && (
              <p className="text-sm text-gray-400">
                Fetching URDF data...
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 relative">
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1 hover:bg-red-500/20 rounded transition-colors"
              title="Close"
            >
              <X className="w-5 h-5 text-red-400" />
            </button>
            <div className="flex items-center gap-3 mb-3">
              <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
              <h3 className="text-lg font-semibold text-red-400">Loading Failed</h3>
            </div>
            <p className="text-sm text-gray-300 whitespace-pre-wrap pr-8">{error}</p>
          </div>
        )}

        {success && !loading && !error && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6 relative">
            {onClose && (
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-1 hover:bg-green-500/20 rounded transition-colors"
                title="Close"
              >
                <X className="w-5 h-5 text-green-400" />
              </button>
            )}
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
              <h3 className="text-lg font-semibold text-green-400">URDF Loaded Successfully</h3>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
