// /backend/src/jobs/salesProcessingJob.js

/**
 * Sales Processing Job
 *
 * Periodically syncs sales from POS and processes inventory deductions.
 * Uses polling (setInterval) initially; can be replaced with webhooks later.
 *
 * Usage:
 *   import { startSalesProcessingJob, stopSalesProcessingJob } from './jobs/salesProcessingJob.js';
 *   startSalesProcessingJob();  // Start the periodic job
 *   stopSalesProcessingJob();   // Stop it gracefully
 */

import { supabase } from "../services/supabase.js";
import { isEncrypted } from "../services/credentialVault.js";
import { syncSalesFromPOS } from "../services/salesDataService.js";
import { processUndeductedSales } from "../services/inventoryDeductionService.js";

// POS systems that syncSalesFromPOS can read sales from
const SYNC_SUPPORTED_POS = ["toast"];

/**
 * Check whether stored POS credentials are complete enough to try a sync
 * @param {object} stored - restaurants.pos_integration_data
 * @returns {boolean}
 */
export function hasUsableCredentials(stored) {
	if (!stored || typeof stored !== "object") return false;

	// Encrypted credentials were validated when they were saved.
	if (isEncrypted(stored)) return true;

	// Rows saved before encryption was added
	return Boolean(stored.restaurantGuid && stored.clientId && stored.clientSecret);
}

let syncIntervalId = null;
let isRunning = false;

// Default interval: 5 minutes (override with POS_SYNC_INTERVAL_MINUTES)
const DEFAULT_INTERVAL_MS =
	(Number(process.env.POS_SYNC_INTERVAL_MINUTES) || 5) * 60 * 1000;

// Each sync looks back a little before the last one so an order saved
// right at the boundary is not missed. Re-reading an order is harmless.
const SYNC_OVERLAP_MS = 2 * 60 * 1000;

/**
 * Start the sales processing job
 * @param {number} intervalMs - Polling interval in milliseconds (default: 15 min)
 */
export function startSalesProcessingJob(intervalMs = DEFAULT_INTERVAL_MS) {
	if (syncIntervalId) {
		console.log("[SalesJob] Already running, skipping start");
		return;
	}

	console.log(
		`[SalesJob] Starting sales processing job (interval: ${intervalMs / 1000}s)`
	);

	// Run immediately on start
	runSalesProcessingCycle();

	// Then run on interval
	syncIntervalId = setInterval(runSalesProcessingCycle, intervalMs);
}

/**
 * Stop the sales processing job
 */
export function stopSalesProcessingJob() {
	if (syncIntervalId) {
		clearInterval(syncIntervalId);
		syncIntervalId = null;
		console.log("[SalesJob] Stopped");
	}
}

/**
 * Run one cycle of sales processing
 */
async function runSalesProcessingCycle() {
	if (isRunning) {
		console.log("[SalesJob] Previous cycle still running, skipping");
		return;
	}

	isRunning = true;

	try {
		console.log(`[SalesJob] Starting cycle at ${new Date().toISOString()}`);

		// Get restaurants on a POS that sales sync supports
		const { data: configured, error } = await supabase
			.from("restaurants")
			.select("id, pos_system, last_pos_sync, pos_integration_data")
			.in("pos_system", SYNC_SUPPORTED_POS)
			.not("pos_integration_data", "is", null);

		if (error) {
			console.error("[SalesJob] Error fetching restaurants:", error);
			return;
		}

		// Leave out restaurants that picked a POS but never finished
		// connecting it, so they don't fail on every cycle.
		const restaurants = (configured || []).filter((restaurant) =>
			hasUsableCredentials(restaurant.pos_integration_data)
		);

		if (restaurants.length === 0) {
			console.log("[SalesJob] No restaurants with POS connected");
			return;
		}

		for (const restaurant of restaurants) {
			try {
				// Calculate sync window: from last sync to now
				const startDate = restaurant.last_pos_sync
					? new Date(
							new Date(restaurant.last_pos_sync).getTime() - SYNC_OVERLAP_MS
					  ).toISOString()
					: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Default: last 24 hours

				const endDate = new Date().toISOString();

				console.log(
					`[SalesJob] Syncing restaurant ${restaurant.id} (${restaurant.pos_system}) from ${startDate}`
				);

				// Step 1: Sync sales from POS
				const syncResult = await syncSalesFromPOS(
					restaurant.id,
					restaurant.pos_system,
					{ startDate, endDate }
				);

				console.log(
					`[SalesJob] Synced ${syncResult.stats.fetched} orders (${syncResult.stats.created} new, ${syncResult.stats.updated} updated)`
				);

				// Step 2: Process undeducted sales
				const deductionResult = await processUndeductedSales(restaurant.id);

				console.log(
					`[SalesJob] Processed ${deductionResult.processed} sales (${deductionResult.succeeded} succeeded, ${deductionResult.failed} failed)`
				);
			} catch (restaurantError) {
				console.error(
					`[SalesJob] Error processing restaurant ${restaurant.id}:`,
					restaurantError
				);
				// Continue to next restaurant
			}
		}

		console.log(`[SalesJob] Cycle complete at ${new Date().toISOString()}`);
	} catch (error) {
		console.error("[SalesJob] Error in processing cycle:", error);
	} finally {
		isRunning = false;
	}
}

/**
 * Manually trigger a sync for a specific restaurant
 * @param {string} restaurantId - Restaurant UUID
 * @param {string} posSystem - POS system type
 * @param {object} options - Sync options
 * @returns {Promise<Object>} Combined sync and deduction results
 */
export async function triggerManualSync(restaurantId, posSystem, options = {}) {
	try {
		// Sync sales
		const syncResult = await syncSalesFromPOS(restaurantId, posSystem, options);

		// Process deductions
		const deductionResult = await processUndeductedSales(restaurantId);

		return {
			success: true,
			sync: syncResult,
			deductions: deductionResult,
			timestamp: new Date().toISOString(),
		};
	} catch (error) {
		console.error("Error in manual sync:", error);
		throw error;
	}
}
