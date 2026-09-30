import { spawn, type ChildProcess } from "node:child_process";
import type { Logger, SleepBlocker } from "../../domain/ports/system";

/**
 * Asks Windows not to sleep while a helper powershell process is alive. The
 * helper holds ES_CONTINUOUS | ES_SYSTEM_REQUIRED on its own thread and exits
 * by itself if this node process goes away, so a crash can't leave it behind.
 */
function helperScript(parentPid: number): string {
  return `
Add-Type -Namespace Win32 -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint flags);'
[void][Win32.Power]::SetThreadExecutionState(0x80000001)
while (Get-Process -Id ${parentPid} -ErrorAction SilentlyContinue) { Start-Sleep -Seconds 10 }
`;
}

type SpawnFn = (command: string, args: string[]) => Pick<ChildProcess, "kill" | "on">;

export class WindowsSleepBlocker implements SleepBlocker {
  private holders = 0;
  private helper: Pick<ChildProcess, "kill" | "on"> | null = null;

  constructor(
    private readonly logger?: Logger,
    private readonly spawnFn: SpawnFn = (command, args) =>
      spawn(command, args, { stdio: "ignore", windowsHide: true }),
    private readonly pid: number = process.pid,
  ) {}

  acquire(): () => void {
    this.holders += 1;
    if (this.holders === 1) this.start();

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.holders -= 1;
      if (this.holders === 0) this.stop();
    };
  }

  private start(): void {
    try {
      const encoded = Buffer.from(helperScript(this.pid), "utf16le").toString("base64");
      const helper = this.spawnFn("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded]);
      helper.on("error", (err) => this.logger?.warn("sleep blocker helper failed", { error: String(err) }));
      this.helper = helper;
    } catch (err) {
      // not being able to block sleep is not a reason to skip the crawl
      this.logger?.warn("could not start sleep blocker", { error: String(err) });
    }
  }

  private stop(): void {
    this.helper?.kill();
    this.helper = null;
  }
}

class NoopSleepBlocker implements SleepBlocker {
  acquire(): () => void {
    return () => {};
  }
}

export function createSleepBlocker(logger?: Logger, platform: NodeJS.Platform = process.platform): SleepBlocker {
  return platform === "win32" ? new WindowsSleepBlocker(logger) : new NoopSleepBlocker();
}
