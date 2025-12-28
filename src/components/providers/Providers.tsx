'use client';

import { ReactNode, useEffect } from 'react';
import { ToastProvider, useToast, setGlobalToastHandler } from '@/components/ui/Toast';

function ToastInitializer() {
  const { addToast } = useToast();

  useEffect(() => {
    setGlobalToastHandler(addToast);
    return () => setGlobalToastHandler(null);
  }, [addToast]);

  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ToastInitializer />
      {children}
    </ToastProvider>
  );
}
