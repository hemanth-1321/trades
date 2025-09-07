/*
  Warnings:

  - You are about to drop the column `openPrice` on the `ClosedTrades` table. All the data in the column will be lost.
  - Added the required column `exposure` to the `ClosedTrades` table without a default value. This is not possible if the table is not empty.
  - Added the required column `openingPrice` to the `ClosedTrades` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quantity` to the `ClosedTrades` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."ClosedTrades" DROP COLUMN "openPrice",
ADD COLUMN     "exposure" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "openingPrice" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "quantity" DOUBLE PRECISION NOT NULL;
