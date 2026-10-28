import { useEffect } from "react";

import { sameInput, setUnsavedInput } from "./unsavedInput";

/** Reports to the app menu whether this form's input differs from how it opened; leaving the screen clears it. */
export function useUnsavedInput(initial: unknown, current: unknown): void {
  const changed = !sameInput(initial, current);
  useEffect(() => setUnsavedInput(changed), [changed]);
  useEffect(() => () => setUnsavedInput(false), []);
}
