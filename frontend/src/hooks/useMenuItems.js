// frontend\src\hooks\useMenuItems.js

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	fetchMenuItems,
	fetchMenuCategories,
	fetchMenuItem,
	createMenuItem,
	updateMenuItem,
	deleteMenuItem,
} from "../services/menuItemsService";

/**
 * Get all menu items
 */
export function useMenuItems(filters = {}) {
	return useQuery({
		queryKey: ["menu-items", filters],
		queryFn: () => fetchMenuItems(filters),
		staleTime: 1000 * 60 * 2, // Fresh for 2 minutes
	});
}

/**
 * Get menu categories
 */
export function useMenuCategories() {
	return useQuery({
		queryKey: ["menu-categories"],
		queryFn: fetchMenuCategories,
		staleTime: 1000 * 60 * 30, // Fresh for 30 minutes
	});
}

/**
 * Get single menu item
 */
export function useMenuItem(id) {
	return useQuery({
		queryKey: ["menu-item", id],
		queryFn: () => fetchMenuItem(id),
		enabled: !!id,
		staleTime: 1000 * 60 * 2,
	});
}

/**
 * Create menu item mutation
 */
export function useCreateMenuItem() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: createMenuItem,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["menu-items"] });
			queryClient.invalidateQueries({ queryKey: ["menu-categories"] });
		},
	});
}

/**
 * Update menu item mutation
 */
export function useUpdateMenuItem() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ id, data }) => updateMenuItem(id, data),
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ["menu-items"] });
			queryClient.invalidateQueries({ queryKey: ["menu-item", variables.id] });
		},
	});
}

/**
 * Delete menu item mutation
 */
export function useDeleteMenuItem() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: deleteMenuItem,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["menu-items"] });
		},
	});
}
