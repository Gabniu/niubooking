import assert from "node:assert/strict";
import test from "node:test";
import { createBooking, fetchBookings, setBookingStatus } from "./bookings-client.js";

const booking = { id: "booking-1", tenantId: "tenant-1", customerId: "customer-1", serviceName: "Consultation", startsAt: "2026-08-14T09:00:00.000Z", endsAt: "2026-08-14T09:30:00.000Z", status: "scheduled" as const };

test("loads a tenant schedule with an encoded date window", async () => {
  const state = await fetchBookings(async (url) => { assert.match(url, /bookings\?from=/); return { status: 200, json: async () => ({ data: [booking], error: null }) }; }, "", "tenant-1", booking.startsAt, booking.endsAt);
  assert.equal(state.kind, "ready");
  assert.equal(state.bookings[0]?.serviceName, "Consultation");
});

test("creates and changes booking status through typed calls", async () => {
  const fetcher = async (_url: string, init: { method?: string }) => { assert.equal(init.method, "POST"); return { status: 201, json: async () => ({ data: booking, error: null }) }; };
  assert.equal((await createBooking(fetcher, "", "tenant-1", { customerId: "customer-1", serviceName: "Consultation", startsAt: booking.startsAt, endsAt: booking.endsAt })).kind, "ready");
  assert.equal((await setBookingStatus(fetcher, "", "tenant-1", "booking-1", "completed")).kind, "ready");
});
