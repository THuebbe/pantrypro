// /frontend/src/hooks/useMetrics.js

import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { fetchMetrics } from "../services/metricsService";
import { fetchWasteMetrics } from "../services/reportsService";
import { metricsBySection } from "../config/dashboardMetrics";

/**
 * Which metrics a page loads. Pages without metrics of their own
 * (Settings, Sales, Recipes) show the dashboard metrics, matching
 * getMetricsForRoute, so they load the dashboard numbers too.
 */
export function metricsSectionFor(pathname) {
	const section = pathname.split("/")[1] || "dashboard";

	if (section === "waste") return "waste";

	return metricsBySection[`/${section}`] ? section : "dashboard";
}

export function useMetrics() {
	const location = useLocation();

	const section = metricsSectionFor(location.pathname);

	return useQuery({
		queryKey: ["metrics", section],
		queryFn: async () => {
			// Special handling for waste section - use dedicated waste metrics endpoint
			if (section === "waste") {
				return await fetchWasteMetrics("week");
			}

			// Use regular metrics endpoint for all sections (including vendors)
			return await fetchMetrics(section);
		},
		staleTime: 1000 * 60 * 2,
		refetchInterval: 1000 * 60 * 5,
		retry: 2,
	});
}
