let mockAuthCallbacks;
let mockNavigate;

jest.mock("../api/client.js", () => ({
  logoutSession: jest.fn(),
  registerAuthCallbacks: jest.fn((callbacks) => {
    mockAuthCallbacks = callbacks;
    return jest.fn();
  }),
}));

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { logoutSession } from "../api/client.js";
import { AuthProvider, useAuth } from "./AuthContext.jsx";

function AuthControls() {
  const { auth, login, logout } = useAuth();

  return (
    <>
      <output data-testid="access-token">{auth.accessToken || "none"}</output>
      <button onClick={() => login({ id: "user-1", role: "user" }, "token-1")}>
        Login
      </button>
      <button onClick={() => login({ id: "admin-1", role: "admin" }, "admin-token")}>
        Admin login
      </button>
      <button onClick={() => logout()}>Logout</button>
    </>
  );
}

function renderAuth() {
  return render(
    <AuthProvider>
      <AuthControls />
    </AuthProvider>,
  );
}

describe("AuthContext lifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    mockNavigate = jest.fn();
    logoutSession.mockResolvedValue({ data: { message: "Logged out" } });
  });

  test("stores login state and requests backend revocation on logout", async () => {
    renderAuth();

    fireEvent.click(screen.getByRole("button", { name: "Login" }));
    expect(screen.getByTestId("access-token")).toHaveTextContent("token-1");
    expect(JSON.parse(localStorage.getItem("shortlyAuth"))).toMatchObject({
      accessToken: "token-1",
      user: { id: "user-1", role: "user" },
    });
    localStorage.setItem("user", JSON.stringify({ id: "user-1" }));
    localStorage.setItem("adminUser", JSON.stringify({ id: "admin-1" }));
    sessionStorage.setItem("user", JSON.stringify({ id: "user-1" }));
    sessionStorage.setItem("adminUser", JSON.stringify({ id: "admin-1" }));
    logoutSession.mockImplementationOnce(() => {
      expect(mockAuthCallbacks.getAccessToken()).toBeNull();
      expect(localStorage.getItem("shortlyAuth")).toBeNull();
      return Promise.resolve({ data: { message: "Logged out" } });
    });

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => expect(logoutSession).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId("access-token")).toHaveTextContent("none");
    expect(localStorage.getItem("shortlyAuth")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(localStorage.getItem("adminUser")).toBeNull();
    expect(sessionStorage.getItem("user")).toBeNull();
    expect(sessionStorage.getItem("adminUser")).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/select-login", {
      replace: true,
    });
  });

  test("clears auth and redirects to login after refresh failure", () => {
    renderAuth();
    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    act(() => {
      mockAuthCallbacks.onUnauthorized();
    });

    expect(mockNavigate).toHaveBeenCalledWith("/login", {
      replace: true,
      state: { expired: true },
    });
    expect(screen.getByTestId("access-token")).toHaveTextContent("none");
    expect(localStorage.getItem("shortlyAuth")).toBeNull();
  });

  test("returns administrators to the admin login screen after refresh failure", () => {
    renderAuth();
    fireEvent.click(screen.getByRole("button", { name: "Admin login" }));

    act(() => {
      mockAuthCallbacks.onUnauthorized();
    });

    expect(mockNavigate).toHaveBeenCalledWith("/admin-login", {
      replace: true,
      state: { expired: true },
    });
    expect(screen.getByTestId("access-token")).toHaveTextContent("none");
  });
});
