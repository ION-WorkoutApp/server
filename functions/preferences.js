import fs from 'fs';

const SETTINGS_FILE = 'settings.env';

const DEFAULT_PREFS = {
	DEBUGGING: "false",
	ALLOW_SIGNUPS: "true",
	REQUIRE_EMAIL_VERIFICATION: "true",
	MIN_PASSWORD_REQ: "true", // unused for now
	ALLOW_SOCIAL_LOGINS: "false", // 401
	LOGIN_LIMIT: "5", // TODO
	ENABLE_MONETIZATION: "false" //  TODO
};

function loadSettings() {
	if (!fs.existsSync(SETTINGS_FILE)) return {};
	const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
	return data.split('\n').reduce((acc, line) => {
		line = line.trim();
		if (line && !line.startsWith('#') && line.includes('=')) {
			const [key, ...rest] = line.split('=');
			acc[key.trim()] = rest.join('=').trim();
		}
		return acc;
	}, {});
}

function loadSettingsIntoENV() {
	try {
		for (const [key, def] of Object.entries(loadSettings())) {
			process.env[key] = def;
		}
	}
	catch(err) {
		console.error(err);
	}
}

function saveSettings(settings) {
	const content = Object.entries(settings)
		.map(([k, v]) => `${k}=${v}`)
		.join('\n');
	fs.writeFileSync(SETTINGS_FILE, content);
}

function createDefaultPreferencesIfNotPresent() {
	let current = {};
	Object.keys(DEFAULT_PREFS).forEach(key => {
		current[key] = process.env[key] || undefined;
	});
	const fileSettings = loadSettings();
	Object.keys(DEFAULT_PREFS).forEach(key => {
		if (current[key] === undefined && fileSettings[key]) {
			current[key] = fileSettings[key];
		}
	});
	let updated = false;
	Object.entries(DEFAULT_PREFS).forEach(([key, def]) => {
		if (current[key] === undefined) {
			current[key] = def;
			process.env[key] = def;
			updated = true;
		}
	});
	if (updated) saveSettings(current);
	return current;
}

function getAllEnabledPreferences() {
	let prefs = {};
	Object.keys(DEFAULT_PREFS).forEach(key => {
		prefs[key] = process.env[key] || loadSettings()[key] || DEFAULT_PREFS[key];
	});
	let enabled = {};
	for (const key in prefs) {
		let val = prefs[key];
		if (key === "LOGIN_LIMIT") {
			if (parseInt(val) > 0) enabled[key] = val;
		} else {
			if (['true', '1', 'yes'].includes(val.toLowerCase())) enabled[key] = val;
		}
	}
	return enabled;
}

function changePreferences(newPrefs) {
	let current = createDefaultPreferencesIfNotPresent();
	for (const key in newPrefs) {
		if (DEFAULT_PREFS.hasOwnProperty(key)) {
			current[key] = String(newPrefs[key]);
			process.env[key] = String(newPrefs[key]);
		} else {
			throw new Error(`Preference "${key}" is not recognized.`);
		}
	}
	saveSettings(current);
	return current;
}

function getPreference(key) {
	if (!DEFAULT_PREFS.hasOwnProperty(key)) throw new Error(`Preference "${key}" is not recognized.`);
	return process.env[key] || loadSettings()[key] || DEFAULT_PREFS[key];
}

const checkPreference = (key, val = "true") => (getPreference(key) == val)


export {
	loadSettings,
	saveSettings,
	createDefaultPreferencesIfNotPresent,
	getAllEnabledPreferences,
	changePreferences,
	getPreference,
	loadSettingsIntoENV,
	checkPreference
};
