// Toast POS Integration - Configuration and connection management

import { useState } from "react";
import {
	usePOSVerify,
	usePOSSaveCredentials,
	usePOSImportPreview,
} from "../../hooks/usePOSImport";
import {
	ArrowLeft,
	CheckCircle,
	XCircle,
	Loader2,
	ExternalLink,
	AlertCircle,
	Eye,
	EyeOff,
	RefreshCw,
	BookOpen,
} from "lucide-react";

export default function ToastIntegration({ onBack, onConnectionChange, onStartPreview }) {
	const [credentials, setCredentials] = useState({
		restaurantGuid: "",
		clientId: "",
		clientSecret: "",
		apiUrl: "https://ws-api.toasttab.com",
	});
	const [showSecret, setShowSecret] = useState(false);
	const [showGuide, setShowGuide] = useState(false);
	const [connectionStatus, setConnectionStatus] = useState(null);
	const [connectionError, setConnectionError] = useState("");

	const verifyMutation = usePOSVerify();
	const saveCredentialsMutation = usePOSSaveCredentials();
	const previewQuery = usePOSImportPreview("toast", connectionStatus === "connected");

	const handleInputChange = (field, value) => {
		setCredentials((prev) => ({ ...prev, [field]: value }));
		setConnectionStatus(null);
		setConnectionError("");
	};

	const handleTestConnection = async () => {
		if (!credentials.restaurantGuid || !credentials.clientId || !credentials.clientSecret) {
			setConnectionStatus("missing_fields");
			return;
		}

		try {
			// First save credentials, then verify
			await saveCredentialsMutation.mutateAsync({
				posSystem: "toast",
				credentials: {
					restaurantGuid: credentials.restaurantGuid,
					clientId: credentials.clientId,
					clientSecret: credentials.clientSecret,
					apiUrl: credentials.apiUrl,
				},
			});

			const result = await verifyMutation.mutateAsync({ posSystem: "toast" });

			if (result.connected) {
				setConnectionStatus("connected");
				onConnectionChange?.(true);
			} else {
				setConnectionStatus("failed");
				setConnectionError(result.error || "");
				onConnectionChange?.(false);
			}
		} catch (error) {
			console.error("Connection test failed:", error);
			setConnectionStatus("error");
			setConnectionError(error.response?.data?.error || "");
			onConnectionChange?.(false);
		}
	};

	const isLoading = verifyMutation.isPending || saveCredentialsMutation.isPending;

	return (
		<div className="bg-white rounded-lg border border-gray-200 p-6">
			{/* Header */}
			<div className="flex items-center gap-4 mb-6">
				<button
					onClick={onBack}
					className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
				>
					<ArrowLeft className="w-5 h-5 text-gray-600" />
				</button>
				<div className="flex items-center gap-3">
					<div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
						<span className="text-xl font-bold text-orange-600">T</span>
					</div>
					<div>
						<h2 className="text-xl font-bold text-gray-900">Toast POS</h2>
						<p className="text-sm text-gray-600">
							Connect to sync menus and track sales
						</p>
					</div>
				</div>
			</div>

			{/* Setup Guide Toggle */}
			<button
				onClick={() => setShowGuide(!showGuide)}
				className="w-full flex items-center justify-between p-4 mb-6 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
			>
				<div className="flex items-center gap-3">
					<BookOpen className="w-5 h-5 text-blue-600" />
					<span className="font-medium text-blue-900">
						How to get Toast API credentials
					</span>
				</div>
				<span className="text-blue-600">{showGuide ? "Hide" : "Show"}</span>
			</button>

			{/* Setup Guide Content */}
			{showGuide && (
				<div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
					<h3 className="font-semibold text-gray-900 mb-3">
						Getting Started with Toast Integration
					</h3>
					<ol className="space-y-4 text-sm text-gray-700">
						<li className="flex gap-3">
							<span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">
								1
							</span>
							<div>
								<p className="font-medium">Open Toast API access in Toast Web</p>
								<p className="text-gray-600 mt-1">
									Sign in to Toast Web and go to{" "}
									<strong>
										Integrations &gt; Toast API access &gt; Manage credentials
									</strong>
									. You need the <strong>8.4 Manage Integrations</strong>{" "}
									permission, and your location needs Restaurant Management
									Suite Essentials or higher.
								</p>
							</div>
						</li>
						<li className="flex gap-3">
							<span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">
								2
							</span>
							<div>
								<p className="font-medium">Create read-only credentials</p>
								<p className="text-gray-600 mt-1">
									Open the <strong>Create new credentials</strong> menu and
									choose <strong>Standard API</strong>. Name the credentials
									"PantryPro" and choose your location. Select these
									permissions (scopes): <strong>orders:read</strong>,{" "}
									<strong>menus:read</strong> and{" "}
									<strong>restaurants:read</strong>. PantryPro can read your
									sales and menu. It cannot change anything in Toast.
								</p>
							</div>
						</li>
						<li className="flex gap-3">
							<span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">
								3
							</span>
							<div>
								<p className="font-medium">Copy the Client ID and Client Secret</p>
								<p className="text-gray-600 mt-1">
									Select <strong>Confirm</strong>, then copy both values from
									the Credentials page into the fields below. They are
									encrypted before PantryPro stores them.
								</p>
							</div>
						</li>
						<li className="flex gap-3">
							<span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">
								4
							</span>
							<div>
								<p className="font-medium">Find your Restaurant GUID</p>
								<p className="text-gray-600 mt-1">
									Toast emails the GUID for each location when the credentials
									are activated. Toast Support can also provide it.
								</p>
							</div>
						</li>
					</ol>
					<div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
						<div className="flex items-start gap-2">
							<AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
							<p className="text-sm text-amber-800">
								<strong>Need more detail?</strong> See Toast's guide to{" "}
								<a
									href="https://doc.toasttab.com/doc/devguide/devApiAccessCredentials.html"
									target="_blank"
									rel="noopener noreferrer"
									className="underline inline-flex items-center gap-1"
								>
									Standard API access credentials
									<ExternalLink className="w-3 h-3" />
								</a>
								.
							</p>
						</div>
					</div>
				</div>
			)}

			{/* Credentials Form */}
			<div className="space-y-4 mb-6">
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-1">
						Restaurant GUID
					</label>
					<input
						type="text"
						value={credentials.restaurantGuid}
						onChange={(e) => handleInputChange("restaurantGuid", e.target.value)}
						placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
						className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
					/>
					<p className="mt-1 text-xs text-gray-500">
						Emailed by Toast when your API credentials are activated
					</p>
				</div>

				<div>
					<label className="block text-sm font-medium text-gray-700 mb-1">
						Client ID
					</label>
					<input
						type="text"
						value={credentials.clientId}
						onChange={(e) => handleInputChange("clientId", e.target.value)}
						placeholder="Your Toast API Client ID"
						className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
					/>
				</div>

				<div>
					<label className="block text-sm font-medium text-gray-700 mb-1">
						Client Secret
					</label>
					<div className="relative">
						<input
							type={showSecret ? "text" : "password"}
							value={credentials.clientSecret}
							onChange={(e) => handleInputChange("clientSecret", e.target.value)}
							placeholder="Your Toast API Client Secret"
							className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
						/>
						<button
							type="button"
							onClick={() => setShowSecret(!showSecret)}
							className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
						>
							{showSecret ? (
								<EyeOff className="w-4 h-4" />
							) : (
								<Eye className="w-4 h-4" />
							)}
						</button>
					</div>
				</div>

			</div>

			{/* Connection Status */}
			{connectionStatus && (
				<div
					className={`mb-6 p-4 rounded-lg border ${
						connectionStatus === "connected"
							? "bg-green-50 border-green-200"
							: connectionStatus === "missing_fields"
							? "bg-amber-50 border-amber-200"
							: "bg-red-50 border-red-200"
					}`}
				>
					<div className="flex items-center gap-3">
						{connectionStatus === "connected" ? (
							<CheckCircle className="w-5 h-5 text-green-600" />
						) : connectionStatus === "missing_fields" ? (
							<AlertCircle className="w-5 h-5 text-amber-600" />
						) : (
							<XCircle className="w-5 h-5 text-red-600" />
						)}
						<div>
							<p
								className={`font-medium ${
									connectionStatus === "connected"
										? "text-green-800"
										: connectionStatus === "missing_fields"
										? "text-amber-800"
										: "text-red-800"
								}`}
							>
								{connectionStatus === "connected"
									? "Connected Successfully!"
									: connectionStatus === "missing_fields"
									? "Please fill in all required fields"
									: "Connection Failed"}
							</p>
							{connectionStatus === "connected" && previewQuery.data && (
								<p className="text-sm text-green-700 mt-1">
									Found {previewQuery.data.stats?.total || 0} menu items
									ready to import
								</p>
							)}
							{(connectionStatus === "failed" ||
								connectionStatus === "error") && (
								<p className="text-sm text-red-700 mt-1">
									{connectionError ||
										"Please check your credentials and try again"}
								</p>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Actions */}
			<div className="flex gap-3">
				<button
					onClick={handleTestConnection}
					disabled={isLoading}
					className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{isLoading ? (
						<>
							<Loader2 className="w-4 h-4 animate-spin" />
							Testing Connection...
						</>
					) : (
						<>
							<RefreshCw className="w-4 h-4" />
							Test Connection
						</>
					)}
				</button>
			</div>

			{/* Connected Actions */}
			{connectionStatus === "connected" && (
				<div className="mt-6 pt-6 border-t">
					<h3 className="font-semibold text-gray-900 mb-3">Next Steps</h3>
					<div className="space-y-2">
						<button
							onClick={onStartPreview}
							className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
						>
							<span className="text-gray-700">Import Menu Items from Toast</span>
							<span className="text-blue-600">Start Import &rarr;</span>
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
