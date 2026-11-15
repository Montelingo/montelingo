import { describe, expect, it } from "vitest";

import {
  initialSetup,
  needsSetup,
  NAME_MAX_LENGTH,
  type SetupAction,
  type SetupState,
  setupReducer,
  toProfileUpdate,
} from "./setup";

function run(...actions: SetupAction[]): SetupState {
  return actions.reduce(setupReducer, initialSetup());
}

const NAMED: SetupAction[] = [
  { type: "name-changed", name: "  Mia " },
  { type: "next" },
];

describe("the name step", () => {
  it("starts on the name step with the fox picked, as Figma shows", () => {
    expect(initialSetup()).toMatchObject({
      step: "who",
      name: "",
      avatar: "fox",
      ageBand: null,
      error: null,
    });
  });

  it("goes on to the age step with a name", () => {
    expect(run(...NAMED)).toMatchObject({ step: "age", error: null });
  });

  it.each(["", "   "])("stays and asks for a name when it is %j", (name) => {
    expect(run({ type: "name-changed", name }, { type: "next" })).toMatchObject(
      { step: "who", error: "Dodaj ime" },
    );
  });

  it("stays and says so when the name is too long", () => {
    const state = run(
      { type: "name-changed", name: "a".repeat(NAME_MAX_LENGTH + 1) },
      { type: "next" },
    );

    expect(state).toMatchObject({
      step: "who",
      error: `Ime može imati najviše ${NAME_MAX_LENGTH} slova`,
    });
  });

  it("counts letters, not UTF-16 units, like the API", () => {
    const thirtyEmoji = "🦊".repeat(NAME_MAX_LENGTH);

    expect(
      run({ type: "name-changed", name: thirtyEmoji }, { type: "next" }).step,
    ).toBe("age");
  });

  it("clears the message once the name changes", () => {
    const state = run({ type: "next" }, { type: "name-changed", name: "M" });

    expect(state.error).toBeNull();
  });

  it("keeps the picked buddy", () => {
    expect(run({ type: "avatar-picked", avatar: "owl" }).avatar).toBe("owl");
  });
});

describe("the age step", () => {
  it("asks for a band when none is picked", () => {
    expect(run(...NAMED, { type: "next" })).toMatchObject({
      step: "age",
      error: "Odaberi uzrast",
    });
  });

  it("starts saving once a band is picked", () => {
    const state = run(
      ...NAMED,
      { type: "band-picked", ageBand: "5-6" },
      {
        type: "next",
      },
    );

    expect(state).toMatchObject({ step: "age", saving: true, error: null });
  });

  it("goes back to the name step, keeping everything", () => {
    const state = run(
      ...NAMED,
      { type: "band-picked", ageBand: "7" },
      { type: "back" },
    );

    expect(state).toMatchObject({
      step: "who",
      name: "  Mia ",
      ageBand: "7",
    });
  });

  it("ignores Next while saving", () => {
    const saving = run(
      ...NAMED,
      { type: "band-picked", ageBand: "7" },
      {
        type: "next",
      },
    );

    expect(setupReducer(saving, { type: "next" })).toBe(saving);
    expect(setupReducer(saving, { type: "back" })).toBe(saving);
  });
});

describe("saving", () => {
  const saving = run(
    ...NAMED,
    { type: "band-picked", ageBand: "5-6" },
    {
      type: "next",
    },
  );

  it("is ready to explore once saved", () => {
    expect(setupReducer(saving, { type: "saved" })).toMatchObject({
      step: "ready",
      saving: false,
    });
  });

  it("stays on the age step to try again when saving failed", () => {
    expect(setupReducer(saving, { type: "save-failed" })).toMatchObject({
      step: "age",
      saving: false,
      error: "Nije sačuvano. Pokušaj ponovo.",
    });
  });

  it("sends the profile the steps collected, with the name trimmed", () => {
    expect(toProfileUpdate(saving)).toEqual({
      name: "Mia",
      age_band: "5-6",
      avatar: "fox",
    });
  });

  it("has nothing to send before a band is picked", () => {
    expect(toProfileUpdate(run(...NAMED))).toBeNull();
  });
});

describe("needsSetup", () => {
  it("is true for a profile that is not set up", () => {
    expect(
      needsSetup({
        name: null,
        ageBand: null,
        avatar: null,
        isComplete: false,
      }),
    ).toBe(true);
  });

  it("is false for a set-up profile", () => {
    expect(
      needsSetup({
        name: "Mia",
        ageBand: "5-6",
        avatar: "owl",
        isComplete: true,
      }),
    ).toBe(false);
  });

  it("is false when the profile could not be read", () => {
    expect(needsSetup(null)).toBe(false);
  });
});
