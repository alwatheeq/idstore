import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";

vi.mock("./hooks", () => ({ useUpdateConcerns: vi.fn() }));

import { useUpdateConcerns } from "./hooks";
import { OrderConcerns } from "./OrderConcerns";

const wrap = (ui: React.ReactNode) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
const mutate = vi.fn();

describe("OrderConcerns", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    mutate.mockClear();
    (useUpdateConcerns as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate,
      isPending: false,
    });
  });

  it("renders labels and validated progress", () => {
    wrap(
      <OrderConcerns
        orderId="o1"
        concerns={[
          { key: "wont_charge", checked: false },
          { key: "noise", checked: true },
        ]}
      />,
    );
    expect(screen.getByText("Won't charge")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 checked")).toBeInTheDocument();
  });

  it("persists a toggle with the updated concern list", async () => {
    wrap(<OrderConcerns orderId="o1" concerns={[{ key: "wont_charge", checked: false }]} />);
    await userEvent.click(screen.getByLabelText("Won't charge"));
    expect(mutate).toHaveBeenCalledWith([{ key: "wont_charge", checked: true }]);
  });

  it("renders nothing when there are no concerns", () => {
    const { container } = wrap(<OrderConcerns orderId="o1" concerns={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
