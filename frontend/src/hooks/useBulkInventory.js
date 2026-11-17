// frontend\src\hooks\useBulkInventory.js

import { useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../core/database/api";

/**
 * Check rows for a bulk add without saving
 */
export function usePreviewBulkAdd() {
	return useMutation({
		mutationFn: async (rows) => {
			const response = await api.post("/inventory/bulk/preview", { rows });
			return response.data;
		},
	});
}

/**
 * Add every row that checks out
 */
export function useCommitBulkAdd() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (rows) => {
			const response = await api.post("/inventory/bulk/add", { rows });
			return response.data;
		},
		onSuccess: (result) => {
			if (result.added > 0) {
				queryClient.invalidateQueries({ queryKey: ["inventory"] });
			}
		},
	});
}

/**
 * Save a count: set counted items to what was counted
 */
export function useSaveCount() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({ reason, note, counts }) => {
			const response = await api.post("/inventory/count", {
				reason,
				note,
				counts,
			});
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["inventory"] });
		},
	});
}
