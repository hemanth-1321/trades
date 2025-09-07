/*
  Warnings:

  - Added the required column `orderId` to the `ClosedTrades` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."ClosedTrades" ADD COLUMN     "orderId" TEXT NOT NULL;
