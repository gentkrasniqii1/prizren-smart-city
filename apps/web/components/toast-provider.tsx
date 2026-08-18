'use client';

import type { ReactNode } from 'react';
import { toast } from 'sonner';

type ToastTone = 'success' | 'error' | 'info';

type ToastContextValue = {
  push: (message: string, tone?: ToastTone) => void;
};

/** Back-compat helper over Sonner so the app has a single toast surface. */
export function ToastProvider({ children }: { children: ReactNode }) {
  return children;
}

export function useToast(): ToastContextValue {
  return {
    push(message: string, tone: ToastTone = 'success') {
      if (tone === 'error') toast.error(message);
      else if (tone === 'info') toast.message(message);
      else toast.success(message);
    },
  };
}
