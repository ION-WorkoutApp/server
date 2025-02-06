import fetch from "node-fetch";
import { handleResponse } from "./createFakeUser.js";

export default async function autoUserLogin(baseUrl, email, defaultPassword) {
	const loginRes = await handleResponse(await fetch(`${baseUrl}/auth/checkcredentials`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			email,
			password: defaultPassword
		})
	}));
	return loginRes.token;
}