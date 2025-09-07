import { MongoClient } from "mongodb";
import { pendingOrders, latestPrice } from "./states";

const client = new MongoClient(process.env.MONGO_URL!);
await client.connect();
const db = client.db("trading");
const snapshots = db.collection("snapshots");

/**
 * Take a snapshot of current pending orders and latest prices
 */
export async function takeSnapshot(pendingOrders: any[], latestPrice: any) {
  try {
    const snapshot = {
      createdAt: new Date(),
      orders: pendingOrders.map((o) => o.data),
      prices: latestPrice,
    };
    await snapshots.insertOne(snapshot);
    console.log("Snapshot saved at", snapshot.createdAt);
  } catch (err) {
    console.error("Error saving snapshot", err);
  }
}
