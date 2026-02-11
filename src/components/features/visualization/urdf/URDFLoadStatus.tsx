'use client';

import { Loader2, CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react';
import { visualizationStyles } from '@/styles';

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

export default function URDFLoadStatus({
  loading,
  error,
  success,
  progress,
  onClose,
}: URDFLoadStatusProps) {
  if (!loading && !error && !success) {
    return null;
  }

  return (
    <div className={visualizationStyles.loadStatus.overlay}>
      <div className={visualizationStyles.loadStatus.modalContainer}>
        {loading && (
          <div className={visualizationStyles.loadStatus.loadingCard}>
            <button
              onClick={onClose}
              className={visualizationStyles.loadStatus.closeButton}
              title="Cancel"
            >
              <X className={visualizationStyles.loadStatus.closeIcon} />
            </button>
            <div className={visualizationStyles.loadStatus.loadingHeader}>
              <Loader2 className={visualizationStyles.loadStatus.loadingSpinner} />
              <h3 className={visualizationStyles.loadStatus.loadingTitle}>Loading URDF</h3>
            </div>

            {progress && progress.total > 0 && (
              <div>
                <div className={visualizationStyles.loadStatus.progressInfo}>
                  <span>Loading meshes...</span>
                  <span>
                    {progress.loaded} / {progress.total}
                  </span>
                </div>

                <div className={visualizationStyles.loadStatus.progressBar}>
                  <div
                    className={visualizationStyles.loadStatus.progressFill}
                    style={{ width: `${(progress.loaded / progress.total) * 100}%` }}
                  />
                </div>

                {progress.currentFile && (
                  <p className={visualizationStyles.loadStatus.currentFile}>
                    {progress.currentFile}
                  </p>
                )}
              </div>
            )}

            {(!progress || progress.total === 0) && (
              <p className={visualizationStyles.loadStatus.loadingMessage}>Fetching URDF data...</p>
            )}
          </div>
        )}

        {error && (
          <div className={visualizationStyles.loadStatus.errorCard}>
            <button
              onClick={onClose}
              className={visualizationStyles.loadStatus.errorCloseButton}
              title="Close"
            >
              <X className={visualizationStyles.loadStatus.errorCloseIcon} />
            </button>
            <div className={visualizationStyles.loadStatus.errorHeader}>
              <XCircle className={visualizationStyles.loadStatus.errorIcon} />
              <h3 className={visualizationStyles.loadStatus.errorTitle}>Loading Failed</h3>
            </div>
            <p className={visualizationStyles.loadStatus.errorMessage}>{error}</p>
          </div>
        )}

        {success && !loading && !error && (
          <div className={visualizationStyles.loadStatus.successCard}>
            {onClose && (
              <button
                onClick={onClose}
                className={visualizationStyles.loadStatus.successCloseButton}
                title="Close"
              >
                <X className={visualizationStyles.loadStatus.successCloseIcon} />
              </button>
            )}
            <div className={visualizationStyles.loadStatus.successHeader}>
              <CheckCircle2 className={visualizationStyles.loadStatus.successIcon} />
              <h3 className={visualizationStyles.loadStatus.successTitle}>
                URDF Loaded Successfully
              </h3>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
