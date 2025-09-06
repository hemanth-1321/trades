import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../index";

// ---------------------
// Set env vars for testing
// ---------------------
process.env.JWT_SECRET = "testsecret";
process.env.AUTH_URL = "http://localhost:3000";
process.env.FROM_EMAIL = "test@example.com";
process.env.APP_PASSWORD = "password";

// ---------------------
// Mock Prisma
// ---------------------
vi.mock("@repo/db/client", () => {
  const mockPrisma = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});
import { prisma } from "@repo/db/client";

// ---------------------
// Mock nodemailer (default export)
// ---------------------
vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({
      sendMail: vi.fn().mockResolvedValue(true),
    }),
  },
}));

// ---------------------
// Mock jsonwebtoken (default export)
// ---------------------
vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(() => "mocktoken"),
    verify: vi.fn(),
  },
}));

describe("POST /api/v1/auth/signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should send magic link to the user email", async () => {
    // Mock Prisma behavior
    (prisma.user.findUnique as unknown as any).mockResolvedValue(null);
    (prisma.user.create as unknown as any).mockResolvedValue({
      id: "123",
      email: "hemanth02135@gmail.com",
    });

    const res = await request(app).post("/api/v1/auth/signup").send({
      email: "hemanth02135@gmail.com",
    });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("message", "Magic link sent successfully");
    expect(res.body).toHaveProperty("link");
    expect(res.body.link).toContain("mocktoken"); // now works
  });
});
