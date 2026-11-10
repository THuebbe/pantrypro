// /backend/src/index.js

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import testRoutes from "./routes/test.js";
import dashboardRoutes from "./routes/dashboard.js";
import inventoryRoutes from "./routes/inventory.js";
import businessRoutes from "./routes/business.js";
import metricsRoutes from "./routes/metrics.js";
import authRoutes from "./routes/auth.js";
import ordersRoutes from "./routes/orders.js";
import restaurantOrdersRoutes from "./routes/restaurantOrders.js";
import reportsRoutes from "./routes/reports.js";
import wasteRoutes from "./routes/waste.js";
import menuItemRoutes from "./routes/menuItemRoutes.js";
import recipeRoutes from "./routes/recipeRoutes.js";
import quizRoutes from "./routes/quizRoutes.js";
import vendorsRoutes from "./routes/vendors.js";
import paymentTermsRoutes from "./routes/paymentTerms.js";
import vendorAddressesRoutes from "./routes/vendorAddresses.js";
import vendorContactsRoutes from "./routes/vendorContacts.js";
import vendorPaymentRoutes from "./routes/vendorPayment.js";
import vendorDocumentsRoutes from "./routes/vendorDocuments.js";
import vendorScorecardsRoutes from "./routes/vendorScorecards.js";
import vendorInvoicesRoutes from "./routes/vendorInvoices.js";
import vendorPaymentsAPRoutes from "./routes/vendorPaymentsAP.js";
import posImportRoutes from "./routes/posImportRoutes.js";
import salesRoutes from "./routes/salesRoutes.js";
import deductionRoutes from "./routes/deductionRoutes.js";
import { startSalesProcessingJob } from "./jobs/salesProcessingJob.js";
// Load environment variables

// Initialize Express app
const app = express();

// Middleware
app.use(
	cors({
		origin: [
			"http://localhost:5173", // Local dev
			"http://localhost:5174", // Local dev alt port
			"https://pantrypro-six.vercel.app", // Production
		],
		credentials: true,
	})
);
app.use(express.json());

// Test route to make sure server is working
app.get("/", (req, res) => {
	res.json({
		message: "🚀 Restaurant Inventory API is running!",
		status: "healthy",
		timestamp: new Date().toISOString(),
	});
});

// Use routes (uncomment when you create the files)
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/metrics", metricsRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/business", businessRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/orders", restaurantOrdersRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/waste", wasteRoutes);
app.use("/api/menu-items", menuItemRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/vendors", vendorsRoutes);
app.use("/api/payment-terms", paymentTermsRoutes);
app.use("/api/vendors", vendorAddressesRoutes);
app.use("/api/vendors", vendorContactsRoutes);
app.use("/api/vendors", vendorPaymentRoutes);
app.use("/api/vendors", vendorDocumentsRoutes);
app.use("/api/vendors", vendorScorecardsRoutes);
app.use("/api/vendors", vendorInvoicesRoutes);
app.use("/api/vendors", vendorPaymentsAPRoutes);
app.use("/api/pos-import", posImportRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/deductions", deductionRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
	console.error("Error:", err);
	res.status(500).json({
		error: err.message,
		stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
	});
});

// 404 handler for undefined routes
app.use((req, res) => {
	res.status(404).json({
		error: "Route not found",
		path: req.path,
	});
});

// Start server
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
	console.log(`🚀 Server running on http://localhost:${PORT}`);
	console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
	console.log(
		`🗄️  Database: ${process.env.SUPABASE_URL ? "Connected" : "Not configured"}`
	);
	console.log(`🔄 Server started at: ${new Date().toISOString()}`);
	console.log(`⚠️  TESTING: If you see this, nodemon reloaded the server`);

	// Pull sales from connected POS systems and deduct inventory on a timer.
	// Set POS_SYNC_ENABLED=false to turn this off (e.g. on a second instance).
	if (process.env.POS_SYNC_ENABLED !== "false") {
		startSalesProcessingJob();
	}
});
