import { describe, expect, it } from "vitest";
import { buildPierreChangedFilesTreeInput, mapChangedFileStatusToPierre, normalizeChangedFilePath } from "./changed-files-tree.pure";

describe("changed files tree helpers", () => {
  it("normalizes file paths before building Pierre tree input", () => {
    expect(
      buildPierreChangedFilesTreeInput({
        files: [
          { file: ".\\src\\app.ts", status: "modified" },
          { file: "./src/new.ts", status: "added" },
        ],
      }),
    ).toEqual({
      gitStatus: [
        { path: "src/app.ts", status: "modified" },
        { path: "src/new.ts", status: "added" },
      ],
      paths: ["src/app.ts", "src/new.ts"],
    });
  });

  it("maps GitHub-ish statuses to Pierre statuses", () => {
    expect(mapChangedFileStatusToPierre("removed")).toBe("deleted");
    expect(mapChangedFileStatusToPierre("A")).toBe("added");
    expect(mapChangedFileStatusToPierre("D")).toBe("deleted");
    expect(mapChangedFileStatusToPierre("R100")).toBe("renamed");
  });

  it("normalizes slash style and leading dot segments", () => {
    expect(normalizeChangedFilePath(".\\src\\review\\page.tsx")).toBe("src/review/page.tsx");
  });
});
