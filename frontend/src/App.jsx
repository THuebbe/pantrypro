// /frontend/src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { HeroUIProvider } from "@heroui/react";
import { AuthProvider } from "./core/auth/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Register from "./pages/Register";
import SignupComplete from "./pages/SignupComplete";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import RecipeBuilder from "./components/menu-items/RecipeBuilder";
import Landing from "./pages/Landing";
import VendorERPTest from "./pages/VendorERPTest";
import CountSheet from "./pages/CountSheet";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: 1,
			refetchOnWindowFocus: false,
		},
	},
});

function App() {
	return (
		<HeroUIProvider>
			<AuthProvider>
				<BrowserRouter>
					<QueryClientProvider client={queryClient}>
						<Routes>
							<Route
								path="/"
								element={<Landing />}
							/>
							<Route
								path="/login"
								element={<Login />}
							/>
							<Route
								path="/register"
								element={<Register />}
							/>
							<Route
								path="/signup/complete"
								element={<SignupComplete />}
							/>
							<Route
								path="/dashboard"
								element={
									<ProtectedRoute>
										<Dashboard />
									</ProtectedRoute>
								}
							/>
							<Route
								path="/inventory/*"
								element={
									<ProtectedRoute>
										<Dashboard />
									</ProtectedRoute>
								}
							/>
							<Route
								path="/menu-items/*"
								element={
									<ProtectedRoute>
										<Dashboard />
									</ProtectedRoute>
								}
							/>
							<Route
								path="/receiving/*"
								element={
									<ProtectedRoute>
										<Dashboard />
									</ProtectedRoute>
								}
							/>
							<Route
								path="/orders/*"
								element={
									<ProtectedRoute>
										<Dashboard />
									</ProtectedRoute>
								}
							/>
							<Route
								path="/dashboard/orders/*"
								element={
									<ProtectedRoute>
										<Dashboard />
									</ProtectedRoute>
								}
							/>
							<Route
								path="/vendors/*"
								element={
									<ProtectedRoute>
										<Dashboard />
									</ProtectedRoute>
								}
							/>
							<Route
								path="/reports/*"
								element={
									<ProtectedRoute>
										<Dashboard />
									</ProtectedRoute>
								}
							/>
							<Route
								path="/recipes/*"
								element={
									<ProtectedRoute>
										<Dashboard />
									</ProtectedRoute>
								}
							/>
							<Route
								path="/sales/*"
								element={
									<ProtectedRoute>
										<Dashboard />
									</ProtectedRoute>
								}
							/>
							<Route
								path="/settings/*"
								element={
									<ProtectedRoute>
										<Dashboard />
									</ProtectedRoute>
								}
							/>
							<Route
								path="/print/count-sheet"
								element={
									<ProtectedRoute>
										<CountSheet />
									</ProtectedRoute>
								}
							/>
							<Route
								path="/vendor-test"
								element={
									<ProtectedRoute>
										<VendorERPTest />
									</ProtectedRoute>
								}
							/>
						</Routes>
					</QueryClientProvider>
				</BrowserRouter>
			</AuthProvider>
		</HeroUIProvider>
	);
}

export default App;
