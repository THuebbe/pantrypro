// /backend/src/services/business.js

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function createBusiness(businessData, userId) {
	try {
		if (!businessData.name || !businessData.name.trim()) {
			throw new Error("Business name is required");
		}

		businessData = {
			name: businessData.name,
			domain: businessData.domain || "",
			address: businessData.address || "",
			city: businessData.city || "",
		};

		// One business per account: a second one would orphan the first.
		const { data: owner, error: ownerError } = await supabase
			.from("users")
			.select("business_id")
			.eq("id", userId)
			.single();

		if (ownerError) {
			throw new Error(`User lookup failed: ${ownerError.message}`);
		}
		if (owner.business_id) {
			throw new Error("This account already has a business registered");
		}

		let slug = generateSlug(businessData.name);

		const { data: existingBusiness } = await supabase
			.from("businesses")
			.select("slug, address")
			.eq("slug", slug)
			.maybeSingle();

		if (existingBusiness) {
			if (existingBusiness.address === businessData.address) {
				throw new Error("This business is already registered at this address");
			}

			slug = `${slug}-${generateSlug(businessData.city)}`;

			const { data: withCity } = await supabase
				.from("businesses")
				.select("slug")
				.eq("slug", slug)
				.maybeSingle();

			if (withCity) {
				const streetNumber = businessData.address.split(" ")[0];
				slug = `${slug}-${streetNumber}`;
			}
		}

		const { data, error } = await supabase
			.from("businesses")
			.insert({
				name: businessData.name.trim(),
				slug: slug,
				domain: businessData.domain.trim(),
				address: businessData.address.trim(),
				city: businessData.city.trim(),
				business_type: "restaurant",
				is_active: true,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			})
			.select()
			.single();

		if (error) throw new Error(`Business creation failed: ${error.message}`);

		// Every screen in the app works on the restaurant record, so it is
		// created here with the business. If any later step fails, undo the
		// earlier ones so the owner can simply try again.
		const { data: restaurant, error: restaurantError } = await supabase
			.from("restaurants")
			.insert({
				business_id: data.id,
				business_name: data.name,
				address: data.address,
				city: data.city,
			})
			.select("id")
			.single();

		if (restaurantError) {
			await supabase.from("businesses").delete().eq("id", data.id);
			throw new Error(`Restaurant creation failed: ${restaurantError.message}`);
		}

		const { error: userUpdateError } = await supabase
			.from("users")
			.update({
				business_id: data.id,
				updated_at: new Date().toISOString(),
			})
			.eq("id", userId);

		if (userUpdateError) {
			await supabase.from("restaurants").delete().eq("id", restaurant.id);
			await supabase.from("businesses").delete().eq("id", data.id);
			throw new Error(`User update failed: ${userUpdateError.message}`);
		}

		return {
			business: data,
			restaurantId: restaurant.id,
			message: "Business successfully registered",
		};
	} catch (error) {
		throw error;
	}
}

function generateSlug(businessString) {
	const slug = businessString
		.toLowerCase()
		.replace(/'/g, "")
		.replace(/[^\w-]+/g, "")
		.replace(/\s+/g, "-")
		.replace(/--+/g, "-")
		.trim();

	return slug;
}
