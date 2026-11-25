// /frontend/src/pages/RegisterBusiness.jsx

import { useState } from "react";
import { Check } from "lucide-react";

/**
 * Step 2 of sign-up: the restaurant. onSubmit does the work (start the
 * card checkout, or create the restaurant for someone already signed in);
 * an error it throws is shown on the form.
 */
export default function RegisterBusiness({ onSubmit, onBack, submitLabel = "Complete Setup" }) {
	const [formData, setFormData] = useState({
		name: "",
		domain: "",
		address: "",
		city: "",
	});
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState(null);

	const handleInputChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const getValidationState = (field, value) => {
		switch (field) {
			case "name":
				return value.length >= 2 ? "success" : null;
			case "city":
				return value.length >= 2 ? "success" : null;
			case "domain":
				// Domain is optional, but if provided should be valid-ish
				if (value.length === 0) return null;
				return /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$/.test(
					value
				)
					? "success"
					: "error";
			case "address":
				return value.length >= 5 ? "success" : null;
			default:
				return null;
		}
	};

	const isFormValid = () => {
		// Name and city are required
		const nameValid = getValidationState("name", formData.name) === "success";
		const cityValid = getValidationState("city", formData.city) === "success";

		// Domain is optional, but if filled must be valid
		const domainValid =
			formData.domain.length === 0 ||
			getValidationState("domain", formData.domain) === "success";

		return nameValid && cityValid && domainValid;
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!isFormValid()) return;

		setIsLoading(true);
		setError(null);

		try {
			await onSubmit(formData);
		} catch (err) {
			setError(
				err.response?.data?.error ||
					"Something went wrong. Please try again."
			);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="bg-white rounded-lg shadow-md p-8">
			{/* Logo/Brand */}
			<div className="w-16 h-16 bg-green-600 rounded-lg flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6">
				RI
			</div>

			<h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
				Set Up Your Restaurant
			</h2>
			<p className="text-gray-600 text-center mb-6">
				Tell us about your restaurant to complete setup
			</p>

			{error && (
				<div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
					{error}
				</div>
			)}

			<form
				onSubmit={handleSubmit}
				className="space-y-4"
			>
				{/* Restaurant Name */}
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-1">
						Restaurant Name *
					</label>
					<input
						type="text"
						name="name"
						value={formData.name}
						onChange={handleInputChange}
						placeholder="e.g., Bob's Burgers"
						disabled={isLoading}
						autoComplete="organization"
						className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
							getValidationState("name", formData.name) === "success"
								? "border-green-500"
								: "border-gray-300"
						}`}
					/>
					{getValidationState("name", formData.name) === "success" && (
						<div className="flex items-center gap-1 text-green-600 text-sm mt-1">
							<Check size={16} />
							Looks good
						</div>
					)}
				</div>

				{/* Domain (Optional) */}
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-1">
						Website Domain <span className="text-gray-400">(optional)</span>
					</label>
					<input
						type="text"
						name="domain"
						value={formData.domain}
						onChange={handleInputChange}
						placeholder="e.g., bobsburgers.com"
						disabled={isLoading}
						autoComplete="url"
						className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
							getValidationState("domain", formData.domain) === "success"
								? "border-green-500"
								: getValidationState("domain", formData.domain) === "error"
								? "border-red-500"
								: "border-gray-300"
						}`}
					/>
					{getValidationState("domain", formData.domain) === "error" && (
						<div className="text-red-600 text-sm mt-1">
							Please enter a valid domain (e.g., example.com)
						</div>
					)}
				</div>

				{/* Address */}
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-1">
						Street Address <span className="text-gray-400">(optional)</span>
					</label>
					<input
						type="text"
						name="address"
						value={formData.address}
						onChange={handleInputChange}
						placeholder="e.g., 123 Main Street"
						disabled={isLoading}
						autoComplete="street-address"
						className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
							getValidationState("address", formData.address) === "success"
								? "border-green-500"
								: "border-gray-300"
						}`}
					/>
				</div>

				{/* City */}
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-1">
						City *
					</label>
					<input
						type="text"
						name="city"
						value={formData.city}
						onChange={handleInputChange}
						placeholder="e.g., Las Vegas"
						disabled={isLoading}
						autoComplete="address-level2"
						className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
							getValidationState("city", formData.city) === "success"
								? "border-green-500"
								: "border-gray-300"
						}`}
					/>
					{getValidationState("city", formData.city) === "success" && (
						<div className="flex items-center gap-1 text-green-600 text-sm mt-1">
							<Check size={16} />
							Looks good
						</div>
					)}
				</div>

				{/* Submit Button */}
				<button
					type="submit"
					disabled={!isFormValid() || isLoading}
					className={`w-full py-3 rounded-lg font-semibold text-white transition-all ${
						isFormValid() && !isLoading
							? "bg-green-600 hover:bg-green-700 cursor-pointer"
							: "bg-gray-300 cursor-not-allowed"
					}`}
				>
					{isLoading ? (
						<span className="flex items-center justify-center gap-2">
							<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
							Saving...
						</span>
					) : (
						submitLabel
					)}
				</button>

				{onBack && (
					<button
						type="button"
						onClick={onBack}
						disabled={isLoading}
						className="w-full py-2 text-gray-600 hover:text-gray-800 text-sm"
					>
						Back
					</button>
				)}
			</form>
		</div>
	);
}
