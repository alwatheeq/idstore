import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/i18n";
import { SoftwareDueBadge } from "./SoftwareDueBadge";

const wrap = (ui: React.ReactNode) => render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);

describe("SoftwareDueBadge", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders 'Update due' when the vehicle is behind target", () => {
    wrap(<SoftwareDueBadge vehicle={{ software_version: "3.2", target_software_version: "4.0" }} />);
    expect(screen.getByText("Update due")).toBeInTheDocument();
  });

  it("renders nothing when the vehicle is up to date", () => {
    const { container } = wrap(
      <SoftwareDueBadge vehicle={{ software_version: "4.0", target_software_version: "4.0" }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
