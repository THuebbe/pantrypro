// /frontend/src/core/auth/AuthContext.jsx

import { createContext, useState, useEffect, useCallback, useRef } from "react";
import api from "../database/api";
import {
	initActivityListeners,
	clearActivity,
	isInactive,
	updateActivity,
} from "./activityTracker";

const AuthContext = createContext();

// Token storage keys
const ACCESS_TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";

export function AuthProvider({ children }) {
	const [user, setUser] = useState(null);
	const [loading, setLoading] = useState(true);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const refreshPromiseRef = useRef(null);
	const activityCleanupRef = useRef(null);

	// Store tokens helper
	const storeTokens = useCallback((accessToken, refreshToken) => {
		localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
		if (refreshToken) {
			localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
		}
	}, []);

	// Clear tokens helper
	const clearTokens = useCallback(() => {
		localStorage.removeItem(ACCESS_TOKEN_KEY);
		localStorage.removeItem(REFRESH_TOKEN_KEY);
		clearActivity();
	}, []);

	// Get refresh token
	const getRefreshToken = useCallback(() => {
		return localStorage.getItem(REFRESH_TOKEN_KEY);
	}, []);

	// Refresh tokens - with deduplication to prevent race conditions
	const refreshTokens = useCallback(async () => {
		// If already refreshing, return the existing promise
		if (refreshPromiseRef.current) {
			return refreshPromiseRef.current;
		}

		const refreshToken = getRefreshToken();
		if (!refreshToken) {
			throw new Error("No refresh token available");
		}

		// Check if user has been inactive - if so, don't refresh
		if (isInactive()) {
			throw new Error("Session expired due to inactivity");
		}

		setIsRefreshing(true);

		refreshPromiseRef.current = api
			.post("/auth/refresh", { refreshToken })
			.then((response) => {
				storeTokens(response.data.accessToken, response.data.refreshToken);
				setUser(response.data.userDetails);
				updateActivity(); // Reset activity on successful refresh
				return response.data;
			})
			.finally(() => {
				setIsRefreshing(false);
				refreshPromiseRef.current = null;
			});

		return refreshPromiseRef.current;
	}, [getRefreshToken, storeTokens]);

	// Fetch current user
	const fetchCurrentUser = useCallback(async () => {
		const response = await api.get("/auth/me");
		setUser(response.data.userDetails);
	}, []);

	// Check if user is logged in on mount
	useEffect(() => {
		const initAuth = async () => {
			const token = localStorage.getItem(ACCESS_TOKEN_KEY);
			const refreshToken = getRefreshToken();

			if (!token && !refreshToken) {
				setLoading(false);
				return;
			}

			// Check for inactivity before attempting to validate/refresh
			if (isInactive()) {
				clearTokens();
				setLoading(false);
				return;
			}

			try {
				// Try to fetch current user with existing token
				const response = await api.get("/auth/me");
				setUser(response.data.userDetails);
				updateActivity();
			} catch (error) {
				// If token is invalid, try to refresh
				if (refreshToken) {
					try {
						await refreshTokens();
					} catch (refreshError) {
						console.error("Failed to refresh session:", refreshError);
						clearTokens();
					}
				} else {
					clearTokens();
				}
			} finally {
				setLoading(false);
			}
		};

		initAuth();
	}, [clearTokens, getRefreshToken, refreshTokens]);

	// Set up activity listeners when user is authenticated
	useEffect(() => {
		if (user) {
			activityCleanupRef.current = initActivityListeners();
		}

		return () => {
			if (activityCleanupRef.current) {
				activityCleanupRef.current();
				activityCleanupRef.current = null;
			}
		};
	}, [user]);

	// Expose refresh function for api interceptor
	useEffect(() => {
		// Attach to window for api.js interceptor access
		window.__authRefresh = refreshTokens;
		window.__isInactive = isInactive;

		return () => {
			delete window.__authRefresh;
			delete window.__isInactive;
		};
	}, [refreshTokens]);

	// Sign in with a session the server made for this browser when sign-up
	// finished (see /signup/complete). No password involved.
	const acceptSession = useCallback(
		(session) => {
			storeTokens(session.accessToken, session.refreshToken);
			setUser(session.userDetails);
			updateActivity();
		},
		[storeTokens]
	);

	const createBusiness = async (businessData) => {
		const response = await api.post("/business/create", businessData);
		// Refresh user data to get updated businessId
		await fetchCurrentUser();
		return response.data;
	};

	const login = async (email, password) => {
		const response = await api.post("/auth/login", { email, password });
		storeTokens(response.data.accessToken, response.data.refreshToken);
		setUser(response.data.userDetails);
		updateActivity();
		return response.data;
	};

	const logout = async () => {
		try {
			await api.post("/auth/logout");
		} catch (error) {
			console.error("Logout error:", error);
		} finally {
			clearTokens();
			setUser(null);
		}
	};

	const value = {
		user,
		loading,
		isRefreshing,
		acceptSession,
		createBusiness,
		login,
		logout,
		refreshTokens,
		isAuthenticated: !!user,
	};

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };
