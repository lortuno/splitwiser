import { useRef } from "react";
import { Platform } from "react-native";

/**
 * Runs an action once a Modal has closed, through the Modal's `onDismiss`. On the web a closing Modal hands focus back
 * to what opened it, which would take focus (and typing) from the screen the action opens. Android does not report
 * the close, and has no such focus hand-back, so there the action runs at once.
 */
export function useAfterClose(): { later: (action: () => void) => void; onDismiss: () => void } {
  const next = useRef<(() => void) | null>(null);
  return {
    later: (action) => {
      if (Platform.OS === "android") {
        action();
      } else {
        next.current = action;
      }
    },
    onDismiss: () => {
      const action = next.current;
      next.current = null;
      action?.();
    },
  };
}
