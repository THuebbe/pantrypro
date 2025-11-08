// frontend\src\hooks\useWaste.js

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	fetchWasteReasons,
	fetchWasteCategories,
	removeStock,
} from "../services/wasteService";

/**
 * Query hook to fetch waste reasons for dropdowns
 */
export function useWasteReasons() {
	return useQuery({
		queryKey: ["waste", "reasons"],
		queryFn: fetchWasteReasons,
		staleTime: 1000 * 60 * 60, // Fresh for 1 hour (rarely changes)
	});
}

/**
 * Query hook to fetch waste categories
 */
export function useWasteCategories() {
	return useQuery({
		queryKey: ["waste", "categories"],
		queryFn: fetchWasteCategories,
		staleTime: 1000 * 60 * 60, // Fresh for 1 hour (rarely changes)
	});
}

/**
 * Mutation hook to remove stock (logs waste automatically)
 * Automatically invalidates relevant queries after success
 */
export function useRemoveStock() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data) => removeStock(data), // 👈 Pass data directly - it already has { items: [...] }
		onSuccess: () => {
			// Invalidate queries to trigger refetch
			queryClient.invalidateQueries({ queryKey: ["inventory"] });
			queryClient.invalidateQueries({ queryKey: ["metrics"] });
			queryClient.invalidateQueries({ queryKey: ["reports", "waste"] });
		},
	});
}
