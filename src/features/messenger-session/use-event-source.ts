import { useEffect, useEffectEvent } from 'react';

export function useEventSource<EventName extends string>(
  url: string | null,
  eventNames: readonly EventName[],
  onFrame: (eventName: EventName, data: unknown, closeSource: () => void) => void,
  onError: (readyState: number) => void,
) {
  const handleFrame = useEffectEvent(onFrame);
  const handleError = useEffectEvent(onError);

  useEffect(() => {
    if (url === null) {
      return;
    }

    const source = new EventSource(url);
    // Closing right in the frame handler keeps the browser from reporting the server-side close
    // that follows a terminal frame.
    const closeSource = () => {
      source.close();
    };

    for (const eventName of eventNames) {
      source.addEventListener(eventName, (event: MessageEvent<string>) => {
        let data: unknown;

        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        handleFrame(eventName, data, closeSource);
      });
    }

    // Leaving the page closes the stream with an error; reporting it would start a refresh that the
    // unload aborts mid-render.
    let isPageUnloading = false;

    const handleWindowBeforeUnload = () => {
      isPageUnloading = true;
    };

    const handleWindowPageShow = (event: PageTransitionEvent) => {
      isPageUnloading = false;
      if (event.persisted && source.readyState === EventSource.CLOSED) {
        handleError(source.readyState);
      }
    };

    source.addEventListener('error', () => {
      if (!isPageUnloading) {
        handleError(source.readyState);
      }
    });
    window.addEventListener('beforeunload', handleWindowBeforeUnload);
    window.addEventListener('pageshow', handleWindowPageShow);

    return () => {
      window.removeEventListener('beforeunload', handleWindowBeforeUnload);
      window.removeEventListener('pageshow', handleWindowPageShow);
      closeSource();
    };
  }, [eventNames, url]);
}
