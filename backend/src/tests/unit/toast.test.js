// /backend/src/tests/unit/toast.test.js
// Unit tests for the Toast connection. No network or database needed.
// Run with: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
	encryptCredentials,
	decryptCredentials,
	isEncrypted,
} from "../../services/credentialVault.js";
import {
	normalizeToastOrder,
	formatBusinessDate,
} from "../../services/posAdapters/toastOrdersAdapter.js";
import { normalizeToastMenus } from "../../services/posAdapters/toastAdapter.js";
import { resolveToastApiUrl } from "../../services/posAdapters/toastClient.js";

const KEY = crypto.randomBytes(32).toString("hex");

const CREDENTIALS = {
	restaurantGuid: "2071fb81-988b-4d75-b8dc-c5c17cff9706",
	clientId: "client-id",
	clientSecret: "super-secret-value",
	apiUrl: "https://ws-api.toasttab.com",
};

test("credentials round-trip through the vault and are not stored in plain text", () => {
	process.env.POS_CREDENTIALS_KEY = KEY;

	const stored = encryptCredentials(CREDENTIALS);

	assert.equal(isEncrypted(stored), true);
	assert.equal(JSON.stringify(stored).includes("super-secret-value"), false);
	assert.equal(JSON.stringify(stored).includes("client-id"), false);
	assert.deepEqual(decryptCredentials(stored), CREDENTIALS);
});

test("each save uses a fresh IV", () => {
	process.env.POS_CREDENTIALS_KEY = KEY;

	const a = encryptCredentials(CREDENTIALS);
	const b = encryptCredentials(CREDENTIALS);

	assert.notEqual(a.iv, b.iv);
	assert.notEqual(a.data, b.data);
});

test("tampered or wrong-key data is rejected", () => {
	process.env.POS_CREDENTIALS_KEY = KEY;
	const stored = encryptCredentials(CREDENTIALS);

	const tampered = { ...stored, data: Buffer.from("junk").toString("base64") };
	assert.throws(() => decryptCredentials(tampered), /could not be decrypted/);

	process.env.POS_CREDENTIALS_KEY = crypto.randomBytes(32).toString("hex");
	assert.throws(() => decryptCredentials(stored), /could not be decrypted/);
});

test("saving without a server key fails instead of storing plain text", () => {
	delete process.env.POS_CREDENTIALS_KEY;
	assert.throws(() => encryptCredentials(CREDENTIALS), /POS_CREDENTIALS_KEY/);

	process.env.POS_CREDENTIALS_KEY = "too-short";
	assert.throws(() => encryptCredentials(CREDENTIALS), /32 bytes/);
});

test("rows saved before encryption still read", () => {
	process.env.POS_CREDENTIALS_KEY = KEY;
	assert.deepEqual(decryptCredentials(CREDENTIALS), CREDENTIALS);
	assert.equal(decryptCredentials(null), null);
});

test("only Toast hosts are accepted as the API URL", () => {
	delete process.env.TOAST_API_URL;
	assert.equal(resolveToastApiUrl({}), "https://ws-api.toasttab.com");
	assert.equal(
		resolveToastApiUrl({ apiUrl: "https://ws-api.toasttab.com/" }),
		"https://ws-api.toasttab.com"
	);
	assert.throws(
		() => resolveToastApiUrl({ apiUrl: "https://evil.example.com" }),
		/Unsupported Toast API URL/
	);
});

test("business date converts from yyyyMMdd", () => {
	assert.equal(formatBusinessDate(20200302), "2020-03-02");
	assert.equal(formatBusinessDate("20261109"), "2026-11-09");
	assert.equal(formatBusinessDate(0), null);
	assert.equal(formatBusinessDate(undefined), null);
});

test("an order is normalized from Toast's ordersBulk shape", () => {
	const order = normalizeToastOrder({
		guid: "order-1",
		businessDate: 20200302,
		openedDate: "2020-03-02T19:10:30.000+0000",
		closedDate: "2020-03-02T19:40:00.000+0000",
		paidDate: "2020-03-02T19:40:00.000+0000",
		source: "In Store",
		voided: false,
		deleted: false,
		diningOption: { guid: "dining-1", entityType: "DiningOption" },
		checks: [
			{
				displayNumber: "42",
				amount: 25.5,
				taxAmount: 1.79,
				totalAmount: 27.29,
				voided: false,
				deleted: false,
				selections: [
					{
						item: { guid: "item-burger", entityType: "MenuItem" },
						displayName: "Burger",
						quantity: 2,
						price: 21,
						preDiscountPrice: 21,
						voided: false,
						modifiers: [
							{ item: { guid: "mod-bacon" }, displayName: "Bacon", price: 1.5 },
						],
					},
					{
						item: { guid: "item-salmon", entityType: "MenuItem" },
						displayName: "Salmon by weight",
						quantity: 0.5,
						price: 4.5,
						voided: false,
					},
					{
						item: { guid: "item-fries", entityType: "MenuItem" },
						displayName: "Fries",
						quantity: 1,
						price: 4,
						voided: true,
					},
				],
			},
			{
				// A voided check must not count toward sales or stock.
				amount: 99,
				taxAmount: 9,
				totalAmount: 108,
				voided: true,
				selections: [
					{ item: { guid: "item-steak" }, displayName: "Steak", quantity: 3, price: 99 },
				],
			},
		],
	});

	assert.equal(order.posOrderId, "order-1");
	assert.equal(order.orderNumber, "42");
	assert.equal(order.businessDate, "2020-03-02");
	assert.equal(order.status, "closed");
	assert.equal(order.subtotal, 25.5);
	assert.equal(order.tax, 1.79);
	assert.equal(order.total, 27.29);

	assert.equal(order.lineItems.length, 3);

	const [burger, salmon, fries] = order.lineItems;
	assert.equal(burger.posMenuItemId, "item-burger");
	assert.equal(burger.quantity, 2);
	assert.equal(burger.totalPrice, 21);
	assert.equal(burger.unitPrice, 10.5);
	assert.equal(burger.modifiers[0].name, "Bacon");
	assert.equal(salmon.quantity, 0.5);
	assert.equal(salmon.unitPrice, 9);
	assert.equal(fries.voided, true);
});

test("order status reflects voided, deleted and open orders", () => {
	assert.equal(normalizeToastOrder({ guid: "a", voided: true }).status, "voided");
	assert.equal(normalizeToastOrder({ guid: "b", deleted: true }).status, "deleted");
	assert.equal(normalizeToastOrder({ guid: "c" }).status, "open");
	assert.equal(normalizeToastOrder({ guid: "c" }).lineItems.length, 0);
});

test("menus V2 flatten through nested groups without duplicates", () => {
	const items = normalizeToastMenus({
		restaurantGuid: "r-1",
		menus: [
			{
				name: "Dinner",
				guid: "menu-1",
				menuGroups: [
					{
						name: "Pizza",
						guid: "group-pizza",
						menuItems: [
							{ name: "Cheese Pizza", guid: "item-1", price: 12.5, visibility: ["POS"] },
							{ name: "Sized Pizza", guid: "item-2", price: null, visibility: [] },
						],
						menuGroups: [
							{
								name: "Specialty",
								guid: "group-special",
								menuItems: [
									{ name: "Truffle Pizza", guid: "item-3", price: 18 },
									// Same item listed again in a subgroup
									{ name: "Cheese Pizza", guid: "item-1", price: 12.5 },
								],
							},
						],
					},
				],
			},
		],
	});

	assert.deepEqual(
		items.map((i) => i.posMenuItemId),
		["item-1", "item-2", "item-3"]
	);
	assert.equal(items[0].price, 12.5);
	assert.equal(items[0].category, "Pizza");
	assert.equal(items[0].isActive, true);
	assert.equal(items[1].price, 0);
	assert.equal(items[1].isActive, false);
	assert.equal(items[2].category, "Specialty");
	assert.deepEqual(normalizeToastMenus({}), []);
});

// ---------------------------------------------------------------------------
// HTTP behaviour, with axios replaced so nothing leaves the machine
// ---------------------------------------------------------------------------

import { mock } from "node:test";
import axios from "axios";
import {
	toastGet,
	clearToastTokenCache,
} from "../../services/posAdapters/toastClient.js";
import { fetchAllToastOrders } from "../../services/posAdapters/toastOrdersAdapter.js";
import { verifyToastConnection } from "../../services/posAdapters/toastAdapter.js";

function httpError(status, message = "nope") {
	const error = new Error(`Request failed with status code ${status}`);
	error.response = { status, data: { message } };
	return error;
}

test("signs in once and reuses the token across requests", async (t) => {
	clearToastTokenCache();

	const post = t.mock.method(axios, "post", async (url, body) => {
		assert.equal(url, "https://ws-api.toasttab.com/authentication/v1/authentication/login");
		assert.equal(body.userAccessType, "TOAST_MACHINE_CLIENT");
		assert.equal(body.clientSecret, "super-secret-value");
		return { data: { token: { accessToken: "token-1", expiresIn: 3600 } } };
	});
	const get = t.mock.method(axios, "get", async (url, config) => {
		assert.equal(config.headers.Authorization, "Bearer token-1");
		assert.equal(
			config.headers["Toast-Restaurant-External-ID"],
			CREDENTIALS.restaurantGuid
		);
		return { data: { ok: true } };
	});

	await toastGet(CREDENTIALS, "/menus/v2/menus");
	await toastGet(CREDENTIALS, "/menus/v2/menus");

	assert.equal(post.mock.callCount(), 1);
	assert.equal(get.mock.callCount(), 2);
});

test("a rejected token triggers one fresh sign-in and a retry", async (t) => {
	clearToastTokenCache();

	let logins = 0;
	t.mock.method(axios, "post", async () => {
		logins++;
		return { data: { token: { accessToken: `token-${logins}`, expiresIn: 3600 } } };
	});
	const get = t.mock.method(axios, "get", async (url, config) => {
		if (config.headers.Authorization === "Bearer token-1") throw httpError(401);
		return { data: ["fresh"] };
	});

	assert.deepEqual(await toastGet(CREDENTIALS, "/orders/v2/ordersBulk"), ["fresh"]);
	assert.equal(logins, 2);
	assert.equal(get.mock.callCount(), 2);
});

test("bad credentials produce a readable message", async (t) => {
	clearToastTokenCache();

	t.mock.method(axios, "post", async () => {
		throw httpError(401);
	});

	await assert.rejects(
		() => verifyToastConnection(CREDENTIALS),
		/did not accept the client ID or client secret/
	);
});

test("a GUID the credentials cannot see produces a readable message", async (t) => {
	clearToastTokenCache();

	t.mock.method(axios, "post", async () => ({
		data: { token: { accessToken: "token-1", expiresIn: 3600 } },
	}));
	t.mock.method(axios, "get", async () => {
		throw httpError(403);
	});

	await assert.rejects(
		() => verifyToastConnection(CREDENTIALS),
		/do not have access to this restaurant GUID/
	);
});

test("orders are fetched page by page until a short page", async (t) => {
	clearToastTokenCache();

	t.mock.method(axios, "post", async () => ({
		data: { token: { accessToken: "token-1", expiresIn: 3600 } },
	}));

	const pagesRequested = [];
	t.mock.method(axios, "get", async (url, config) => {
		assert.equal(url, "https://ws-api.toasttab.com/orders/v2/ordersBulk");
		assert.equal(config.params.pageSize, 100);
		assert.equal(config.params.startDate, "2026-11-09T00:00:00.000Z");
		pagesRequested.push(config.params.page);

		const count = config.params.page === 1 ? 100 : 37;
		return {
			data: Array.from({ length: count }, (_, i) => ({
				guid: `order-${config.params.page}-${i}`,
				businessDate: 20261109,
				checks: [],
			})),
		};
	});

	const orders = await fetchAllToastOrders(CREDENTIALS, {
		startDate: "2026-11-09",
		endDate: "2026-11-10",
	});

	assert.deepEqual(pagesRequested, [1, 2]);
	assert.equal(orders.length, 137);
	assert.equal(orders[0].businessDate, "2026-11-09");
});

test("a sync window longer than 31 days is refused", async () => {
	await assert.rejects(
		() =>
			fetchAllToastOrders(CREDENTIALS, {
				startDate: "2026-01-01",
				endDate: "2026-11-01",
			}),
		/at most 31 days/
	);
});
