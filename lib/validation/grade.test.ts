import { describe, expect, it } from "vitest";
import { DEFAULT_SCALE } from "@/lib/domain/grading";
import { gradeInputSchema } from "./grade";

const base = {
  subject_id: "6f1c2b0a-8d3e-4f5a-9b7c-1d2e3f4a5b6c",
  value: "7+",
  weight: "1",
  kind: "oral",
  graded_on: "2026-11-19",
  description: "  Kant ",
};

describe("gradeInputSchema", () => {
  const schema = gradeInputSchema(DEFAULT_SCALE);

  it("interpreta il voto e converte il peso", () => {
    expect(schema.parse(base)).toEqual({ ...base, value: 7.25, weight: 1, description: "Kant" });
  });

  it("spiega perché un voto non va bene", () => {
    expect(schema.safeParse({ ...base, value: "" }).error?.issues[0].message).toBe("Scrivi il voto");
    expect(schema.safeParse({ ...base, value: "11" }).error?.issues[0].message).toBe("Voto fuori dalla tua scala");
    expect(schema.safeParse({ ...base, value: "boh" }).error?.issues[0].message).toMatch(/Formato/);
    const noPlus = gradeInputSchema({ ...DEFAULT_SCALE, allowPlusMinus: false });
    expect(noPlus.safeParse(base).error?.issues[0].message).toBe("La tua scala non ammette questo voto");
  });

  it("valida materia, peso e data", () => {
    expect(schema.safeParse({ ...base, subject_id: "" }).success).toBe(false);
    expect(schema.safeParse({ ...base, weight: "0" }).success).toBe(false);
    expect(schema.safeParse({ ...base, graded_on: "2026-02-30" }).success).toBe(false);
  });
});
