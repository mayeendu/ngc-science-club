import assert from "node:assert/strict";
import { test } from "node:test";
import { createApiRateLimit } from "../src/middleware/api-rate-limit.ts";
test("expensive routes share a 30-request budget despite path casing and forwarded headers", () => {
  const limiter = createApiRateLimit({ now: () => 0 });
  let status = 200;
  const res = {
    setHeader: () => {},
    status: (value) => {
      status = value;
      return res;
    },
    json: () => {},
  };
  for (let index = 0; index < 31; index++) {
    limiter(
      {
        method: "POST",
        path: index % 2 ? "/ADMIN/REPORTS" : "/manage/resources/fixture/file",
        socket: { remoteAddress: "fixture" },
        headers: { "x-forwarded-for": `spoof-${index}` },
      },
      res,
      () => {},
    );
    assert.equal(status, index < 30 ? 200 : 429);
  }
});
test("API limits bound memory, ignore spoofed proxy headers and reset with time", () => {
  let time = 0;
  const limiter = createApiRateLimit({
    max: 2,
    maxKeys: 1,
    windowMs: 1000,
    now: () => time,
  });
  function send(ip = "fixture", path = "/members", headers = {}) {
    let status = 200,
      next = false;
    const output = {};
    const res = {
      setHeader: (key, value) => {
        output[key] = value;
      },
      status: (value) => {
        status = value;
        return res;
      },
      json: () => {},
    };
    limiter(
      { method: "GET", path, socket: { remoteAddress: ip }, headers },
      res,
      () => {
        next = true;
      },
    );
    return { status, next, output };
  }
  assert.equal(send().next, true);
  assert.equal(
    send("fixture", "/members", { "x-forwarded-for": "spoofed" }).next,
    true,
  );
  assert.equal(send().status, 429);
  assert.equal(send("new").status, 429);
  assert.equal(send("new", "/health").next, true);
  assert.equal(send().output["Retry-After"], "1");
  time = 1001;
  assert.equal(send("new").next, true);
});
