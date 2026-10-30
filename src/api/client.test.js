/* global jest */

jest.mock("axios", () => {
  const instances = [];
  const create = jest.fn((config) => {
    const instance = jest.fn();
    instance.interceptors = {
      request: {
        use: jest.fn((handler) => {
          instance.requestInterceptor = handler;
        }),
      },
      response: {
        use: jest.fn((onSuccess, onError) => {
          instance.responseSuccessInterceptor = onSuccess;
          instance.responseInterceptor = onError;
        }),
      },
    };
    instance.post = jest.fn();
    instance.config = config;
    instances.push(instance);
    return instance;
  });

  return {
    __esModule: true,
    default: { create, instances },
    instances,
  };
});

import axios from "axios";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from "@jest/globals";
import { logoutSession, registerAuthCallbacks } from "./client.js";

const [apiInstance, refreshClient] = axios.instances;

describe("authenticated API client", () => {
  let callbacks;
  let unregister;

  beforeEach(() => {
    jest.clearAllMocks();
    callbacks = {
      getAccessToken: jest.fn(() => "expired-access-token"),
      setAccessToken: jest.fn(),
      onUnauthorized: jest.fn(),
    };
    unregister = registerAuthCallbacks(callbacks);
  });

  afterEach(() => {
    unregister();
  });

  test("uses the versioned API base URL for both clients", () => {
    expect(apiInstance.config.baseURL).toBe("http://localhost:5000/api/v1");
    expect(refreshClient.config.baseURL).toBe(apiInstance.config.baseURL);
  });

  test("unwraps the response payload and keeps envelope metadata", () => {
    const response = {
      data: {
        success: true,
        message: "Request completed successfully",
        data: { items: [{ id: "item-1" }] },
        meta: { nextPage: 2 },
      },
      status: 200,
    };

    expect(apiInstance.responseSuccessInterceptor(response)).toBe(response);
    expect(response.data).toEqual({ items: [{ id: "item-1" }] });
    expect(response.success).toBe(true);
    expect(response.meta).toEqual({ nextPage: 2 });
    expect(response.message).toBe("Request completed successfully");
  });

  test("leaves non-envelope responses unchanged", () => {
    const response = { data: { token: "token-1" }, status: 200 };

    expect(apiInstance.responseSuccessInterceptor(response)).toBe(response);
    expect(response.data).toEqual({ token: "token-1" });
  });

  test("normalizes backend field errors and preserves HTTP status", async () => {
    const error = {
      response: {
        status: 422,
        data: {
          success: false,
          message: "Validation failed",
          data: null,
          meta: { errors: [{ field: "email", message: "Email is invalid" }] },
        },
      },
    };

    await expect(apiInstance.responseInterceptor(error)).rejects.toBe(error);
    expect(error.status).toBe(422);
    expect(error.message).toBe("Validation failed: email: Email is invalid");
    expect(error.response.data.message).toBe(error.message);
    expect(error.validationErrors).toEqual([
      { field: "email", message: "Email is invalid" },
    ]);
  });

  test("does not expose server error details in the user-facing message", async () => {
    const error = {
      response: {
        status: 500,
        data: {
          success: false,
          message: "Database connection string leaked",
          data: null,
          meta: { errors: [] },
        },
      },
    };

    await expect(apiInstance.responseInterceptor(error)).rejects.toBe(error);
    expect(error.response.data.message).toBe(
      "The server could not complete the request. Please try again.",
    );
    expect(error.backendMessage).toBe("Database connection string leaked");
  });

  test("normalizes network failures", async () => {
    const error = new Error("Network Error");

    await expect(apiInstance.responseInterceptor(error)).rejects.toBe(error);
    expect(error.status).toBeNull();
    expect(error.message).toBe(
      "Unable to reach the server. Please check your connection.",
    );
  });

  test("attaches the current access token to protected requests", async () => {
    const config = await apiInstance.requestInterceptor({ headers: {} });

    expect(config.headers.Authorization).toBe("Bearer expired-access-token");
  });

  test("refreshes once, stores the returned token, and retries the request", async () => {
    const request = {
      url: "/urls",
      headers: { Authorization: "Bearer expired-access-token" },
    };
    const unauthorized = {
      config: request,
      response: { status: 401 },
    };
    refreshClient.post.mockImplementation(() =>
      Promise.resolve(
        refreshClient.responseSuccessInterceptor({
          data: {
            success: true,
            message: "Request completed successfully",
            data: { token: "new-access-token" },
            meta: null,
          },
        }),
      ),
    );
    apiInstance.mockResolvedValue({ data: "retried" });

    await expect(apiInstance.responseInterceptor(unauthorized)).resolves.toEqual(
      { data: "retried" },
    );

    expect(refreshClient.post).toHaveBeenCalledTimes(1);
    expect(refreshClient.post).toHaveBeenCalledWith("/auth/refresh");
    expect(callbacks.setAccessToken).toHaveBeenCalledWith("new-access-token");
    expect(apiInstance).toHaveBeenCalledTimes(1);
    expect(request.headers.Authorization).toBe("Bearer new-access-token");
    expect(request._retry).toBe(true);
  });

  test("shares one refresh request among simultaneous unauthorized requests", async () => {
    let resolveRefresh;
    refreshClient.post.mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = (response) =>
          resolve(refreshClient.responseSuccessInterceptor(response));
      }),
    );
    apiInstance.mockImplementation((config) =>
      Promise.resolve({ config }),
    );

    const first = apiInstance.responseInterceptor({
      config: {
        url: "/urls",
        headers: { Authorization: "Bearer expired-access-token" },
      },
      response: { status: 401 },
    });
    const second = apiInstance.responseInterceptor({
      config: {
        url: "/analytics",
        headers: { Authorization: "Bearer expired-access-token" },
      },
      response: { status: 401 },
    });

    expect(refreshClient.post).toHaveBeenCalledTimes(1);
    resolveRefresh({
      data: {
        success: true,
        message: "Request completed successfully",
        data: { token: "new-access-token" },
        meta: null,
      },
    });
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(apiInstance).toHaveBeenCalledTimes(2);
  });

  test("clears authentication through the registered handler when refresh fails", async () => {
    const refreshError = new Error("refresh failed");
    refreshClient.post.mockRejectedValue(refreshError);

    await expect(
      apiInstance.responseInterceptor({
        config: {
          url: "/urls",
          headers: { Authorization: "Bearer expired-access-token" },
        },
        response: { status: 401 },
      }),
    ).rejects.toBe(refreshError);

    expect(callbacks.onUnauthorized).toHaveBeenCalledTimes(1);
    expect(apiInstance).not.toHaveBeenCalled();
  });

  test("does not refresh or retry a retried request again", async () => {
    const unauthorized = {
      config: { url: "/urls", _retry: true },
      response: { status: 401 },
    };

    await expect(apiInstance.responseInterceptor(unauthorized)).rejects.toBe(
      unauthorized,
    );

    expect(refreshClient.post).not.toHaveBeenCalled();
    expect(apiInstance).not.toHaveBeenCalled();
    expect(callbacks.onUnauthorized).toHaveBeenCalledTimes(1);
  });

  test("logs out through the backend refresh-cookie endpoint", async () => {
    refreshClient.post.mockResolvedValue({ data: {} });

    await logoutSession();

    expect(refreshClient.post).toHaveBeenCalledWith("/auth/logout");
  });
});
