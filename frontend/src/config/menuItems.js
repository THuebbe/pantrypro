// /frontend/src/components/dashboard/layout/menuItems.js

import {
	LayoutDashboard,
	Package,
	Truck,
	ShoppingCart,
	BarChart3,
	Trash2,
	ChefHat,
	Building2,
	Settings,
	DollarSign,
} from "lucide-react";

export const menuItems = [
	{
		id: "dashboard",
		label: "Dashboard",
		icon: LayoutDashboard,
		path: "/dashboard",
		subItems: [],
	},
	{
		id: "inventory",
		label: "Inventory",
		icon: Package,
		path: "/inventory",
		subItems: [
			{ id: "all-items", label: "All Ingredients", path: "/inventory" },
			{ id: "low-stock", label: "Low Stock", path: "/inventory/low-stock" },
			{ id: "expiring", label: "Expiring Soon", path: "/inventory/expiring" },
			{
				id: "remove-waste",
				label: "Remove/Log Waste",
				path: "/inventory/remove",
			},
		],
	},
	{
		id: "menu-items",
		label: "Menu Items",
		icon: ChefHat,
		path: "/menu-items",
		subItems: [],
	},
	{
		id: "receiving",
		label: "Receiving",
		icon: Truck,
		path: "/receiving",
		subItems: [
			{
				id: "receive-shipment",
				label: "Receive Shipment",
				path: "/receiving/new",
			},
			{
				id: "receiving-history",
				label: "Receiving History",
				path: "/receiving/history",
			},
		],
	},
	{
		id: "orders",
		label: "Orders",
		icon: ShoppingCart,
		path: "/orders",
		subItems: [
			{ id: "all-orders", label: "All Orders", path: "/orders" },
			{ id: "create-order", label: "Create Order", path: "/orders/create" },
			{ id: "pending", label: "Pending Orders", path: "/orders/pending" },
		],
	},
	{
		id: "vendors",
		label: "Vendors",
		icon: Building2,
		path: "/vendors",
		subItems: [
			{ id: "all-vendors", label: "All Vendors", path: "/vendors" },
			{ id: "vendor-metrics", label: "Vendor Metrics", path: "/vendors/metrics" },
			{ id: "add-vendor", label: "Add Vendor", path: "/vendors/add" },
		],
	},
	{
		id: "reports",
		label: "Reports",
		icon: BarChart3,
		path: "/reports",
		subItems: [
			{
				id: "dashboard-overview",
				label: "Dashboard Overview",
				path: "/reports/dashboard",
			},
			{ id: "waste-analysis", label: "Waste Analysis", path: "/reports/waste" },
			{
				id: "food-cost",
				label: "Food Cost Analysis",
				path: "/reports/food-cost",
			},
			{
				id: "inventory-health",
				label: "Inventory Health",
				path: "/reports/inventory-health",
			},
			{
				id: "order-performance",
				label: "Order Performance",
				path: "/reports/order-performance",
			},
		],
	},
	{
		id: "sales",
		label: "Sales",
		icon: DollarSign,
		path: "/sales",
		subItems: [
			{ id: "today-sales", label: "Today's Sales", path: "/sales/today" },
			{ id: "sales-history", label: "Sales History", path: "/sales/history" },
			{ id: "inventory-impact", label: "Inventory Impact", path: "/sales/impact" },
		],
	},
	{
		id: "settings",
		label: "Settings",
		icon: Settings,
		path: "/settings",
		subItems: [
			{ id: "integrations", label: "Integrations", path: "/settings/integrations" },
			{ id: "billing", label: "Billing", path: "/settings/billing" },
		],
	},
];
