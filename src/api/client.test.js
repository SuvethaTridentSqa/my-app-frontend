/* global jest */

jest.mock("axios", () => {
  const instances = [];
  const create = jest.fn(() => {
    const instance = jest.fn();
    instance.interceptors = {
      request: {
        use: jest.fn((handler) => {
          instance.requestInterceptor = handler;
        }),
      },
      response: {
        use: jest.fn((onSuccess, onError) => {
          instance.responseInterceptor = onError;
        }),
      },
    };
    instance.post = jest.fn();
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
    refreshClient.post.mockResolvedValue({
      data: { token: "new-access-token" },
    });
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
        resolveRefresh = resolve;
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
    resolveRefresh({ data: { token: "new-access-token" } });
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
