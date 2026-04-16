import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import {
  getPhotographerById,
  getPhotographerBySlug,
  listPhotographers,
} from "../src/controllers/photographerProfile.js";
import PhotographerAvailability from "../src/models/photographerAvailability.js";
import PhotographerProfile from "../src/models/photographerProfile.js";

const originals = {
  profileFind: PhotographerProfile.find,
  profileFindOne: PhotographerProfile.findOne,
  profileCountDocuments: PhotographerProfile.countDocuments,
  availabilityFind: PhotographerAvailability.find,
  availabilityFindOne: PhotographerAvailability.findOne,
};

function makeLeanQuery(result) {
  const query = {
    select() {
      return query;
    },
    sort() {
      return query;
    },
    skip() {
      return query;
    },
    limit() {
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

function restoreAll() {
  PhotographerProfile.find = originals.profileFind;
  PhotographerProfile.findOne = originals.profileFindOne;
  PhotographerProfile.countDocuments = originals.profileCountDocuments;
  PhotographerAvailability.find = originals.availabilityFind;
  PhotographerAvailability.findOne = originals.availabilityFindOne;
}

test.afterEach(() => {
  restoreAll();
});

test("getPhotographerBySlug exposes instant booking metadata", async () => {
  const profileId = new mongoose.Types.ObjectId();
  const res = createMockRes();

  PhotographerProfile.findOne = () =>
    makeLeanQuery({
      _id: profileId,
      slug: "lens-artist",
      businessName: "Lens Artist",
    });

  PhotographerAvailability.findOne = () =>
    makeLeanQuery({
      photographerId: profileId,
      bookingMode: "instant",
      isActive: true,
    });

  await getPhotographerBySlug(
    { params: { slug: "lens-artist" } },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload?.profile?.bookingMode, "instant");
  assert.equal(res.payload?.profile?.isInstantBooking, true);
});

test("getPhotographerById falls back to request mode when no active instant availability exists", async () => {
  const profileId = new mongoose.Types.ObjectId();
  const res = createMockRes();

  PhotographerProfile.findOne = () =>
    makeLeanQuery({
      _id: profileId,
      businessName: "Studio One",
    });

  PhotographerAvailability.findOne = () => makeLeanQuery(null);

  await getPhotographerById(
    { params: { id: String(profileId) } },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload?.profile?.bookingMode, "request_only");
  assert.equal(res.payload?.profile?.isInstantBooking, false);
});

test("listPhotographers supports instantOnly filter and enriches list items", async () => {
  const instantProfileId = new mongoose.Types.ObjectId();
  const res = createMockRes();
  let capturedFilter = null;

  PhotographerAvailability.find = (query) => {
    if (query?.photographerId?.$in) {
      return makeLeanQuery([
        {
          photographerId: instantProfileId,
          bookingMode: "instant",
          isActive: true,
        },
      ]);
    }

    return makeLeanQuery([{ photographerId: instantProfileId }]);
  };

  PhotographerProfile.find = (filter) => {
    capturedFilter = filter;
    return makeLeanQuery([
      {
        _id: instantProfileId,
        slug: "instant-studio",
        businessName: "Instant Studio",
      },
    ]);
  };

  PhotographerProfile.countDocuments = async () => 1;

  await listPhotographers(
    { query: { instantOnly: "true", page: "1", limit: "12" } },
    res,
  );

  assert.equal(res.statusCode, 200);
  assert.ok(capturedFilter?._id?.$in, "expected instant filter to constrain profile ids");
  assert.equal(String(capturedFilter._id.$in[0]), String(instantProfileId));
  assert.equal(res.payload?.items?.[0]?.bookingMode, "instant");
  assert.equal(res.payload?.items?.[0]?.isInstantBooking, true);
  assert.equal(res.payload?.items?.length, 1);
});
