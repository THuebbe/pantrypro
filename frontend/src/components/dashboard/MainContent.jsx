// /frontend/src/components/dashboard/MainContent.jsx

import { useLocation } from "react-router-dom";
import DashboardContent from "./content/DashboardContent";
import InventoryContent from "./content/InventoryContent";
import ReceivingContent from "./content/ReceivingContent";
import OrdersContent from "./content/OrdersContent";
import ReportsContent from "./content/ReportsContent";
import MenuItemsContent from "./content/MenuItemsContent";
import RecipeBuilder from "../menu-items/RecipeBuilder";

export default function MainContent() {
	const location = useLocation();
	const pathParts = location.pathname.split("/").filter(Boolean);
	const section = pathParts[0] || "dashboard";
	const subsection = pathParts[1];
	const thirdPart = pathParts[2];

	// Handle recipe builder FIRST: /menu-items/:id/recipe
	if (section === "menu-items" && subsection && thirdPart === "recipe") {
		return <RecipeBuilder />;
	}

	// Then handle other routes
	switch (section) {
		case "inventory":
			return <InventoryContent subsection={subsection} />;
		case "menu-items":
			return <MenuItemsContent subsection={subsection} />;
		case "receiving":
			return <ReceivingContent subsection={subsection} />;
		case "orders":
			return <OrdersContent subsection={subsection} />;
		case "reports":
			return <ReportsContent subsection={subsection} />;
		case "dashboard":
		default:
			return <DashboardContent />;
	}
}
