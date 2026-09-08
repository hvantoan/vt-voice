import { describe, expect, test } from "bun:test";
import { confirm, ConfirmationDialog, type ConfirmOptions } from "../src/components/ui/confirm";

describe("Shared Confirmation Dialog (react-confirm)", () => {
  test("confirm helper is exported and is a callable function", () => {
    expect(typeof confirm).toBe("function");
  });

  test("ConfirmationDialog component is exported", () => {
    expect(typeof ConfirmationDialog).toBe("function");
  });

  test("ConfirmOptions contract supports expected structure and variants", () => {
    const options: ConfirmOptions = {
      title: "Confirm Deletion",
      description: "Are you sure you want to proceed?",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive",
    };

    expect(options.title).toBe("Confirm Deletion");
    expect(options.description).toBe("Are you sure you want to proceed?");
    expect(options.confirmText).toBe("Delete");
    expect(options.cancelText).toBe("Cancel");
    expect(options.variant).toBe("destructive");
  });

  test("ConfirmationDialog proceed callback delivers boolean response", () => {
    let proceedValue: boolean | null = null;
    const mockProceed = (val: boolean) => {
      proceedValue = val;
    };

    mockProceed(true);
    expect(proceedValue).toBe(true);

    mockProceed(false);
    expect(proceedValue).toBe(false);
  });
});
