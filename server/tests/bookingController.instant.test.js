import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { createBooking } from "../src/controllers/bookingController.js";
import AvailabilityOverride from "../src/models/availabilityOverride.js";
import Booking from "../src/models/booking.js";
import PhotographerAvailability from "../src/models/photographerAvailability.js";
import PhotographerProfile from "../src/models/photographerProfile.js";
import UserCollection from "../src/models/UserModel.js";
import { zonedDateTimeToUtc } from "../src/utils/availabilityUtils.js";

const originals = {
  bookingUpdateMany: Booking.updateMany,
  bookingFind: Booking.find,
  bookingFindOne: Booking.findOne,
  bookingCreate: Booking.create,
  profileFindById: PhotographerProfile.findById,
  availabilityFindOne: PhotographerAvailability.findOne,
  availabilityOverrideFindOne: AvailabilityOverride.findOne,
  userFindById: UserCollection.findById,
};

function makeLeanQuery(result) {
  const query = {
    select() {
      return query;
    },
    lean() {
      return Promise.resolve(typeof result === "function" ? result() : result);
    },
  };

  return query;
}

function createMockRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };
}

function formatDateKeyFromNow(daysAhead = 2) {
  const date = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function buildWeeklySchedule() {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isWorking: true,
    windows: [{ startMinute: 600, endMinute: 720 }],
  }));
}

function buildAvailability(bookingMode) {
  return {
    isActive: true,
    timezone: "Asia/Kolkata",
    slotStepMinutes: 30,
    minSessionMinutes: 60,
    maxSessionMinutes: 240,
    defaultSessionMinutes: 60,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    minNoticeMinutes: 0,
    maxAdvanceDays: 365,
    bookingMode,
    weeklySchedule: buildWeeklySchedule(),
  };
}

function buildRequest({ photographerId, customerId, bookingMode }) {
  const eventDate = formatDateKeyFromNow(2);
  const startAtUtc = zonedDateTimeToUtc(eventDate, 600, "Asia/Kolkata");
  const endAtUtc = zonedDateTimeToUtc(eventDate, 660, "Asia/Kolkata");

  const req = {
    user: {
      userId: customerId,
      role: "customer",
    },
    body: {
      photographerId: String(photographerId),
      eventType: "wedding",
      eventDate,
      timezone: "Asia/Kolkata",
      slotName: "10:00 - 11:00",
      startTime: "10:00",
      endTime: "11:00",
      startAtUtc: startAtUtc.toISOString(),
      endAtUtc: endAtUtc.toISOString(),
      eventLocation: {
        address: "123 Street",
        city: "Kolkata",
        state: "West Bengal",
        pincode: "700001",
      },
      source: "web",
      idempotencyKey: `test-${bookingMode}`,
    },
  };

  return req;
}

function restoreAll() {
  Booking.updateMany = originals.bookingUpdateMany;
  Booking.find = originals.bookingFind;
  Booking.findOne = originals.bookingFindOne;
  Booking.create = originals.bookingCreate;
  PhotographerProfile.findById = originals.profileFindById;
  PhotographerAvailability.findOne = originals.availabilityFindOne;
  AvailabilityOverride.findOne = originals.availabilityOverrideFindOne;
  UserCollection.findById = originals.userFindById;
}

test.afterEach(() => {
  restoreAll();
});

function mockDependencies({ photographerId, bookingMode, createdPayloadRef }) {
  Booking.updateMany = async () => ({ acknowledged: true });

  Booking.find = () => makeLeanQuery([]);

  Booking.findOne = (query) => {
    if (query?.bookingCode) return makeLeanQuery(null);
    if (query?.customerId && query?.idempotencyKey) return makeLeanQuery(null);
    if (query?.photographerId && query?.startAtUtc && query?.endAtUtc) {
      return makeLeanQuery(null);
    }
    return makeLeanQuery(null);
  };

  Booking.create = async (payload) => {
    createdPayloadRef.value = payload;
    return {
      _id: new mongoose.Types.ObjectId(),
      ...payload,
    };
  };

  PhotographerProfile.findById = () =>
    makeLeanQuery({
      _id: photographerId,
      isActive: true,
      verificationStatus: "approved",
      eventTypes: ["wedding"],
      customEventTypes: [],
      userId: null,
      businessName: "Mock Studio",
    });

  PhotographerAvailability.findOne = () => makeLeanQuery(buildAvailability(bookingMode));
  AvailabilityOverride.findOne = () => makeLeanQuery(null);
  UserCollection.findById = () => makeLeanQuery(null);
}

test("createBooking auto-accepts and marks instant bookings immediately", async () => {
  const photographerId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const createdPayloadRef = { value: null };
  const req = buildRequest({ photographerId, customerId, bookingMode: "instant" });
  const res = createMockRes();

  mockDependencies({
    photographerId,
    bookingMode: "instant",
    createdPayloadRef,
  });

  await createBooking(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.payload?.instant, true);
  assert.equal(res.payload?.booking?.status, "accepted");
  assert.equal(createdPayloadRef.value?.status, "accepted");
  assert.ok(createdPayloadRef.value?.acceptedAt instanceof Date);
  assert.equal(createdPayloadRef.value?.expiresAt, null);
  assert.equal(createdPayloadRef.value?.statusHistory?.[1]?.changedByRole, "system");
  assert.equal(createdPayloadRef.value?.statusHistory?.[1]?.toStatus, "accepted");
});

test("createBooking keeps request mode bookings pending", async () => {
  const photographerId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const createdPayloadRef = { value: null };
  const req = buildRequest({
    photographerId,
    customerId,
    bookingMode: "request_only",
  });
  const res = createMockRes();

  mockDependencies({
    photographerId,
    bookingMode: "request_only",
    createdPayloadRef,
  });

  await createBooking(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.payload?.instant, false);
  assert.equal(res.payload?.booking?.status, "pending");
  assert.equal(createdPayloadRef.value?.status, "pending");
  assert.equal(
    Object.prototype.hasOwnProperty.call(createdPayloadRef.value || {}, "acceptedAt"),
    false,
  );
  assert.equal(createdPayloadRef.value?.statusHistory?.length, 1);
});
