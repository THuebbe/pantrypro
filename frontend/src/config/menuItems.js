// /frontend/src/components/dashboard/layout/menuItems.js

import {
	LayoutDashboard,
	Package,
	Truck,
	ShoppingCart,
	BarChart3,
	Trash2,
	ChefHat,
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
			}, // 👈 NEW - operational action
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
			{ id: "waste-analysis", label: "Waste Analysis", path: "/reports/waste" }, // 👈 NEW - analytics
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
];
