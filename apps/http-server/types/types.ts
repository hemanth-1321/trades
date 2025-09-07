export interface EngineResponse {
  closingPrice: number;
  orderId: string;
  userId: string;
  asset: string;
  type: "long" | "short";
  margin: number;
  leverage: number;
  quantity: number;
  openingPrice: number;
  exposure: number;
  processed: boolean;
  pnl: number;
}
