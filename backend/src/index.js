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
import reportsRoutes from "./routes/reports.js";
import wasteRoutes from "./routes/waste.js";
import menuItemRoutes from "./routes/menuItemRoutes.js";
import recipeRoutes from "./routes/recipeRoutes.js";
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
app.use("/api/reports", reportsRoutes);
app.use("/api/waste", wasteRoutes);
app.use("/api/menu-items", menuItemRoutes);
app.use("/api/recipes", recipeRoutes);

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
});
