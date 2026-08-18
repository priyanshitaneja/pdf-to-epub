import type { WorkerEvent } from '../types/worker-protocol.ts';

export type ConvertEventSink = (event: WorkerEvent) => void;
