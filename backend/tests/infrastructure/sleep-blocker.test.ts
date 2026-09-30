import { describe, expect, it, vi } from "vitest";
import { createSleepBlocker, WindowsSleepBlocker } from "../../src/infrastructure/system/sleep-blocker";

function fakeSpawn() {
  const child = { kill: vi.fn(), on: vi.fn() };
  const spawnFn = vi.fn(() => child);
  return { child, spawnFn };
}

describe("WindowsSleepBlocker", () => {
  it("starts one helper for overlapping holders and stops it with the last release", () => {
    const { child, spawnFn } = fakeSpawn();
    const blocker = new WindowsSleepBlocker(undefined, spawnFn, 1234);

    const releaseA = blocker.acquire();
    const releaseB = blocker.acquire();
    expect(spawnFn).toHaveBeenCalledTimes(1);

    releaseA();
    expect(child.kill).not.toHaveBeenCalled();
    releaseB();
    expect(child.kill).toHaveBeenCalledTimes(1);
  });

  it("ignores a second release of the same holder", () => {
    const { child, spawnFn } = fakeSpawn();
    const blocker = new WindowsSleepBlocker(undefined, spawnFn, 1234);
    const release = blocker.acquire();
    const other = blocker.acquire();
    release();
    release();
    expect(child.kill).not.toHaveBeenCalled();
    other();
    expect(child.kill).toHaveBeenCalledTimes(1);
  });

  it("passes the parent pid to the helper so it can exit on its own", () => {
    const { spawnFn } = fakeSpawn();
    new WindowsSleepBlocker(undefined, spawnFn, 4321).acquire();

    const [command, args] = spawnFn.mock.calls[0] as unknown as [string, string[]];
    expect(command).toBe("powershell.exe");
    const script = Buffer.from(args[args.length - 1]!, "base64").toString("utf16le");
    expect(script).toContain("SetThreadExecutionState");
    expect(script).toContain("Get-Process -Id 4321");
  });

  it("carries on when the helper can't be started", () => {
    const blocker = new WindowsSleepBlocker(undefined, () => {
      throw new Error("no powershell");
    });
    expect(() => blocker.acquire()()).not.toThrow();
  });
});

describe("createSleepBlocker", () => {
  it("does nothing outside windows", () => {
    const release = createSleepBlocker(undefined, "linux").acquire();
    expect(typeof release).toBe("function");
    expect(() => release()).not.toThrow();
  });
});
