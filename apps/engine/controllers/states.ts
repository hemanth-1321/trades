export interface Order {
  orderId: string;
  id: string;
  asset: string;
  userId: string;
  type: "long" | "short";
  margin?: number;
  leverage?: number;
  quantity: number;
  openingPrice: number;
  stopLoss?: number;
  exposure?: number;
  processed?: boolean;
}
export const latestPrice: Record<
  string,
  { price: number; decimal: number; id: string }
> = {};

export const pendingOrders: { id: string; data: Order }[] = [];
