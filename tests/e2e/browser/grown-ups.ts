import { expect, type Locator, type Page } from "@playwright/test";

// Helpers for the grown-ups gate (#177): "Pritisni i drži broj devet" over
// four digits, drawn at random. The helpers read the target from the heading,
// so they work with any draw. Not a spec: Playwright runs `*.spec.ts` only.

// The digits 1 to 9 written out, as the gate's heading says them
// (apps/web/src/features/grown-ups/model/gate.ts).
const NUMBER_WORDS = [
  "jedan",
  "dva",
  "tri",
  "četiri",
  "pet",
  "šest",
  "sedam",
  "osam",
  "devet",
];

/** The gate, over the Ja screen or on the grown-ups page itself. */
export function gate(page: Page): Locator {
  return page.getByRole("dialog", { name: /^Pritisni i drži broj / });
}

/** The digit the gate asks for, read from its heading. */
async function targetDigit(page: Page): Promise<number> {
  const heading = await gate(page).getByRole("heading").textContent();
  const word = heading?.trim().split(/\s+/).at(-1);
  const digit = NUMBER_WORDS.indexOf(word ?? "") + 1;
  if (digit === 0) {
    throw new Error(`The gate asks for no known number: ${heading}`);
  }
  return digit;
}

function digitButton(page: Page, digit: number): Locator {
  return gate(page).getByRole("button", { name: String(digit), exact: true });
}

/**
 * Holds the named digit until the gate lets the grown-up through. The hold
 * is Space held down on the digit, which the gate takes as a held finger:
 * a touch held for exactly 1.5 s is not something Playwright can do reliably.
 */
export async function passGate(page: Page): Promise<void> {
  await expect(gate(page)).toBeVisible();
  await digitButton(page, await targetDigit(page)).focus();
  await page.keyboard.down("Space");
  // The gate closes once the ring is full (HOLD_MS, 1.5 s); a busy stack
  // can take a while longer to load the next page.
  await expect(gate(page)).toBeHidden({ timeout: 10_000 });
  await page.keyboard.up("Space");
}

/** Taps a digit the gate did not ask for: it shakes and asks again. */
export async function tapWrongDigit(page: Page): Promise<void> {
  const target = await targetDigit(page);
  const digits = gate(page).getByRole("button", { name: /^[1-9]$/ });
  await expect(digits).toHaveCount(4);
  for (const button of await digits.all()) {
    if ((await button.textContent())?.trim() !== String(target)) {
      await button.click();
      break;
    }
  }
  await expect(gate(page).getByText(/^Pokušaj ponovo\./)).toBeVisible();
}
