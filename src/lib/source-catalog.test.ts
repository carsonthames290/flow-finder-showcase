import { describe, it as test } from "node:test";
import { strict as assert } from "node:assert";
const expect = (value: unknown) => ({ toBe: (expected: unknown) => assert.equal(value, expected), toBeUndefined: () => assert.equal(value, undefined) });
import { SOURCE_CATALOG, searchCode, sourceCode, matchesSearch } from "./source-catalog";

describe("source shortcuts", () => {
  test("tim selects timst.top", () => { expect(searchCode("tim")).toBe("tim"); expect(SOURCE_CATALOG.tim.url).toBe("https://timst.top"); });
  test("pit selects pitsport.st", () => { expect(searchCode("pit")).toBe("pit"); expect(SOURCE_CATALOG.pit.url).toBe("https://pitsport.st"); });
  test("daddy selects thedaddy.pk", () => { expect(searchCode("daddy")).toBe("daddy"); expect(SOURCE_CATALOG.daddy.url).toBe("https://thedaddy.pk"); });
  test("ppv selects ppv.st", () => { expect(searchCode("ppv")).toBe("ppv"); expect(SOURCE_CATALOG.ppv.url).toBe("https://ppv.st"); });
  test("main homepage retains StrmFree", () => { expect(sourceCode(undefined)).toBe("strmfree"); expect(sourceCode("invalid")).toBe("strmfree"); });
  test("ordinary search filters games, not source codes", () => { expect(matchesSearch({ title: "Dolphins vs Cowboys", category: "Football" }, "dolphins football")).toBe(true); expect(matchesSearch({ title: "Marlins vs Cubs", category: "Baseball" }, "dolphins")).toBe(false); expect(searchCode("dolphins")).toBeUndefined(); });
});