import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";

vi.mock("@/features/vehicles/hooks", () => ({
  useModelImages: vi.fn(),
  useUploadModelImage: vi.fn(),
  useDeleteModelImage: vi.fn(),
}));

import {
  useModelImages,
  useUploadModelImage,
  useDeleteModelImage,
} from "@/features/vehicles/hooks";
import { SettingsPage } from "@/pages/SettingsPage";

const fn = (h: unknown) => h as unknown as ReturnType<typeof vi.fn>;
const wrap = (ui: React.ReactNode) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

describe("SettingsPage — vehicle images", () => {
  const uploadMutate = vi.fn();

  beforeEach(async () => {
    await i18n.changeLanguage("en");
    uploadMutate.mockClear();
    fn(useModelImages).mockReturnValue({ data: { id4: "https://x/id4.png" } });
    fn(useUploadModelImage).mockReturnValue({ mutate: uploadMutate, isPending: false });
    fn(useDeleteModelImage).mockReturnValue({ mutate: vi.fn() });
  });

  it("lists a slot per model plus a default, and shows uploaded images", () => {
    wrap(<SettingsPage />);
    expect(screen.getByText("Vehicle images")).toBeInTheDocument();
    expect(screen.getByText("ID.3")).toBeInTheDocument();
    expect(screen.getByText("ID. Buzz")).toBeInTheDocument();
    expect(screen.getByText("Default (other models)")).toBeInTheDocument();
    // id4 has an uploaded image
    expect(screen.getByAltText("ID.4").getAttribute("src")).toContain("id4.png");
  });

  it("uploads a file for a model slot", async () => {
    wrap(<SettingsPage />);
    const input = screen.getByLabelText("Upload image — ID.3") as HTMLInputElement;
    const file = new File(["x"], "id3.png", { type: "image/png" });
    await userEvent.upload(input, file);
    expect(uploadMutate).toHaveBeenCalledWith(
      expect.objectContaining({ modelKey: "id3", file: expect.any(File) }),
    );
  });
});
