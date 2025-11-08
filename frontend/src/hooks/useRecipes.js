// frontend\src\hooks\useRecipes.js

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	fetchRecipe,
	saveRecipe,
	addRecipeIngredient,
	updateRecipeIngredient,
	deleteRecipeIngredient,
	calculateRecipeCost,
	validateRecipe,
} from "../services/recipesService";

/**
 * Get recipe for menu item
 */
export function useRecipe(menuItemId) {
	return useQuery({
		queryKey: ["recipe", menuItemId],
		queryFn: () => fetchRecipe(menuItemId),
		enabled: !!menuItemId,
		staleTime: 1000 * 60 * 2,
	});
}

/**
 * Get recipe cost calculation
 */
export function useRecipeCost(menuItemId) {
	return useQuery({
		queryKey: ["recipe-cost", menuItemId],
		queryFn: () => calculateRecipeCost(menuItemId),
		enabled: !!menuItemId,
		staleTime: 1000 * 60, // Fresh for 1 minute
	});
}

/**
 * Validate recipe
 */
export function useRecipeValidation(menuItemId) {
	return useQuery({
		queryKey: ["recipe-validation", menuItemId],
		queryFn: () => validateRecipe(menuItemId),
		enabled: !!menuItemId,
		staleTime: 1000 * 30, // Fresh for 30 seconds
	});
}

/**
 * Save complete recipe mutation
 */
export function useSaveRecipe() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ menuItemId, ingredients }) =>
			saveRecipe(menuItemId, ingredients),
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["recipe", variables.menuItemId],
			});
			queryClient.invalidateQueries({
				queryKey: ["recipe-cost", variables.menuItemId],
			});
		},
	});
}

/**
 * Add ingredient to recipe mutation
 */
export function useAddRecipeIngredient() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ menuItemId, ingredient }) =>
			addRecipeIngredient(menuItemId, ingredient),
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["recipe", variables.menuItemId],
			});
			queryClient.invalidateQueries({
				queryKey: ["recipe-cost", variables.menuItemId],
			});
		},
	});
}

/**
 * Update recipe ingredient mutation
 */
export function useUpdateRecipeIngredient() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ recipeIngredientId, updates, menuItemId }) =>
			updateRecipeIngredient(recipeIngredientId, updates),
		onSuccess: (data, variables) => {
			if (variables.menuItemId) {
				queryClient.invalidateQueries({
					queryKey: ["recipe", variables.menuItemId],
				});
				queryClient.invalidateQueries({
					queryKey: ["recipe-cost", variables.menuItemId],
				});
			}
		},
	});
}

/**
 * Delete recipe ingredient mutation
 */
export function useDeleteRecipeIngredient() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ recipeIngredientId, menuItemId }) =>
			deleteRecipeIngredient(recipeIngredientId),
		onSuccess: (data, variables) => {
			if (variables.menuItemId) {
				queryClient.invalidateQueries({
					queryKey: ["recipe", variables.menuItemId],
				});
				queryClient.invalidateQueries({
					queryKey: ["recipe-cost", variables.menuItemId],
				});
			}
		},
	});
}
