import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { highnote } from "../services/highnote.js";
import { PhoneLabel, HighnoteUserError, HighnoteAccessDeniedError } from "@highnote-oss/nodejs-sdk";
import {
  SignupBodySchema,
  LoginBodySchema,
  OnboardBodySchema,
} from "../types.js";
import { JWT_SECRET } from "../middleware/auth.js";

const BCRYPT_ROUNDS = 10;
const JWT_EXPIRY = "1h";

function signToken(userId: number, email: string, accountHolderId?: string | null): string {
  return jwt.sign(
    { userId, email, accountHolderId: accountHolderId ?? null },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY },
  );
}

export async function authRoutes(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  // Sign up
  typedApp.post("/api/auth/signup", {
    schema: {
      tags: ["Auth"],
      description: "Create a new user account",
      body: SignupBodySchema,
    },
  }, async (request, reply) => {
    const { email, password } = request.body;

    // Check if user already exists
    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (existing) {
      return reply.status(409).send({ error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const [user] = await db
      .insert(schema.users)
      .values({ email, passwordHash })
      .returning();

    const token = signToken(user.id, user.email, null);

    return reply.status(201).send({
      token,
      user: { id: user.id, email: user.email, accountHolderId: null },
    });
  });

  // Log in
  typedApp.post("/api/auth/login", {
    schema: {
      tags: ["Auth"],
      description: "Log in with email and password",
      body: LoginBodySchema,
    },
  }, async (request, reply) => {
    const { email, password } = request.body;

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (!user) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.status(401).send({ error: "Invalid email or password" });
    }

    const token = signToken(user.id, user.email, user.accountHolderId);

    return reply.send({
      token,
      user: {
        id: user.id,
        email: user.email,
        accountHolderId: user.accountHolderId ?? null,
      },
    });
  });

}

/** Onboard route — registered AFTER the auth plugin so request.user is set. */
export async function onboardRoute(app: FastifyInstance) {
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post("/api/onboard", {
    schema: {
      tags: ["Auth"],
      description: "Create an account holder for the logged-in user (requires auth)",
      body: OnboardBodySchema,
    },
  }, async (request, reply) => {
    try {
      const user = request.user;
      if (!user) {
        return reply.status(401).send({ error: "Authentication required" });
      }

      if (user.accountHolderId) {
        return reply.status(409).send({ error: "User already has an account holder" });
      }

      const body = request.body;

      const holder = await highnote.accountHolders.createUSPerson({
        personAccountHolder: {
          name: {
            givenName: body.givenName,
            familyName: body.familyName,
            ...(body.middleName && { middleName: body.middleName }),
          },
          dateOfBirth: body.dateOfBirth,
          ...(body.email && { email: body.email }),
          billingAddress: {
            streetAddress: body.streetAddress,
            ...(body.extendedAddress && { extendedAddress: body.extendedAddress }),
            locality: body.locality,
            region: body.region,
            postalCode: body.postalCode,
            countryCodeAlpha3: "USA",
          },
          ...(body.phoneNumber && {
            phoneNumber: {
              countryCode: body.phoneCountryCode ?? "1",
              number: body.phoneNumber,
              label: PhoneLabel.MOBILE,
            },
          }),
          ...(body.ssn && {
            identificationDocument: {
              socialSecurityNumber: {
                number: body.ssn,
                countryCodeAlpha3: "USA",
              },
            },
          }),
        },
      });

      // Link the Highnote account holder to the user
      await db
        .update(schema.users)
        .set({ accountHolderId: holder.id })
        .where(eq(schema.users.id, user.id));

      // Issue a new token with the account holder ID baked in
      const newToken = signToken(user.id, user.email, holder.id);

      return reply.status(201).send({
        token: newToken,
        user: {
          id: user.id,
          email: user.email,
          accountHolderId: holder.id,
        },
        accountHolder: holder,
      });
    } catch (err) {
      if (err instanceof HighnoteUserError) {
        return reply.status(400).send({
          error: "Highnote validation error",
          fieldErrors: err.fieldErrors,
        });
      }
      if (err instanceof HighnoteAccessDeniedError) {
        return reply.status(403).send({ error: "Access denied", message: err.message });
      }
      throw err;
    }
  });
}
