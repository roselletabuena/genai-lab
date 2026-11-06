import { formatCurrency } from './utils';
import type { OrderItem } from './types';

export function calculateTotal(items: OrderItem[]): number {
  let sum = 0;
  for (const item of items) {
    sum += item.price; // Bug: ignores quantity
  }
  return sum;
}
