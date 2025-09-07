/*
  Warnings:

  - Added the required column `type` to the `ClosedTrades` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."TYPE" AS ENUM ('long', 'short');

-- AlterTable
ALTER TABLE "public"."ClosedTrades" ADD COLUMN     "type" "public"."TYPE" NOT NULL;
