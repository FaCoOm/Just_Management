import { EventEmitter } from "node:events";

export interface CheckoutCompletedPayload {
  reservationId: string;
  propertyId: string;
  roomIds: string[];
  occurredAt: string;
}

export class OperationsEmitter extends EventEmitter {
  emitCheckoutCompleted(payload: CheckoutCompletedPayload): void {
    this.emit("checkout.completed", payload);
  }

  onCheckoutCompleted(listener: (payload: CheckoutCompletedPayload) => void): void {
    this.on("checkout.completed", listener);
  }
}

export const operationsEvents = new OperationsEmitter();
