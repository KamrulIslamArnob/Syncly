import { ClockPort } from "../../application/ports/ports.js";

export class SystemClock extends ClockPort {
  now() {
    return new Date();
  }
}