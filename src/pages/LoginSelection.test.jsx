import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import LoginSelection from "./LoginSelection.jsx";

let mockNavigate;

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

describe("LoginSelection", () => {
  beforeEach(() => {
    mockNavigate = jest.fn();
  });

  test("defaults to User and continues to the existing user login route", () => {
    render(<LoginSelection />);

    expect(screen.getByRole("combobox", { name: "Login" })).toHaveValue("user");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  test("continues to the existing admin login route when Admin is selected", () => {
    render(<LoginSelection />);

    fireEvent.change(screen.getByRole("combobox", { name: "Login" }), {
      target: { value: "admin" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(mockNavigate).toHaveBeenCalledWith("/admin-login");
  });
});
