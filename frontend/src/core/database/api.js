// /frontend/src/core/database/api.js

import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

const api = axios.create({
	baseURL: API_BASE,
	headers: {
		"Content-type": "application/json",
	},
});

// Track if we're currently refreshing to prevent infinite loops
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
	failedQueue.forEach((prom) => {
		if (error) {
			prom.reject(error);
		} else {
			prom.resolve(token);
		}
	});
	failedQueue = [];
};

// Request interceptor - add token to all requests
api.interceptors.request.use(
	(config) => {
		const token = localStorage.getItem("auth_token");
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}

		// If uploading FormData, let axios handle Content-Type
		if (config.data instanceof FormData) {
			config.headers["Content-Type"] = undefined;
		}

		return config;
	},
	(error) => {
		return Promise.reject(error);
	}
);

// Response interceptor - handle 401 errors with refresh attempt
api.interceptors.response.use(
	(response) => response,
	async (error) => {
		const originalRequest = error.config;

		// 402: the account is read-only until billing is sorted out. Take the
		// owner to the Billing screen, which explains why and how to fix it.
		if (
			error.response?.status === 402 &&
			error.response?.data?.code === "subscription_required" &&
			!window.location.pathname.startsWith("/settings/billing")
		) {
			window.location.assign("/settings/billing?locked=1");
			return Promise.reject(error);
		}

		// Only handle 401 errors
		if (error.response?.status !== 401) {
			return Promise.reject(error);
		}

		// Don't retry refresh endpoint or already retried requests
		if (originalRequest.url === "/auth/refresh" || originalRequest._retry) {
			// Clear tokens and redirect to login
			localStorage.removeItem("auth_token");
			localStorage.removeItem("refresh_token");
			localStorage.removeItem("last_activity");
			window.location.href = "/login";
			return Promise.reject(error);
		}

		// Check if user has been inactive - if so, logout immediately
		if (window.__isInactive && window.__isInactive()) {
			localStorage.removeItem("auth_token");
			localStorage.removeItem("refresh_token");
			localStorage.removeItem("last_activity");
			window.location.href = "/login";
			return Promise.reject(new Error("Session expired due to inactivity"));
		}

		// If already refreshing, queue this request
		if (isRefreshing) {
			return new Promise((resolve, reject) => {
				failedQueue.push({ resolve, reject });
			})
				.then((token) => {
					originalRequest.headers.Authorization = `Bearer ${token}`;
					return api(originalRequest);
				})
				.catch((err) => {
					return Promise.reject(err);
				});
		}

		originalRequest._retry = true;
		isRefreshing = true;

		try {
			// Use the refresh function from AuthContext
			if (window.__authRefresh) {
				const result = await window.__authRefresh();
				const newToken = result.accessToken;

				processQueue(null, newToken);

				// Retry the original request with new token
				originalRequest.headers.Authorization = `Bearer ${newToken}`;
				return api(originalRequest);
			} else {
				throw new Error("Auth refresh not available");
			}
		} catch (refreshError) {
			processQueue(refreshError, null);

			// Refresh failed - clear tokens and redirect
			localStorage.removeItem("auth_token");
			localStorage.removeItem("refresh_token");
			localStorage.removeItem("last_activity");
			window.location.href = "/login";
			return Promise.reject(refreshError);
		} finally {
			isRefreshing = false;
		}
	}
);

export default api;
