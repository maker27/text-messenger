'use client';

import { FaceError } from '@/widgets/face-error/face-error';

interface ErrorProps {
  retry: () => void;
}

export default function Error({ retry }: ErrorProps) {
  return <FaceError messenger="telegram" onRetry={retry} />;
}
