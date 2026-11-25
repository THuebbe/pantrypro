// /frontend/src/pages/RegisterUser.jsx

import { useState } from "react";
import { Eye, EyeOff, Check, X } from "lucide-react";

/**
 * Step 1 of sign-up: the owner's name, email and password. Nothing is sent
 * anywhere yet; the details are passed up and sent with the restaurant.
 */
export default function RegisterUser({ initialValues, onNext }) {
	const [formData, setFormData] = useState({
		firstName: "",
		lastName: "",
		email: "",
		password: "",
		...initialValues,
	});
	const [showPassword, setShowPassword] = useState(false);

	const handleInputChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const isValidEmail = (email) => {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
	};

	const passwordRequirements = [
		{ label: "At least 8 characters", met: formData.password.length >= 8 },
		{
			label: "Contains uppercase letter",
			met: /[A-Z]/.test(formData.password),
		},
		{
			label: "Contains lowercase letter",
			met: /[a-z]/.test(formData.password),
		},
		{ label: "Contains number", met: /\d/.test(formData.password) },
		{
			label: "Contains special character",
			met: /[!@#$%^&*(),.?":{}|<>~]/.test(formData.password),
		},
	];

	const isPasswordValid = () => {
		return passwordRequirements.every((req) => req.met);
	};

	const getPasswordStrength = () => {
		if (formData.password.length === 0) return "";
		if (formData.password.length < 6) return "weak";
		if (formData.password.length < 8) return "medium";
		return "strong";
	};

	const getValidationState = (field, value) => {
		switch (field) {
			case "firstName":
			case "lastName":
				return value.length >= 2 ? "success" : null;
			case "email":
				if (value.length === 0) return null;
				return isValidEmail(value) ? "success" : "error";
			case "password":
				return isPasswordValid() ? "success" : null;
			default:
				return null;
		}
	};

	const isFormValid = () => {
		return Object.entries(formData).every(([field, value]) => {
			const state = getValidationState(field, value);
			return state === "success";
		});
	};

	const handleSubmit = (e) => {
		e.preventDefault();
		if (!isFormValid()) return;
		onNext(formData);
	};

	return (
		<div className="bg-white rounded-lg shadow-md p-8">
			{/* Logo/Brand */}
			<div className="w-16 h-16 bg-green-600 rounded-lg flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6">
				RI
			</div>

			<h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
				Create Your Account
			</h2>
			<p className="text-gray-600 text-center mb-6">
				Start managing your restaurant inventory in minutes
			</p>

			<form
				onSubmit={handleSubmit}
				className="space-y-4"
			>
				{/* First Name */}
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-1">
						First Name *
					</label>
					<input
						type="text"
						name="firstName"
						value={formData.firstName}
						onChange={handleInputChange}
						placeholder="Enter your first name"
						className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
							getValidationState("firstName", formData.firstName) === "success"
								? "border-green-500"
								: "border-gray-300"
						}`}
					/>
					{getValidationState("firstName", formData.firstName) ===
						"success" && (
						<div className="flex items-center gap-1 text-green-600 text-sm mt-1">
							<Check size={16} />
							Looks good
						</div>
					)}
				</div>

				{/* Last Name */}
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-1">
						Last Name *
					</label>
					<input
						type="text"
						name="lastName"
						value={formData.lastName}
						onChange={handleInputChange}
						placeholder="Enter your last name"
						className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
							getValidationState("lastName", formData.lastName) === "success"
								? "border-green-500"
								: "border-gray-300"
						}`}
					/>
					{getValidationState("lastName", formData.lastName) === "success" && (
						<div className="flex items-center gap-1 text-green-600 text-sm mt-1">
							<Check size={16} />
							Looks good
						</div>
					)}
				</div>

				{/* Email */}
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-1">
						Email Address *
					</label>
					<input
						type="email"
						name="email"
						value={formData.email}
						onChange={handleInputChange}
						placeholder="Enter your email address"
						className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
							getValidationState("email", formData.email) === "success"
								? "border-green-500"
								: getValidationState("email", formData.email) === "error"
								? "border-red-500"
								: "border-gray-300"
						}`}
					/>
					{getValidationState("email", formData.email) === "error" && (
						<div className="flex items-center gap-1 text-red-600 text-sm mt-1">
							<X size={16} />
							Please enter a valid email address
						</div>
					)}
				</div>

				{/* Password */}
				<div>
					<label className="block text-sm font-medium text-gray-700 mb-1">
						Password *
					</label>
					<div className="relative">
						<input
							type={showPassword ? "text" : "password"}
							name="password"
							value={formData.password}
							onChange={handleInputChange}
							placeholder="Create a strong password"
							className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 pr-10 ${
								getValidationState("password", formData.password) === "success"
									? "border-green-500"
									: "border-gray-300"
							}`}
						/>
						<button
							type="button"
							onClick={() => setShowPassword(!showPassword)}
							className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
						>
							{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
						</button>
					</div>

					{/* Password Strength Bar */}
					{formData.password.length > 0 && (
						<div className="mt-2 h-1 bg-gray-200 rounded-full overflow-hidden">
							<div
								className={`h-full transition-all ${
									getPasswordStrength() === "weak"
										? "w-1/3 bg-red-500"
										: getPasswordStrength() === "medium"
										? "w-2/3 bg-yellow-500"
										: "w-full bg-green-500"
								}`}
							></div>
						</div>
					)}
				</div>

				{/* Password Requirements */}
				<div className="space-y-2">
					<p className="text-sm font-medium text-gray-700">
						Password Requirements:
					</p>
					{passwordRequirements.map((req, index) => (
						<div
							key={index}
							className={`flex items-center gap-2 text-sm ${
								req.met ? "text-green-600" : "text-gray-500"
							}`}
						>
							{req.met ? (
								<Check size={16} />
							) : (
								<X
									size={16}
									className="text-gray-300"
								/>
							)}
							{req.label}
						</div>
					))}
				</div>

				{/* Submit Button */}
				<button
					type="submit"
					disabled={!isFormValid()}
					className={`w-full py-3 rounded-lg font-semibold text-white transition-all ${
						isFormValid()
							? "bg-green-600 hover:bg-green-700 cursor-pointer"
							: "bg-gray-300 cursor-not-allowed"
					}`}
				>
					Next: Your Restaurant
				</button>
			</form>

			{/* Login Link */}
			<div className="mt-6 text-center">
				<a
					href="/login"
					className="text-green-600 hover:text-green-700 text-sm"
				>
					Already have an account? Sign in
				</a>
			</div>
		</div>
	);
}
