export interface SessionNavigationState {
  handledSessionId: string | null | undefined;
}

export interface SessionNavigationTransition {
  state: SessionNavigationState;
  shouldHydrate: boolean;
}

/**
 * Convert one reactive route identity change into at most one hydration.
 * `undefined` represents a route that has not been observed by this mounted
 * workspace yet; `null` is the explicit no-session route.
 */
export function transitionSessionNavigation(
  state: SessionNavigationState,
  desiredSessionId: string | null,
): SessionNavigationTransition {
  const shouldHydrate = state.handledSessionId !== desiredSessionId;
  return {
    state: shouldHydrate ? { handledSessionId: desiredSessionId } : state,
    shouldHydrate,
  };
}
