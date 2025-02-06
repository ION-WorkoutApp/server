const username = "fakeuser_eovq97@example.com";
const { defaultPassword } = (await import('./functions/createFakeUser.js'));
import autoUserLogin from './functions/autoUserLogin.js'
import { baseUrl } from './functions/createFakeUser.js';

const token = await autoUserLogin(baseUrl, username, defaultPassword);
console.log(`user logged in, got token: ${token}`);

const exportRequest = await fetch(`${baseUrl}/udata/export`, {
	method: 'POST',
	headers: {
		'Authorization': token,
		'Content-Type': 'application/json'
	},
	body: JSON.stringify({
		format: 'csv'
	})
});

console.log(await exportRequest.text())