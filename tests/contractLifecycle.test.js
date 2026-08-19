import assert from "node:assert/strict";
import {
  isContractExpired,
  isContractExpiringSoon,
} from "../services/contractServiceV3.js";

const now = new Date("2026-08-19T00:00:00.000Z");

assert.equal(
  isContractExpired({ timeline: { expirationDate: new Date("2026-08-18T00:00:00.000Z") } }, now),
  true,
  "should treat a past expiration date as expired"
);

assert.equal(
  isContractExpired({ timeline: { expirationDate: new Date("2026-08-20T00:00:00.000Z") } }, now),
  false,
  "should not mark a future expiration date as expired"
);

assert.equal(
  isContractExpiringSoon({ timeline: { expirationDate: new Date("2026-08-25T00:00:00.000Z") } }, now, 30),
  true,
  "should count a contract expiring within the next 30 days as expiring soon"
);

assert.equal(
  isContractExpiringSoon({ timeline: { expirationDate: new Date("2026-09-20T00:00:00.000Z") } }, now, 30),
  false,
  "should not count contracts outside the warning window"
);

console.log("contract lifecycle checks passed");
