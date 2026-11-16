// frontend\src\components\shared\BillingBanner.jsx

import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

const TONES = {
	blue: "bg-blue-50 border-blue-200 text-blue-900",
	yellow: "bg-yellow-50 border-yellow-200 text-yellow-900",
	red: "bg-red-50 border-red-200 text-red-900",
};

/**
 * Banner shown above the page when the owner needs to act on billing.
 * Pass the notice from useBillingNotice().
 */
export default function BillingBanner({ notice }) {
	const navigate = useNavigate();

	if (!notice) return null;

	return (
		<div
			role="status"
			className={`mb-3 px-4 py-3 border rounded-lg flex flex-wrap items-center gap-3 ${TONES[notice.tone]}`}
		>
			<AlertTriangle className="w-5 h-5 flex-shrink-0" />
			<p className="text-sm flex-1 min-w-0">{notice.text}</p>
			<button
				type="button"
				onClick={() => navigate("/settings/billing")}
				className="px-3 py-1.5 text-sm font-medium bg-white border border-current rounded-lg hover:bg-gray-50"
			>
				{notice.action}
			</button>
		</div>
	);
}
