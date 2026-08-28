class LanguageManager extends EventTarget {
	#languages;
	#storageKey;
	#defaultLanguage;
	#switcherSelector;
	#activeLanguage;
	#switcher = null;

	constructor(languages, {
		storageKey = 'docbuilder_language',
		defaultLanguage = 'en',
		switcherSelector = '.ed-language'
	} = {}) {
		super();
		this.#languages = this.#validateLanguages(languages);
		this.#storageKey = storageKey;
		this.#defaultLanguage = defaultLanguage;
		this.#switcherSelector = switcherSelector;
		this.#assertSupported(defaultLanguage);
		this.#activeLanguage = this.#getInitialLanguage();
		document.documentElement.lang = this.#activeLanguage;
	}

	initialize() {
		if (this.#switcher) throw new Error('LanguageManager has already been initialized');

		const switcher = sel(this.#switcherSelector);
		if (!(switcher instanceof HTMLSelectElement))
			throw new Error(`Language switcher must be a <select>: ${this.#switcherSelector}`);

		this.#switcher = switcher;
		this.#switcher.addEventListener('change', () => {
			if (!this.setLanguage(this.#switcher.value)) return;

			this.localizeStaticUI();
			this.dispatchEvent(new Event('change'));
		});
		this.localizeStaticUI();
	}

	setLanguage(language) {
		this.#assertSupported(language);
		if (language === this.#activeLanguage) return false;

		// Persist first so a storage failure cannot leave the in-memory language out of sync
		localStorage.setItem(this.#storageKey, language);
		this.#activeLanguage = language;
		document.documentElement.lang = language;
		return true;
	}

	translate(text) {
		if (typeof text !== 'string') throw new TypeError('Translation key must be a string');

		// Source strings are English and intentionally serve as the fallback for missing translations
		const locale = this.#languages[this.#activeLanguage].locale;
		if (Object.hasOwn(locale, text)) return locale[text];
		console.warn(`Missing translation for "${text}" in locale "${this.#activeLanguage}"`);

		return text;
	}

	localizeStaticUI() {
		each('.locale', element => {
			const key = element.dataset.localeKey || element.innerHTML.trim();
			element.dataset.localeKey = key;
			element.innerHTML = this.translate(key);
		});
		this.#updateSwitcher();
	}

	#getInitialLanguage() {
		const savedLanguage = localStorage.getItem(this.#storageKey);
		if (savedLanguage !== null) {
			if (this.#isSupported(savedLanguage)) return savedLanguage;

			console.warn(`Ignoring unsupported saved language: ${savedLanguage}`);
			localStorage.removeItem(this.#storageKey);
		}

		const preferences = navigator.languages?.length ? navigator.languages : [navigator.language];
		for (const preference of preferences) {
			// Ignore the regional variant part of language code
			const language = preference?.toLowerCase().split('-')[0];
			if (this.#isSupported(language)) return language;
		}

		return this.#defaultLanguage;
	}

	#updateSwitcher() {
		for (const option of this.#switcher.options) {
			this.#assertSupported(option.value);
			option.textContent = this.#languages[option.value].label;
		}

		this.#switcher.value = this.#activeLanguage;
		if (this.#switcher.value !== this.#activeLanguage)
			throw new Error(`Language switcher has no option for: ${this.#activeLanguage}`);

		// Give the select an accessible name; its selected option exposes the current value separately
		this.#switcher.setAttribute('aria-label', this.translate('Language'));
	}

	#isSupported(language) {
		return typeof language === 'string' && Object.hasOwn(this.#languages, language);
	}

	#assertSupported(language) {
		if (!this.#isSupported(language)) throw new RangeError(`Unsupported language: ${String(language)}`);
	}

	#validateLanguages(languages) {
		if (!languages || typeof languages !== 'object' || Array.isArray(languages))
			throw new TypeError('Languages must be an object');

		const validated = {};
		for (const [code, definition] of Object.entries(languages)) {
			if (!definition || typeof definition !== 'object') throw new TypeError(`Invalid language definition: ${code}`);

			if (typeof definition.label !== 'string' || !definition.label)
				throw new TypeError(`Language label must be a non-empty string: ${code}`);

			if (!definition.locale || typeof definition.locale !== 'object' || Array.isArray(definition.locale))
				throw new TypeError(`Language locale must be an object: ${code}`);

			for (const [key, translation] of Object.entries(definition.locale)) {
				if (typeof translation !== 'string') throw new TypeError(`Translation must be a string: ${code}.${key}`);
			}

			validated[code] = Object.freeze({
				label: definition.label,
				// Templates are loaded on demand and extend their locale at runtime
				// Keep the validated dictionary reference live so those additions are visible
				locale: definition.locale
			});
		}

		return Object.freeze(validated);
	}
}

const languageManager = new LanguageManager({
	en: {label: 'ENG', locale: {}},
	hu: {label: 'HUN', locale: window.Locale}
});

function _(text) {
	return languageManager.translate(text);
}

window.addEventListener('DOMContentLoaded', () => languageManager.initialize());
