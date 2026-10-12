import { test } from "node:test";
import assert from "node:assert/strict";
import { savePayment, getPayment, markScanned, markPaid } from "../paymentStore";

function newPayment(reference: string) {
  savePayment({ usdcAmount: 1, reference, status: "waiting" });
}

test("markScanned moves a waiting payment to scanned", () => {
  newPayment("ref-scan");
  markScanned("ref-scan");
  assert.equal(getPayment("ref-scan")?.status, "scanned");
});

test("markPaid records the signature", () => {
  newPayment("ref-paid");
  markPaid("ref-paid", "sig123");
  assert.equal(getPayment("ref-paid")?.status, "paid");
  assert.equal(getPayment("ref-paid")?.signature, "sig123");
});

test("markScanned does not move a paid payment back", () => {
  newPayment("ref-keep");
  markPaid("ref-keep", "sig456");
  markScanned("ref-keep");
  assert.equal(getPayment("ref-keep")?.status, "paid");
});

test("unknown references are ignored", () => {
  assert.doesNotThrow(() => markScanned("missing"));
  assert.doesNotThrow(() => markPaid("missing", "sig"));
  assert.equal(getPayment("missing"), undefined);
});
