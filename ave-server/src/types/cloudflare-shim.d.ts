interface DurableObjectId {}

interface DurableObjectStub {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
}

interface DurableObjectState {
  readonly storage: DurableObjectStorage;
}

interface ScheduledController {
  readonly cron: string;
  readonly scheduledTime: number;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException?(): void;
}

declare class WebSocketPair {
  0: WebSocket;
  1: WebSocket;
}

interface WebSocket {
  accept(): void;
}

interface ResponseInit {
  webSocket?: WebSocket;
}

type D1SessionConstraint = "first-primary" | "first-unconstrained";
type D1SessionBookmark = string;

interface D1Result<T = Record<string, unknown>> {
  success: boolean;
  results?: T[];
  meta?: Record<string, unknown>;
}

interface D1ExecResult {
  count: number;
  duration: number;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  raw<T = unknown[]>(options?: { columnNames?: boolean }): Promise<T[]>;
}

interface D1DatabaseSession {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  getBookmark(): D1SessionBookmark | null;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
  withSession(constraintOrBookmark?: D1SessionConstraint | D1SessionBookmark): D1DatabaseSession;
}
