import type { Clock } from "../../domain/ports/system";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
