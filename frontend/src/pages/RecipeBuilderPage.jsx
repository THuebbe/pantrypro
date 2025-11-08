// src/pages/RecipeBuilderPage.jsx
import RecipeBuilder from "../components/menu-items/RecipeBuilder";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/Layout/Header";

export default function RecipeBuilderPage() {
	return (
		<div className="flex h-screen bg-gray-50">
			<Sidebar />
			<div className="flex-1 flex flex-col overflow-hidden">
				<TopBar />
				<main className="flex-1 overflow-y-auto p-6">
					<RecipeBuilder />
				</main>
			</div>
		</div>
	);
}
