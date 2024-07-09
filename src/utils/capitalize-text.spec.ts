import { describe, expect, it } from "vitest";
import { capitalizeFirstWord } from "./capitalize-text";

const text = "lorem Ipsum is simply dummy text.";
const capitalizedText = "Lorem Ipsum is simply dummy text.";

describe("[Utils] Capitalize first word", () => {
  it("should be able to capitalize a first word from text", async () => {
    const result = capitalizeFirstWord(text);

    expect(result).toEqual(capitalizedText);
  });
});
