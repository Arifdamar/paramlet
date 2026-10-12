import { test } from "node:test";
import assert from "node:assert/strict";
import { isTrackingKey } from "../src/tracking.js";

test("utm parameters are tracking, whatever follows the prefix or the case", () => {
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_whatever", "UTM_Source"]) {
    assert.equal(isTrackingKey(key), true, key);
  }
});

test("click ids from ad networks are tracking", () => {
  for (const key of ["gclid", "fbclid", "msclkid", "gad_source", "mc_eid", "_hsenc"]) {
    assert.equal(isTrackingKey(key), true, key);
  }
});

test("ordinary parameters are not tracking", () => {
  for (const key of ["id", "q", "page", "utm", "source", "ref", "lang", "gclid_x"]) {
    assert.equal(isTrackingKey(key), false, key);
  }
});
