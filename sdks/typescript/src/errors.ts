export class NexusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NexusError";
  }
}

export class NexusConnectionError extends NexusError {
  constructor(message: string) {
    super(message);
    this.name = "NexusConnectionError";
  }
}

export class NexusValidationError extends NexusError {
  constructor(message: string) {
    super(message);
    this.name = "NexusValidationError";
  }
}

