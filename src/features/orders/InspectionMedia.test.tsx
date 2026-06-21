import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { InspectionMedia } from "./InspectionMedia";

vi.mock("@/features/orders/hooks", () => ({
  useMedia: vi.fn(),
  useUploadMedia: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteMedia: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({ show: vi.fn() }),
}));

vi.mock("@/features/orders/api", () => ({
  signedMediaUrl: vi.fn(async () => "https://example/x.jpg"),
}));

import { useMedia } from "@/features/orders/hooks";

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const wrap = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider client={makeClient()}>
      <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>
    </QueryClientProvider>,
  );

describe("InspectionMedia", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("shows empty state when there are no media items", () => {
    (useMedia as ReturnType<typeof vi.fn>).mockReturnValue({ data: [] });
    wrap(<InspectionMedia orderId="o1" />);
    expect(screen.getByText("No photos or video yet")).toBeInTheDocument();
  });

  it("renders a delete button when a media item exists", () => {
    (useMedia as ReturnType<typeof vi.fn>).mockReturnValue({
      data: [
        {
          id: "m1",
          service_order_id: "o",
          media_type: "photo",
          storage_path: "o/x.jpg",
          caption: null,
          created_at: "",
        },
      ],
    });
    wrap(<InspectionMedia orderId="o1" />);
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });
});
