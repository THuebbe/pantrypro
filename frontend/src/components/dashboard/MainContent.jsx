// /frontend/src/components/dashboard/MainContent.jsx

import { useLocation } from "react-router-dom";
import DashboardContent from "./content/DashboardContent";
import InventoryContent from "./content/InventoryContent";
import ReceivingContent from "./content/ReceivingContent";
import OrdersContent from "./content/OrdersContent";
import ReportsContent from "./content/ReportsContent";
import MenuItemsContent from "./content/MenuItemsContent";
import RecipeBuilder from "../menu-items/RecipeBuilder";
import VendorsContent from "../vendor-erp/VendorsContent";
import RecipesContent from "./content/RecipesContent";
import SettingsContent from "./content/SettingsContent";
import SalesContent from "./content/SalesContent";
import BillingBanner from "../shared/BillingBanner";
import { useBillingNotice } from "../../hooks/useBilling";

export default function MainContent() {
	const notice = useBillingNotice();

	// Nearly always there is nothing to show, and the page renders exactly
	// as before. The wrapper only exists while a billing notice is up.
	if (!notice) return <MainContentBody />;

	return (
		<div className="h-full flex flex-col">
			<BillingBanner notice={notice} />
			<div className="flex-1 min-h-0">
				<MainContentBody />
			</div>
		</div>
	);
}

function MainContentBody() {
	const location = useLocation();
	const pathParts = location.pathname.split("/").filter(Boolean);

	// Handle /dashboard prefix in URLs
	const offset = pathParts[0] === "dashboard" ? 1 : 0;
	const section = pathParts[offset] || "dashboard";
	const subsection = pathParts[offset + 1];
	const thirdPart = pathParts[offset + 2];
	const fourthPart = pathParts[offset + 3];

	// Parse query parameters
	const searchParams = new URLSearchParams(location.search);
	const queryParams = Object.fromEntries(searchParams.entries());

	// Build params object for components that need route params
	const params = {
		...queryParams,
		// For routes like /dashboard/orders/edit-po/:id, extract the id from path
		...(thirdPart && { poId: thirdPart }),
	};

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
			return <ReceivingContent subsection={subsection} params={params} />;
		case "orders":
			return (
				<OrdersContent
					subsection={subsection}
					params={params}
				/>
			);
		case "vendors":
			return (
				<VendorsContent
					subsection={subsection}
					params={params}
				/>
			);
		case "reports":
			return <ReportsContent subsection={subsection} />;
		case "recipes":
			return <RecipesContent subsection={subsection} />;
		case "settings":
			return <SettingsContent subsection={subsection} params={params} />;
		case "sales":
			return <SalesContent subsection={subsection} params={params} />;
		case "dashboard":
		default:
			return <DashboardContent />;
	}
}
