import { useSyncExternalStore } from 'react';

function subscribeToNetworkStatus(onStatusChange: () => void) {
  window.addEventListener('online', onStatusChange);
  window.addEventListener('offline', onStatusChange);

  return () => {
    window.removeEventListener('online', onStatusChange);
    window.removeEventListener('offline', onStatusChange);
  };
}

function getNetworkStatus() {
  return navigator.onLine;
}

function getServerNetworkStatus() {
  return true;
}

export function useOnlineStatus() {
  return useSyncExternalStore(subscribeToNetworkStatus, getNetworkStatus, getServerNetworkStatus);
}
