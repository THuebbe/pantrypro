// Settings routing component - handles all settings-related views
// Routes to specific settings components based on subsection

import { useNavigate } from "react-router-dom";
import IntegrationsSettings from "../../settings/IntegrationsSettings";
import POSSyncStatus from "../../settings/POSSyncStatus";
import BillingSettings from "../../settings/BillingSettings";
import { Settings, Plug, Bell, User, CreditCard } from "lucide-react";

export default function SettingsContent({ subsection, params }) {
	// Route to specific settings component based on subsection
	switch (subsection) {
		case "integrations":
			return <IntegrationsSettings params={params} />;
		case "billing":
			return <BillingSettings params={params} />;
		default:
			return <SettingsOverview />;
	}
}

// Settings Overview - shows when clicking main "Settings" menu item
function SettingsOverview() {
	return (
		<div className="bg-white rounded-lg border border-gray-200 p-6">
			<h2 className="text-2xl font-bold text-gray-900 mb-4">Settings</h2>
			<p className="text-gray-600 mb-6">
				Configure your restaurant settings, integrations, and preferences.
			</p>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
				<SettingsCard
					title="Integrations"
					description="Connect to POS systems and third-party services"
					icon={Plug}
					path="/settings/integrations"
					color="blue"
				/>
				<SettingsCard
					title="Billing"
					description="Your subscription, card and receipts"
					icon={CreditCard}
					path="/settings/billing"
					color="green"
				/>
			</div>

			{/* POS Sync Status */}
			<POSSyncStatus />
		</div>
	);
}

function SettingsCard({ title, description, icon: Icon, path, color = "blue" }) {
	const navigate = useNavigate();

	const colorClasses = {
		blue: "hover:border-blue-300 hover:shadow-blue-50",
		green: "hover:border-green-300 hover:shadow-green-50",
		purple: "hover:border-purple-300 hover:shadow-purple-50",
	};

	return (
		<button
			onClick={() => navigate(path)}
			className={`bg-white border border-gray-200 rounded-lg p-4 text-left transition-all hover:shadow-md ${colorClasses[color]}`}
		>
			<div className="flex items-start gap-3">
				<div className="flex-shrink-0">
					<Icon className="w-6 h-6 text-gray-600" />
				</div>
				<div className="flex-1 min-w-0">
					<h3 className="text-base font-semibold text-gray-900 mb-1">
						{title}
					</h3>
					<p className="text-sm text-gray-600">{description}</p>
				</div>
			</div>
		</button>
	);
}
