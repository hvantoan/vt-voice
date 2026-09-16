import { describe, expect, test } from "bun:test";
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "../src/components/ui/toast";
import { Toaster } from "../src/components/ui/toaster";
import { toast, useToast, reducer } from "../src/hooks/use-toast";

describe("Shadcn Toast Setup & Integration", () => {
  test("exports all required toast primitives from toast.tsx", () => {
    expect(Toast).toBeDefined();
    expect(ToastAction).toBeDefined();
    expect(ToastClose).toBeDefined();
    expect(ToastDescription).toBeDefined();
    expect(ToastProvider).toBeDefined();
    expect(ToastTitle).toBeDefined();
    expect(ToastViewport).toBeDefined();
  });

  test("exports Toaster component from toaster.tsx", () => {
    expect(typeof Toaster).toBe("function");
  });

  test("exports toast and useToast from hooks/use-toast.ts", () => {
    expect(typeof toast).toBe("function");
    expect(typeof useToast).toBe("function");
  });

  test("dispatching toast returns id, dismiss, and update functions", () => {
    const item = toast({
      title: "Settings Saved",
      description: "Voice typing configuration has been updated successfully.",
      variant: "success",
    });

    expect(item).toBeDefined();
    expect(typeof item.id).toBe("string");
    expect(typeof item.dismiss).toBe("function");
    expect(typeof item.update).toBe("function");
  });

  test("toast reducer handles ADD_TOAST, UPDATE_TOAST, DISMISS_TOAST, REMOVE_TOAST", () => {
    const initialState = { toasts: [] };

    // 1. ADD_TOAST
    const addedState = reducer(initialState, {
      type: "ADD_TOAST",
      toast: {
        id: "test-1",
        title: "Test Title",
        description: "Test Description",
        open: true,
      },
    });
    expect(addedState.toasts.length).toBe(1);
    expect(addedState.toasts[0].id).toBe("test-1");
    expect(addedState.toasts[0].title).toBe("Test Title");

    // 2. UPDATE_TOAST
    const updatedState = reducer(addedState, {
      type: "UPDATE_TOAST",
      toast: {
        id: "test-1",
        title: "Updated Title",
      },
    });
    expect(updatedState.toasts[0].title).toBe("Updated Title");
    expect(updatedState.toasts[0].description).toBe("Test Description");

    // 3. DISMISS_TOAST
    const dismissedState = reducer(updatedState, {
      type: "DISMISS_TOAST",
      toastId: "test-1",
    });
    expect(dismissedState.toasts[0].open).toBe(false);

    // 4. REMOVE_TOAST
    const removedState = reducer(dismissedState, {
      type: "REMOVE_TOAST",
      toastId: "test-1",
    });
    expect(removedState.toasts.length).toBe(0);
  });
});
