// Ownership: API transport parsing. Only URL-encoded provider payloads use this parser; domain routes receive plain objects.

import type { FastifyInstance } from "fastify";

export function registerUrlEncodedBodyParser(app: FastifyInstance): void {
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_request, body, done) => {
    try {
      const raw = typeof body === "string" ? body : body.toString();
      done(null, Object.fromEntries(new URLSearchParams(raw).entries()));
    } catch (error) {
      done(error as Error, undefined);
    }
  });
}
