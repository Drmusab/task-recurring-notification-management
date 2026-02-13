import { escapeRegExpChars } from "@backend/core/reminders/format/util";

describe("toRegExp()", (): void => {
  test("test", (): void => {
    expect(escapeRegExpChars("abcd")).toBe("abcd");
    expect(escapeRegExpChars("\\ ^ $ . * + ? ( ) [ ] { } | abc")).toBe(
      "\\\\ \\^ \\$ \\. \\* \\+ \\? \\( \\) \\[ \\] \\{ \\} \\| abc",
    );
  });
});
