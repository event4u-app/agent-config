import config from "./config.v1.json" with { type: "json" };

// The live app loads config.v1.json — despite the "v1" name, this is current.
// config.legacy.json is the genuinely-dead one from the old prototype.
export function getApiBase(): string {
  return config.apiBase;
}

export function getTimeout(): number {
  return config.timeoutMs;
}
