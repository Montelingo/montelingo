"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

/** How long a map message stays before it hides itself. */
export const MESSAGE_HIDE_DELAY_MS = 4000;

type HideMessageOptions = {
  /** Whether the message is on screen. */
  isShown: boolean;
  /**
   * Changes each time the message is shown again, even with the same words,
   * which starts the delay again.
   */
  restartKey?: number;
  /** Hides the message. */
  onHide: () => void;
  /**
   * Whether the message hides itself after the delay. A message that carries
   * an action stays until the learner acts on it or taps it away.
   */
  timesOut?: boolean;
  /**
   * Whether a tap on this element is for the message rather than away from
   * it: a tap on its own action, or one that shows it.
   */
  ownsTap?: (target: Element) => boolean;
};

type MountedMessage = Pick<
  HideMessageOptions,
  "isShown" | "onHide" | "ownsTap"
>;

// The messages on the page, shown or not, each kept up to date. One listener
// serves them all, so one message never swallows a tap meant for another.
const mountedMessages = new Set<{ current: MountedMessage }>();

// Caught on the window, before the tap reaches the page or the document's
// own listeners (NavigationProgress's, which would start a navigation that
// never comes). A tap that a message owns goes through and hides nothing, as
// does one in an open dialog, which covers the messages. Any other tap hides
// every message on screen and does nothing else: a link does not open and
// React's handlers never see it. Keyboard presses pass through, as they do not
// reach for a message.
function handleClick(event: MouseEvent): void {
  // A click from the keyboard (Enter or Space on a button) has no detail.
  if (event.detail === 0) {
    return;
  }
  const messages = [...mountedMessages].map((message) => message.current);
  const shown = messages.filter(({ isShown }) => isShown);
  const { target } = event;
  if (
    shown.length === 0 ||
    (target instanceof Element &&
      (target.closest("dialog[open]") !== null ||
        messages.some(({ ownsTap }) => ownsTap?.(target))))
  ) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  for (const { onHide } of shown) {
    onHide();
  }
}

// Hides a map message after MESSAGE_HIDE_DELAY_MS, and straight away on a tap
// anywhere else on the screen.
export function useHideMessage({
  isShown,
  restartKey,
  onHide,
  timesOut = true,
  ownsTap,
}: HideMessageOptions): void {
  const messageRef = useRef<MountedMessage>({ isShown, onHide, ownsTap });
  // In a layout effect, so the listener never sees a message as shown after
  // React has hidden it.
  useLayoutEffect(() => {
    messageRef.current = { isShown, onHide, ownsTap };
  });

  useEffect(() => {
    if (mountedMessages.size === 0) {
      window.addEventListener("click", handleClick, { capture: true });
    }
    mountedMessages.add(messageRef);
    return () => {
      mountedMessages.delete(messageRef);
      if (mountedMessages.size === 0) {
        window.removeEventListener("click", handleClick, { capture: true });
      }
    };
  }, []);

  useEffect(() => {
    if (!isShown || !timesOut) {
      return;
    }
    const timer = window.setTimeout(
      () => messageRef.current.onHide(),
      MESSAGE_HIDE_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [isShown, restartKey, timesOut]);
}
