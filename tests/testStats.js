import fetch from 'node-fetch';
import fs from 'fs';

const username = "fakeuser_eovq97@example.com";
const { defaultPassword } = (await import('./functions/createFakeUser.js'));
import autoUserLogin from './functions/autoUserLogin.js'
import { baseUrl } from './functions/createFakeUser.js';

const token = await autoUserLogin(baseUrl, username, defaultPassword);
console.log(`user logged in, got token: ${token}`);

const r = await fetch(`${baseUrl}/udata/stats`, {
	method: 'GET',
	headers: {
		'Authorization': token,
		'Content-Type': 'application/json'
	}
});

fs.writeFileSync('temp.ustats.json', JSON.stringify(await r.json()))