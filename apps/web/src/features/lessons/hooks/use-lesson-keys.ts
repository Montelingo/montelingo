"use client";

import { type Dispatch, useEffect } from "react";

import type { LessonAction } from "../model/lesson";

const KEY_ACTIONS: Partial<Record<string, LessonAction>> = {
  ArrowRight: { type: "next" },
  ArrowLeft: { type: "back" },
};

/**
 * Turns the card on the arrow keys wherever the focus is: the lesson is the
 * whole screen, and nothing on it takes arrow keys. A held key turns one card.
 */
export function useLessonKeys(dispatch: Dispatch<LessonAction>) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        isEditable(event.target)
      ) {
        return;
      }
      const action = KEY_ACTIONS[event.key];
      if (action !== undefined) {
        event.preventDefault();
        dispatch(action);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dispatch]);
}

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement)
  );
}
