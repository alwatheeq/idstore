import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VehicleImage } from "./VehicleImage";
import { ModelImagesContext } from "./ModelImagesContext";

describe("VehicleImage", () => {
  it("shows a placeholder (no img) when no image is uploaded", () => {
    render(<VehicleImage model="ID.4" />);
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders the uploaded image for the model when available", () => {
    render(
      <ModelImagesContext.Provider value={{ id4: "https://x/id4.png" }}>
        <VehicleImage model="ID.4" />
      </ModelImagesContext.Provider>,
    );
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("alt", "ID.4");
    expect(img.getAttribute("src")).toContain("id4.png");
  });

  it("uses the default slot for unmatched models", () => {
    render(
      <ModelImagesContext.Provider value={{ default: "https://x/default.png" }}>
        <VehicleImage model="ID.7" />
      </ModelImagesContext.Provider>,
    );
    expect(screen.getByRole("img").getAttribute("src")).toContain("default.png");
  });
});
