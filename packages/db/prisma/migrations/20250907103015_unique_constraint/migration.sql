/*
  Warnings:

  - A unique constraint covering the columns `[orderId]` on the table `ClosedTrades` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."ClosedTrades_userId_key";

-- CreateIndex
CREATE UNIQUE INDEX "ClosedTrades_orderId_key" ON "public"."ClosedTrades"("orderId");
