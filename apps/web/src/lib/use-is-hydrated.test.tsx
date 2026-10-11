import { act, render, screen } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { useIsHydrated } from "./use-is-hydrated";

function Probe({ seen = [] }: { seen?: boolean[] }) {
  const isHydrated = useIsHydrated();
  seen.push(isHydrated);
  return <p>{isHydrated ? "hydrated" : "server"}</p>;
}

describe("useIsHydrated", () => {
  it("is false in the server HTML", () => {
    expect(renderToString(<Probe />)).toBe("<p>server</p>");
  });

  it("is false while hydrating, then true, without a mismatch", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<Probe />);
    document.body.append(container);
    const onRecoverableError = vi.fn();
    const seen: boolean[] = [];

    let root: Root | undefined;
    act(() => {
      root = hydrateRoot(container, <Probe seen={seen} />, {
        onRecoverableError,
      });
    });

    expect(seen).toEqual([false, true]);
    expect(container).toHaveTextContent("hydrated");
    expect(onRecoverableError).not.toHaveBeenCalled();
    act(() => {
      root?.unmount();
    });
    container.remove();
  });

  it("is true from the first render in the browser", () => {
    const seen: boolean[] = [];

    render(<Probe seen={seen} />);

    expect(seen).toEqual([true]);
    expect(screen.getByText("hydrated")).toBeInTheDocument();
  });
});
