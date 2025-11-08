// frontend\src\components\dashboard\content\ReportsContent.jsx

export default function ReportsContent({ subsection }) {
	// Route to specific report based on subsection
	switch (subsection) {
		case "dashboard":
			return <DashboardOverviewReport />;
		case "waste":
			return <WasteAnalysisReport />;
		case "food-cost":
			return <FoodCostReport />;
		case "inventory-health":
			return <InventoryHealthReport />;
		case "order-performance":
			return <OrderPerformanceReport />;
		default:
			return <ReportsOverview />;
	}
}

// Reports Overview - shows when clicking main "Reports" menu item
function ReportsOverview() {
	return (
		<div className="bg-white rounded-lg border border-gray-200 p-6">
			<h2 className="text-2xl font-bold text-gray-900 mb-4">
				Reports Overview
			</h2>

			<div className="grid grid-cols-2 gap-4">
				<ReportCard
					title="Dashboard Overview"
					description="Key metrics and performance indicators"
					icon="📊"
					path="/reports/dashboard"
				/>
				<ReportCard
					title="Waste Analysis"
					description="Track waste trends and identify problem areas"
					icon="🗑️"
					path="/reports/waste"
				/>
				<ReportCard
					title="Food Cost Analysis"
					description="Monitor food cost percentages and variances"
					icon="💰"
					path="/reports/food-cost"
				/>
				<ReportCard
					title="Inventory Health"
					description="Stock levels, turnover, and reorder insights"
					icon="📦"
					path="/reports/inventory-health"
				/>
				<ReportCard
					title="Order Performance"
					description="Supplier reliability and order fulfillment"
					icon="📋"
					path="/reports/order-performance"
				/>
			</div>
		</div>
	);
}

function ReportCard({ title, description, icon, path }) {
	return (
		<a
			href={path}
			className="block p-6 bg-white border border-gray-200 rounded-lg hover:border-green-300 hover:shadow-md transition-all"
		>
			<div className="text-4xl mb-3">{icon}</div>
			<h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
			<p className="text-sm text-gray-600">{description}</p>
		</a>
	);
}

// Placeholder components for each report type
function DashboardOverviewReport() {
	return (
		<div className="bg-white rounded-lg border border-gray-200 p-6">
			<h2 className="text-2xl font-bold text-gray-900 mb-4">
				Dashboard Overview Report
			</h2>
			<div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
				<p className="text-blue-700">
					Comprehensive dashboard metrics coming soon!
				</p>
			</div>
		</div>
	);
}

function WasteAnalysisReport() {
	return (
		<div className="bg-white rounded-lg border border-gray-200 p-6">
			<h2 className="text-2xl font-bold text-gray-900 mb-4">Waste Analysis</h2>
			<div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
				<p className="text-red-700 font-semibold">
					Waste analytics coming soon!
				</p>
				<p className="text-sm text-red-600 mt-2">
					Waiting for backend waste reporting endpoints
				</p>
			</div>
		</div>
	);
}

function FoodCostReport() {
	return (
		<div className="bg-white rounded-lg border border-gray-200 p-6">
			<h2 className="text-2xl font-bold text-gray-900 mb-4">
				Food Cost Analysis
			</h2>
			<div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
				<p className="text-green-700">Food cost reporting coming soon!</p>
			</div>
		</div>
	);
}

function InventoryHealthReport() {
	return (
		<div className="bg-white rounded-lg border border-gray-200 p-6">
			<h2 className="text-2xl font-bold text-gray-900 mb-4">
				Inventory Health Report
			</h2>
			<div className="bg-purple-50 border border-purple-200 rounded-lg p-8 text-center">
				<p className="text-purple-700">Inventory health metrics coming soon!</p>
			</div>
		</div>
	);
}

function OrderPerformanceReport() {
	return (
		<div className="bg-white rounded-lg border border-gray-200 p-6">
			<h2 className="text-2xl font-bold text-gray-900 mb-4">
				Order Performance Report
			</h2>
			<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
				<p className="text-yellow-700">
					Order performance analytics coming soon!
				</p>
			</div>
		</div>
	);
}
