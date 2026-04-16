import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import Delivery from "../src/models/delivery.js";
import PhotographerProfile from "../src/models/photographerProfile.js";
import Review from "../src/models/review.js";
import { upsertCustomerDeliveryReview } from "../src/services/reviewService.js";

const originals = {
  startSession: mongoose.startSession,
  deliveryFindOne: Delivery.findOne,
  reviewFindOne: Review.findOne,
  reviewFindOneAndUpdate: Review.findOneAndUpdate,
  reviewFindById: Review.findById,
  profileFindById: PhotographerProfile.findById,
};

function makeLeanQuery({ result, error, onSession }) {
  const query = {
    select() {
      return query;
    },
    session() {
      if (onSession) onSession();
      return query;
    },
    populate() {
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
      if (error) {
        return Promise.reject(error);
      }
      return Promise.resolve(typeof result === "function" ? result() : result);
    },
  };

  return query;
}

function makeAwaitableQuery({ result, onSession }) {
  const query = {
    select() {
      return query;
    },
    session() {
      if (onSession) onSession();
      return query;
    },
    then(resolve, reject) {
      return Promise.resolve(typeof result === "function" ? result() : result).then(
        resolve,
        reject,
      );
    },
  };

  return query;
}

function restoreAll() {
  mongoose.startSession = originals.startSession;
  Delivery.findOne = originals.deliveryFindOne;
  Review.findOne = originals.reviewFindOne;
  Review.findOneAndUpdate = originals.reviewFindOneAndUpdate;
  Review.findById = originals.reviewFindById;
  PhotographerProfile.findById = originals.profileFindById;
}

test.afterEach(() => {
  restoreAll();
});

test("falls back to non-transaction review write when transactions are unsupported", async () => {
  const deliveryId = new mongoose.Types.ObjectId();
  const bookingId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const photographerId = new mongoose.Types.ObjectId();
  const reviewId = new mongoose.Types.ObjectId();
  const deliverySessionAttachCount = { value: 0 };
  const profileSaveCount = { value: 0 };
  const withTransactionCalls = { value: 0 };
  const endSessionCalls = { value: 0 };

  mongoose.startSession = async () => ({
    async withTransaction() {
      withTransactionCalls.value += 1;
      throw new Error("transactions are not supported");
    },
    async endSession() {
      endSessionCalls.value += 1;
    },
  });

  Delivery.findOne = () =>
    makeLeanQuery({
      result: {
        _id: deliveryId,
        bookingId,
        customerId,
        photographerId,
        status: "customer_confirmed",
      },
      onSession: () => {
        deliverySessionAttachCount.value += 1;
      },
    });

  Review.findOne = () => makeLeanQuery({ result: null });
  Review.findOneAndUpdate = () => makeLeanQuery({ result: { _id: reviewId } });
  PhotographerProfile.findById = () =>
    makeAwaitableQuery({
      result: {
        totalReviews: 0,
        ratingSum: 0,
        avgRating: 0,
        async save() {
          profileSaveCount.value += 1;
        },
      },
    });

  Review.findById = () =>
    makeLeanQuery({
      result: {
        _id: String(reviewId),
        rating: 5,
        comment: "Great service",
        bookingId: { bookingCode: "BK1001" },
        customerId: { name: "Alice" },
      },
    });

  const review = await upsertCustomerDeliveryReview({
    deliveryId: String(deliveryId),
    customerId: String(customerId),
    rating: 5,
    comment: "Great service",
  });

  assert.equal(withTransactionCalls.value, 1);
  assert.equal(
    deliverySessionAttachCount.value,
    0,
    "fallback write should run without session attachment",
  );
  assert.equal(profileSaveCount.value, 1);
  assert.equal(endSessionCalls.value, 1);
  assert.equal(review._id, String(reviewId));
});

test("maps duplicate key conflicts from concurrent writes to HTTP 409", async () => {
  const deliveryId = new mongoose.Types.ObjectId();
  const bookingId = new mongoose.Types.ObjectId();
  const customerId = new mongoose.Types.ObjectId();
  const photographerId = new mongoose.Types.ObjectId();
  const endSessionCalls = { value: 0 };

  mongoose.startSession = async () => ({
    async withTransaction(callback) {
      await callback();
    },
    async endSession() {
      endSessionCalls.value += 1;
    },
  });

  Delivery.findOne = () =>
    makeLeanQuery({
      result: {
        _id: deliveryId,
        bookingId,
        customerId,
        photographerId,
        status: "customer_confirmed",
      },
    });

  Review.findOne = () => makeLeanQuery({ result: null });
  Review.findOneAndUpdate = () =>
    makeLeanQuery({
      error: Object.assign(new Error("E11000 duplicate key error"), {
        code: 11000,
      }),
    });

  await assert.rejects(
    () =>
      upsertCustomerDeliveryReview({
        deliveryId: String(deliveryId),
        customerId: String(customerId),
        rating: 4,
        comment: "Nice work",
      }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.message, "Review write conflict. Please retry.");
      return true;
    },
  );

  assert.equal(endSessionCalls.value, 1);
});
