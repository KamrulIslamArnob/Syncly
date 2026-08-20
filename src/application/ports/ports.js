// Application-layer ports (driven interfaces).
// These are implemented by the infrastructure layer.

// Returns opaque id strings. The infrastructure layer plugs in either
// crypto.randomUUID() or chrome.identity-based generators, etc.
export class IdGeneratorPort {
  next() {
    throw new Error("not implemented");
  }
}

// Time abstraction. Lets use cases be deterministic in tests and
// also gives us a single seam to render "user local time" consistently.
export class ClockPort {
  now() {
    throw new Error("not implemented");
  }
}