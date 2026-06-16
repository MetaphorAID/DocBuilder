function handleSelectOption(e, t) {
	const s = t.parentNode;

	if (!s.classList.contains('open')) {
		s.classList.add('open');
		return true;
	}

	if (!t.classList.contains('no-value')) {
		if (!s.classList.contains('multiple')) {
			each('.selected', i => i.classList.remove('selected'), s);
		}
		t.classList.toggle('selected');
	}

	const values = [];
	each('.selected', i => {
		if (i.dataset.value) values.push(i.dataset.value);
	}, s);

	s.dataset.value = s.classList.contains('multiple') ? JSON.stringify(values) : (values[0] || '');

	if (s.classList.contains('multiple') && !t.classList.contains('no-value')) {
		return true;
	}

	trg(s, 'change');
	s.classList.remove('open');

	return false;
}

document.addEventListener('click', e => {
	const t = e.target;
	if (!t) return;

	// Handle disabled
	if (t.matches('.disabled')) {
		e.preventDefault();
		return;
	}

	// Handle anchor
	if (t.matches('a[href="#"]')) e.preventDefault();

	// Handle tooltip close
	if (t.matches('.tooltip .close')) trg(t.closest('.tooltip'), 'close');

	// Handle exidental clicks inside input
	if (t.matches('.dropdown .input') && !t.matches('.select')) return;

	// Handle select togle
	if (t.matches('.select') && !t.matches('a')) {
		t.classList.toggle('open');
		return;
	}

	// Handle select option
	if (t.matches('.select > a')) {
		const shouldStop = handleSelectOption(e, t);
		if (shouldStop) return;
	}

	clean_ttip(t.closest('.tooltip:not(.dropdown)'));
});

document.addEventListener('close', ({target}) => {
	if (!target?.matches('.tooltip')) return;
	// Save the value before close
	each('.select.multiple.open', el => trg(el, 'change'), target);
	requestAnimationFrame(() => target.remove());
});

window.addEventListener('DOMContentLoaded', () => {
	each('.locale', el => {
		el.innerHTML = _(el.innerHTML.trim());
	});
});

let documentLoadInProgress = false;
let documentLoadErrorShown = false;

window.onerror = function (errorMsg, url, lineNum, colNum, error) {
	if (documentLoadInProgress) {
		documentLoadErrorShown = true;
		showDocumentLoadError(error || new Error(errorMsg));
		return true;
	}

	addMsg(_('Exception: ') + errorMsg + ' (' + url + ':' + lineNum + ')', 'error');
};

class AnnotationDB {
	// An IndexedDB-based storage backend storing (filename, data) pairs
	#dbName
	#storeName
	#version
	#db

	constructor(
		dbName = 'AnnotationInterfaceIndexedDB',
		storeName = 'annotationFiles',
		version = 1
	) {
		this.#dbName = dbName;
		this.#storeName = storeName;
		this.#version = version;
		this.#db = null;
	}

	async init() {
		if (this.#db) {
			return this.#db;
		}

		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.#dbName, this.#version);

			request.onupgradeneeded = e => {
				const db = e.target.result;

				// Create schema if not already exists
				if (!db.objectStoreNames.contains(this.#storeName)) db.createObjectStore(this.#storeName, {keyPath: 'name'});
			};

			request.onsuccess = e => {
				this.#db = e.target.result;
				resolve(this.#db);
			};

			request.onerror = e => reject(e.target.error);
		});
	}

	async #transaction(mode = 'readonly') {
		await this.init();

		// Create a transaction
		return this.#db.transaction(this.#storeName, mode).objectStore(this.#storeName);
	}

	async retrieveFile(fileName) {
		const store = await this.#transaction('readonly');

		return new Promise((resolve, reject) => {
			const request = store.get(fileName);

			// Return the result or null if not found
			request.onsuccess = () => resolve(request.result?.data ?? null);
			request.onerror = e => reject(e.target.error);
		});
	}

	async storeFile(fileName, data) {
		const store = await this.#transaction('readwrite');

		return new Promise((resolve, reject) => {
			const request = store.put({name: fileName, data});

			request.onsuccess = () => resolve(data);
			request.onerror = e => reject(e.target.error);
		});
	}

	async getAllKeys() {
		const store = await this.#transaction('readonly');

		return new Promise((resolve, reject) => {
			const request = store.getAllKeys();

			request.onsuccess = () => resolve(request.result);
			request.onerror = e => reject(e.target.error);
		});
	}

	async delete(fileName) {
		const store = await this.#transaction('readwrite');

		return new Promise((resolve, reject) => {
			const request = store.delete(fileName);

			request.onsuccess = () => resolve();
			request.onerror = e => reject(e.target.error);
		});
	}

	async clear() {
		const store = await this.#transaction('readwrite');

		return new Promise((resolve, reject) => {
			const request = store.clear();

			request.onsuccess = () => resolve();
			request.onerror = e => reject(e.target.error);
		});
	}
}

class ChunkProcessor {
	// Static class used only inside of DocumentManager class
	static #parse(content, splitter) {
		const matches = [];

		// Collect all matches
		for (const [patternStr, key] of Object.entries(splitter)) {
			const regex = new RegExp(patternStr, 'gs');  // g = global, s = dotall

			let match;
			while ((match = regex.exec(content)) !== null) {
				if (match[0].length === 0) {
					regex.lastIndex = match.index + 1;
					continue;
				}

				matches.push({
					start: match.index,
					end: regex.lastIndex,
					chunk: {
						id: null,
						name: key,
						value: match[0]
					}
				});
			}
		}

		// Sort matches (Longer match first)
		matches.sort((a, b) => a.start - b.start || b.end - a.end);

		const chunks = [];
		let pos = 0;
		let id = 0;

		for (const match of matches) {
			const {start, end, chunk} = match;

			if (pos > start) {
				// Keep overlapping matches as non-owning views, without an id,
				// so their source text is not included twice when saving.
				chunks.push(chunk);
				continue;
			}

			if (pos < start) {
				// Add intermediate chunk
				chunks.push({
					id: ++id,
					name: '',
					value: content.substring(pos, start)
				});
			}

			chunk.id = ++id;
			chunks.push(chunk);
			pos = end;
		}

		if (pos < content.length) {
			chunks.push({
				id: ++id,
				name: '',
				value: content.substring(pos)
			});
		}

		return chunks;
	}

	static merge(changes, chunks) {
		const changesById = new Map(changes.map(c => [c.id, c]));

		// Go through chunks and update them
		for (const chunk of chunks) {
			const change = changesById.get(chunk.id);

			// If no change for chunk, skip it
			if (!change) continue;

			// If both changes and chunks have the same id, merge them
			if (change.append) {
				chunk.value += change.value ?? '';
			} else {
				chunk.value = change.value ?? '';
			}

			// Remove applied change
			changesById.delete(chunk.id);
		}

		if (changesById.size) {
			// If there are non-applicable changes, list them
			throw new Error(_('No matching chunk found for chunk with id: ') + [...changesById.keys()][0]);
		}

		return chunks;
	}

	static #build(chunks) {
		return chunks
			.filter(chunk => chunk.id !== null)
			.map(chunk => chunk.value)
			.join('');
	}

	static createDocument(fileName, text, template) {
		return {
			id: fileName,
			chunks: this.#parse(text, template.chunks),
			js: template.js,
			css: template.css
		};
	}

	static createBlob(chunks) {
		return new Blob([this.#build(chunks)]);
	}
}

class DocumentManager {
	#editor
	#db

	constructor(editor, oninit, db = new AnnotationDB()) {
		this.#editor = editor;
		this.#db = db;
		// Init the database
		this.#db.init().then(async () => {
			const keys = await this.#db.getAllKeys();
			oninit(keys);
		}).catch(err => addMsg(_('Database error: ') + err, 'error'));
	}

	async #readFile(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();

			reader.onload = e => resolve(e.target.result);
			reader.onerror = reject;

			reader.readAsText(file, 'UTF-8');
		});
	}

	async import(template) {
		// Import file from disk
		const file = await pickFile({extension: template.extension});
		const text = await this.#readFile(file);
		const document = ChunkProcessor.createDocument(file.name, text, template);

		await this.#db.storeFile(file.name, document);

		return document;
	}

	async open(id) {
		// Open file from IndexedDB
		const doc = await this.#db.retrieveFile(id);
		if (!doc) throw new Error(_('Document not found: ') + id);

		return doc;
	}

	async saveToIDB(chunks) {
		const data = await this.#db.retrieveFile(this.#editor.id || 0);
		if (!data) throw new Error(_('Document not found: ') + this.#editor.id);

		data.chunks = ChunkProcessor.merge(chunks, data.chunks);

		// Store the data in IndexedDB with the correct fileName (data.id)
		await this.#db.storeFile(data.id, data);

		return data;
	}

	async #store(filename, document) {
		await this.#db.storeFile(filename, document);
	}

	#download(data) {
		const blob = ChunkProcessor.createBlob(data.chunks);

		// Create a temporary object URL to download
		const url = URL.createObjectURL(blob);

		// Create a temporary <a> element to trigger the download
		const a = document.createElement('a');
		a.href = url;
		a.download = this.#editor.id;  // Original file name
		a.click();                     // Simulate click to download

		// Clean up the temporary URL
		URL.revokeObjectURL(url);
		// Clean up the temporary <a> element
		a.remove();

		addMsg(_('Document Saved'), 'success');
	}

	async export() {
		const data = await this.saveToIDB(this.#editor.chunks);
		this.#download(data);
	}

	async createDocument(filename, data, template) {
		const newData = ChunkProcessor.createDocument(filename, data, template);
		await this.#store(filename, newData);

		return newData
	}
}

class TemplateManager {
	#templateDir
	#scripts;
	#styles;

	constructor(templateDir = 'templates') {
		this.#templateDir = templateDir;
		this.#scripts = new Map();
		this.#styles = new Map();
	}

	async #loadJSON(url) {
		const response = await fetch(url);

		if (!response.ok) {
			addMsg(_('Error fetching file: ') + url, 'error');
			throw new Error(_('Failed to load ') + url);
		}

		return response.json();
	}

	async getTemplateById(templateId) {
		const templates = await this.#getAvailableTemplates();
		return templates.find(t => t.id === templateId);
	}

	async #getAvailableTemplates() {
		// Cache loaded template list
		if (!this._templates) this._templates = await this.#loadJSON(`./${this.#templateDir}/template_list.json`);
		return this._templates;
	}

	async loadTemplate(path) {
		const template = await this.#loadJSON(`./${this.#templateDir}/${path}`);

		if (typeof template.css === 'string') template.css = template.css.split(',');
		if (typeof template.js === 'string') template.js = template.js.split(',');

		template.css = template.css.map(file => `./${this.#templateDir}/${file}`);
		template.js = template.js.map(file => `./${this.#templateDir}/${file}`);

		return template;
	}

	#loadStyle(src) {
		if (this.#styles.has(src)) return this.#styles.get(src);
		if (sel(`link[href="${src}"]`)) return Promise.resolve();

		const loading = new Promise((resolve, reject) => {
			const e = document.createElement('link');
			e.rel = 'stylesheet';
			e.href = src;
			e.onload = resolve;
			e.onerror = () => {
				e.remove();
				reject(new Error(_('Failed to load ') + src));
			};
			document.head.appendChild(e);
		});

		this.#styles.set(src, loading);
		loading.catch(() => this.#styles.delete(src));
		return loading;
	}

	#loadScript(src) {
		if (this.#scripts.has(src)) return this.#scripts.get(src);
		if (sel(`script[src="${src}"]`)) return Promise.resolve();

		const loading = new Promise((resolve, reject) => {
			const e = document.createElement('script');
			e.src = src;
			e.onload = resolve;
			e.onerror = () => {
				e.remove();
				reject(new Error(_('Failed to load ') + src));
			};
			document.body.appendChild(e);
		});

		this.#scripts.set(src, loading);
		loading.catch(() => this.#scripts.delete(src));
		return loading;
	}

	async loadResources(template) {
		await Promise.all((template.css || []).map(src => this.#loadStyle(src)));

		// Preserve script order because template plug-ins may depend on earlier files.
		for (const src of template.js || []) await this.#loadScript(src);
	}

	async show(action, target, event) {
		try {
			let templates = await this.#getAvailableTemplates();

			const tt = ttip(target, event);
			tt.classList.add('dropdown');

			if (action === 'new') templates = templates.filter(t => t.new);

			for (const template of templates) {
				const a = document.createElement('a');
				a.href = '#';
				a.className = 'template-select';
				a.dataset.template = template.id;
				a.dataset.action = action;
				a.innerHTML = template.name;

				tt.appendChild(a);
			}

			return tt;

		} catch (err) {
			addMsg(_('Error loading templates: ') + err, 'error');
		}
	}
}

class Editor {
	static TYPES = {
		// This is the default editor type interface to be overloaded in plug-ins (see strategy pattern)
		_default_: {
			remove(input, chunk) {
			},

			getValue(input, chunk) {
				return input.value;
			},

			render(chunk, cid) {
				if (!chunk.id || !chunk.name) {
					const e = document.createElement('pre');
					e.innerHTML = chunk.value;
					return e;
				}
				const e = document.createElement('textarea');
				e.className = 'input';
				e.value = chunk.value;
				return e;
			}
		}
	};
	static NEW_DOCUMENT_TYPES = {};

	static getType(type) {
		// Select editor type (defined by plug-ins) fallback to the default type
		return (type ? Editor.TYPES[type] : false) || Editor.TYPES._default_;
	}

	static registerNewDocumentType(type, handler) {
		Editor.NEW_DOCUMENT_TYPES[type] = handler;
	}

	static getNewDocumentType(type) {
		return Editor.NEW_DOCUMENT_TYPES[type];
	}

	#onchange_callback
	#restore
	#restoreHidden
	#reloadRequested
	#pendingSaves
	#saveFailed

	constructor(dom, onchange) {
		this.dom = dom;
		this.#onchange_callback = onchange;
		this.chunks = [];
		this.#restore = null;
		this.#restoreHidden = null;
		this.#reloadRequested = false;
		this.#pendingSaves = 0;
		this.#saveFailed = false;

		// Mark the container as editor
		dom.classList.add('editor');

		// Initially disable save button since no file is open
		disable('.ed-save', false);

		// Rerender chunk when changed
		evt(dom, 'change', e => {
			if (e.target.matches('[data-cid]')) this.onchange([Number(e.target.dataset.cid)]);
		});

		evt(dom, 'click', e => {
			const t = e.target;
			if (!t) return;

			// Render the actual page identified by pagenumber
			if (t.matches('[data-render]')) {
				this.render([Number(t.dataset.render)]);
				return;
			}

			// Plus one behaviour
			if (t.matches('.plus-one')) {
				const cid = Number(t.dataset.next);
				const d = this.renderChunk(cid);

				if (d) dom.insertBefore(d, t);

				if (this.chunks.length > cid + 1) {
					t.dataset.next = String(cid + 1);
				} else {
					t.remove();
				}
			}
		});

		// Unsaved changes warning
		window.addEventListener('beforeunload', e => {
			if (this.#hasChanges()) {
				e.preventDefault();
				e.returnValue = _('There are unsaved changes! Are you sure?');
				return e.returnValue;
			}
		});
	}

	load(data, store_filler) {
		// Load data
		if (!data.id) return;

		this.markAllSaved();

		// Reset the editor
		this.#reset(data, store_filler);

		// Clear the UI
		this.dom.innerHTML = '';
		clean_ttip(this.dom);

		this.#finishLoad();
	}

	requestReload() {
		this.#reloadRequested = true;
	}

	applySavedDocument(data) {
		if (this.#reloadRequested) {
			this.#reloadRequested = false;
			this.load(data, false);
		}

		this.restoreView();
	}

	markSaveStarted() {
		++this.#pendingSaves;
	}

	markSaveSucceeded() {
		this.#pendingSaves = Math.max(0, this.#pendingSaves - 1);
	}

	markSaveFailed() {
		this.#pendingSaves = Math.max(0, this.#pendingSaves - 1);
		this.#saveFailed = true;
	}

	markAllSaved() {
		this.#pendingSaves = 0;
		this.#saveFailed = false;
	}

	#finishLoad() {
		// Notify others
		trg(this.dom, 'document-loaded');

		// Render the UI
		const hids = Object.keys(this.hidden);
		this.renderHidden(hids);
		this.render([0]);
	}

	#reset(data, store_filler) {
		// Reset the editor to a clean state
		this.id = data.id;
		this.eol = false;
		this.hidden = [];
		this.chunks = [];

		// Separate chunks to visible and hidden
		for (const chunk of data.chunks || []) {
			if (!store_filler && !chunk.name) continue;

			// Store original line endings to preserve them later
			if (!this.eol) {
				const m = chunk.value.match(/(\r?\n|\r)/);
				if (m) this.eol = m[1];
			}

			// Decide if the current chunk is to be shown or hidden
			if (chunk.name?.startsWith('.')) {
				this.hidden.push(chunk);
			} else {
				this.chunks.push(chunk);
			}
		}

		// Fallback line ending
		if (!this.eol) this.eol = '\n';
	}

	#hasChanges() {
		if (this.#pendingSaves || this.#saveFailed) return true;

		// Detect changes by comparing every visible chunk (and normalising line endings)
		let changed = false;

		each('[data-cid]', i => {
			const chunk = this.chunks[i.dataset.cid];
			const c_type = Editor.getType(chunk.name);

			if (chunk.id && c_type.getValue && chunk.value !== c_type.getValue(i, chunk).replace(/(\r?\n|\r)/g, this.eol))
				changed = true;
		}, this.dom);

		return changed;
	}

	confirmDiscardChanges(callback) {
		const cleanupChunks = () => {
			each('[data-cid]', i => {
				const c = this.chunks[i.dataset.cid];
				const t = Editor.getType(c.name);

				t.remove?.(i, c);
			}, this.dom);

			// Call the callback
			callback();
		};

		if (!this.#hasChanges()) {
			cleanupChunks();
		} else {
			addConfirm(_('There are unsaved changes! Are you sure?'), cleanupChunks);
		}
	}

	onchange(cids, hdata) {
		// Collect changes/differences and call the callback on them

		// Save the current visible and hidden elements
		this.#restore = this.getVisible();

		const hiddenData = hdata || {};
		const hids = Object.keys(hiddenData);
		if (hids.length) this.#restoreHidden = hids;

		// Collect changed visible chunks by change id (derived from chunk index)
		const chunks = {};
		const values = {};
		for (const cid of cids) {
			const chunk = this.chunks[cid];
			const chunk_type = Editor.getType(chunk.name);

			if (chunk_type.getValue) {
				const chunk_value = chunk_type.getValue(sel(`[data-cid="${cid}"]`, this.dom), chunk);
				this.#recordChangeForChunk(chunk, chunk_value, `c${cid}`, chunks, values);
			}
		}

		// Collect changed hidden chunks by change id (derived from chunk index)
		for (const hid in hiddenData) {
			this.#recordChangeForChunk(this.hidden[hid], hiddenData[hid], `h${hid}`, chunks, values);
		}

		// If there were changes commit them
		if (Object.keys(chunks).length > 0) this.#onchange_callback(chunks, values);
	}

	#recordChangeForChunk(chunk, chunk_value, key, chunks, values) {
		if (!chunk.id) return;
		// Normalise the line ending to ensure comparison isn't affected
		const value = chunk_value.replace(/(\r?\n|\r)/g, this.eol);

		// Record the change if there is any
		if (chunk.value !== value) {
			chunks[key] = chunk;
			values[key] = value;
		}
	}

	render(cids) {
		// Clear the current view
		this.dom.innerHTML = '';
		clean_ttip(this.dom);

		if (!cids.length) return;

		// Render the paginator
		this.dom.appendChild(this.#renderPaginator(cids[0]));

		// Render the chunks
		for (const cid of cids) this.dom.appendChild(this.renderChunk(cid));

		// Create +1 sentence button
		const lastCid = cids[cids.length - 1];
		if (this.chunks.length > lastCid + 1) {
			const a = document.createElement('a');
			a.href = '#';
			a.className = 'btn plus-one';
			a.dataset.next = String(lastCid + 1);
			a.innerHTML = _('Show +1 sentence');

			this.dom.appendChild(a);
		}
	}

	renderHidden(hids) {
		// Tell the templates to render the hidden chunks in hids
		this.dom.dispatchEvent(new CustomEvent('change-hidden', {detail: hids}));
	}

	renderChunk(cid) {
		// Delegates rendering to the specific editor type's render() function
		const chunk = this.chunks[cid];
		if (!chunk) return null;

		const e = Editor.getType(chunk.name).render(chunk, cid);
		// Note which chunk this DOM element represents
		if (e) e.dataset.cid = cid;

		return e;
	}

	#getPaginationItems(current, max) {
		// Create pagination items without formatting
		const items = [];

		if (current > 2) items.push({label: '(1) <<', page: 0});

		if (current > 1) items.push({label: '<', page: current - 2});

		if (current > 4) items.push({label: '...', disabled: true});

		for (let p = Math.max(1, current - 3); p <= Math.min(max, current + 3); ++p) {
			items.push({
				label: String(p),
				page: p - 1,
				active: p === current
			});
		}

		if (max > current + 3) items.push({label: '...', disabled: true});

		if (max > current) items.push({label: '>', page: current});

		if (max > current + 1) items.push({label: `>> (${max})`, page: max - 1});

		return items;
	}

	#renderPaginator(cid) {
		// Define formatting for pagination items
		const max = (this.chunks || []).length;
		if (max < 1) return;

		const items = this.#getPaginationItems(cid + 1, max);

		const ul = document.createElement('ul');
		ul.className = 'pagination';

		for (const item of items) {
			const li = document.createElement('li');

			if (item.active) li.classList.add('active');

			if (item.disabled) li.classList.add('disabled');

			const a = document.createElement('a');

			if (!item.disabled) {
				a.href = '#';
				a.className = 'btn';
				a.dataset.render = item.page;
			}

			a.textContent = item.label;

			li.appendChild(a);
			ul.appendChild(li);
		}

		return ul;
	}

	getVisible() {
		// Get visible chunk indices
		return Array.from(this.dom.querySelectorAll('[data-cid]'), el => Number(el.dataset.cid));
	}

	restoreView() {
		// Restore visible and hidden chunks if a saved state exists and clear the state
		if (this.#restore) {
			this.render(this.#restore);
			this.#restore = null;
		}

		if (this.#restoreHidden) {
			this.renderHidden(this.#restoreHidden);
			this.#restoreHidden = null;
		}
	}
}

class History {
	static #BACKUP_INTERVAL = 30000;
	static #MAX_NUMBER = 10;
	#name
	#max
	#onchange
	#data
	#backup_timestamp

	constructor(name, max = History.#MAX_NUMBER, onchange = null) {
		this.#name = name;
		// Implicit name convention for selector
		this.#max = max;
		this.#onchange = onchange;
		this.#data = JSON.parse(localStorage[name] ?? '[]');
		this.#backup_timestamp = Date.now();
	}

	#onHistChange() {
		clearTimeout(this.timer);
		// Try to save at most every History.#BACKUP_INTERVAL ms but never sooner than 200ms
		const nextAllowed = (this.#backup_timestamp || 0) + History.#BACKUP_INTERVAL - Date.now();
		this.timer = setTimeout(() => this.#backup(), Math.max(200, nextAllowed));
		this.#onchange?.(this);
	}

	#backup() {
		this.#backup_timestamp = Date.now();
		const d = structuredClone(this.#data);
		// Try to save progressively smaller versions (dropping the oldest entries) if storage quota fails
		while (d.length) {
			try {
				localStorage[this.#name] = JSON.stringify(d);
				break;
			} catch (e) {
				console.error('Could not save data into localStorage');
				d.pop();
			}
		}
		if (d.length === 0) localStorage[this.#name] = JSON.stringify(d);
	}

	get length() {
		return this.#data.length;
	}

	add(data) {
		// Add new data while maintaining maximum size
		this.#data = this.#data.slice(0, this.#max - 1);
		this.#data.unshift(structuredClone(data));
		this.#onHistChange();
	}

	get(index = 0, peek = false) {
		// Return element by index (pop or peek, the latest element is 0)
		const data = this.#data[index];
		if (data && !peek) {
			this.#data.splice(index, 1);
			this.#onHistChange();
		}

		return data;
	}

	moveToTop(value) {
		const index = this.#data.indexOf(value);
		if (index >= 0) this.#data.splice(index, 1);
		this.add(value);
	}

	walk(callback) {
		this.#data.forEach(callback);
	}

	clear() {
		this.#data = [];
		this.#onHistChange();
	}
}

class UndoManager {
	#editor;
	#hist;
	#save;

	constructor(editor, hist, save) {
		this.#editor = editor;
		this.#hist = hist;
		this.#save = save;
	}

	#createReverseHistoryEntry(data) {
		const chunks = {};
		const values = {};

		let valid = true;
		this.#forEachHistoryChunk(data, item => {
			if (!valid) return;

			// Verify that the document has not changed since the history entry was created
			if (!item.current || item.current.value !== item.expected) {
				valid = false;
				return;
			}

			// Build the reverse history entry that	will be pushed onto the opposite stack (undo <-> redo)
			chunks[item.cid] = item.current;
			values[item.cid] = item.target.value;
		});
		return valid ? {chunks, values} : false;
	}

	#applyChunks(data) {
		const tosave = [];
		const hidden = [];

		this.#forEachHistoryChunk(data, item => {
			// Apply the item to the appropriate category (visible or hidden)
			this.#editor[item.store][item.index] = item.target;

			// Changes should be saved
			tosave.push(item.target);

			// Hidden sections that need rerendering
			if (item.store === 'hidden') hidden.push(item.index);
		});

		return {tosave, hidden};
	}

	#forEachHistoryChunk(data, callback) {
		for (const cid in data.chunks) {
			const hidden = cid[0] === 'h';
			const store = hidden ? 'hidden' : 'chunks';
			const index = cid.substring(1);

			// Provide metadata about each chunk to the callback
			callback({
				cid,
				store,
				index,
				current: this.#editor[store][index],
				target: data.chunks[cid],
				expected: data.values[cid]
			});
		}
	}

	async #applyHistoryEntry(data, visible, from, to) {
		this.#editor.render([]);

		// Create the corresponding reverse entry
		const reverseEntry = this.#createReverseHistoryEntry(data);

		if (!reverseEntry) {
			from.clear();
			to.clear();

			addMsg(_('Document changed outside, history action is disabled'), 'error');

			this.#editor.render(visible);
			return;
		}

		// Apply a single history entry to the editor
		const {tosave, hidden} = this.#applyChunks(data);

		try {
			await this.#save(tosave);
		} catch (err) {
			// Keep the editor consistent with storage if persistence fails.
			this.#applyChunks(reverseEntry);
			this.#editor.render(visible);
			throw err;
		}

		to.add({
			id: data.id,
			chunks: reverseEntry.chunks,
			values: reverseEntry.values,
			cids: visible
		});

		if (hidden.length) {
			this.#editor.renderHidden(hidden);
		}

		this.#editor.render(data.cids);
	}

	async #apply(reverse) {
		const from = this.#hist[reverse ? 'redo' : 'undo'];
		const to = this.#hist[reverse ? 'undo' : 'redo'];

		// Get history (undo or redo) if any
		const data = from.get();
		if (!data) return;

		try {
			if (data.id !== this.#editor.id) {
				from.clear();
				to.clear();
				return;
			}

			const visible = this.#editor.getVisible();
			await this.#applyHistoryEntry(data, visible, from, to);
		} catch (err) {
			from.add(data);
			throw err;
		}
	}

	undo() {
		return this.#apply(false);
	}

	redo() {
		return this.#apply(true);
	}

}

const hist = {
	recent: new History('ed_recent', undefined,
		h => disable('.ed-recent', !!h.length)),
	undo: new History('ed_undo', undefined,
		h => disable('.ed-undo', !!h.length)),
	redo: new History('ed_redo', undefined,
		h => disable('.ed-redo', !!h.length))
};
const editor = new Editor(sel('#editor'), (chunks, values) => {
	// Store previous values in Undo history
	hist.undo.add({
		id: editor.id,
		chunks: chunks,
		values: values,
		cids: editor.getVisible()
	});
	// Any new edit invalidates Redo history
	hist.redo.clear();
	// Apply changes to chunk objects
	const tosave = [];
	for (const cid in chunks) {
		chunks[cid].value = values[cid];
		tosave.push(chunks[cid]);
	}
	// Persist changes
	save(tosave).catch(err => addMsg(err.message, 'error'));
});
const documents = new DocumentManager(editor, async (keys) => {
	try {
		hist.recent.clear();
		keys.forEach(key => hist.recent.add(key));
	} catch (err) {
		addMsg(_('Database error: ') + err, 'error');
	}
});
const undoManager = new UndoManager(editor, hist, save);
const templates = new TemplateManager();

async function displayDocument(data) {
	await templates.loadResources(data);

	documentLoadInProgress = true;
	documentLoadErrorShown = false;

	try {
		// Undo and redo only apply to edits made since this document was loaded.
		hist.undo.clear();
		hist.redo.clear();
		editor.load(data, false);
		if (documentLoadErrorShown) throw createReportedDocumentLoadError();
		hist.recent.moveToTop(editor.id);

		// Enable save button
		disable('.ed-save', !!editor.id);
		editor.restoreView();
		if (documentLoadErrorShown) throw createReportedDocumentLoadError();
	} finally {
		documentLoadInProgress = false;
	}

	trg(editor.dom, 'document-ready');
	addMsg(_('Document Loaded'), 'success');
}

async function openDocument(id) {
	const data = await documents.open(id);
	await displayDocument(data);
}

async function importDocument(templateInfo) {
	const loadedTemplate = await templates.loadTemplate(templateInfo.path);
	const data = await documents.import(loadedTemplate);
	await displayDocument(data);
}

function getDocumentLoadErrorMessage(err) {
	const message = err?.message || String(err || '');

	if (err?.documentLoadErrorReported) return null;
	if (message === 'No file chosen' || message === _('No file chosen')) return null;
	if (message.startsWith(_('Document not found: ')) || message.startsWith('Document not found: ')) return message;
	if (message.startsWith(_('Failed to load ')) || message.startsWith('Failed to load ')) {
		return _('Could not load the selected template. Please check that its files are available.');
	}

	return _('Could not open the document. The file content is invalid or does not match the selected template.');
}

function createReportedDocumentLoadError() {
	const err = new Error('Document load error already reported');
	err.documentLoadErrorReported = true;
	return err;
}

function showDocumentLoadError(err) {
	const message = getDocumentLoadErrorMessage(err);
	if (!message) return;

	console.error('Error during file open process:', err);
	addMsg(message, 'error');
}

async function save(chunks) {
	const documentId = editor.id;
	let persisted = false;
	editor.markSaveStarted();

	try {
		const data = await documents.saveToIDB(chunks);
		persisted = true;

		if (editor.id === documentId) {
			editor.markSaveSucceeded();
			addMsg(_('Document Saved'), 'success');
			editor.applySavedDocument(data);
		}
	} catch (err) {
		if (!persisted && editor.id === documentId) editor.markSaveFailed();
		throw new Error(_('Error saving: ') + (err.message || err));
	}
}

async function createNewDocument(templateInfo) {
	// Load the resources that register this template's creation handler.
	const template = await templates.loadTemplate(templateInfo.path);
	await templates.loadResources(template);

	const handler = Editor.getNewDocumentType(templateInfo.id);
	if (!handler) {
		addMsg(_('New document creation not supported for this template'), 'error');
		return;
	}

	const result = await handler();
	if (!result) return;

	// Process the source returned by the plug-in, then save and render the document.
	const [filename, data] = result;
	const newData = await documents.createDocument(filename, data, template);
	await displayDocument(newData);
}

evt('.ed-open', 'click', e => {
	templates.show('open', e.target, e).catch(err => addMsg(err.message, 'error'));
	e.stopPropagation();
});
evt('.ed-new', 'click', e => {
	templates.show('new', e.target, e).catch(err => addMsg(err.message, 'error'));
	e.stopPropagation();
});
evt('.ed-recent', 'click', e => {
	const t = ttip(e.target, e);
	hist.recent.walk((data, id) => {
		const a = document.createElement('a');
		a.href = '#';
		a.dataset.open = id;
		// Use basename of the file
		a.innerHTML = data.split('\t')[0].replace(/^.*?([^\\\/]+)$/, '$1');
		t.appendChild(a);
	});
	t.classList.add('dropdown');
	e.stopPropagation();
});
evt('.ed-save', 'click', e => {
	if (e.target.classList.contains('disabled')) return;
	documents.export()
		.then(() => editor.markAllSaved())
		.catch(err => addMsg(err.message, 'error'));
});
evt('.ed-undo', 'click', () => {
	undoManager.undo().catch(err => addMsg(err.message, 'error'));
});
evt('.ed-redo', 'click', () => {
	undoManager.redo().catch(err => addMsg(err.message, 'error'));
});
evt('.ed-exit', 'click', () => {
	if (confirm(_('Do you want to exit?'))) {
		window.location.href = 'about:blank';
	}
});

evtDelegated(document, '[data-open]', 'click', function () {
	editor.confirmDiscardChanges(() => {
		const recentDocumentFilename = hist.recent.get(Number(this.dataset.open), true);
		openDocument(recentDocumentFilename).catch(showDocumentLoadError);
	});
});

evtDelegated(document, '.template-select', 'click', async function () {
	try {
		const action = this.dataset.action;

		// Find and load the selected template
		const templateInfo = await templates.getTemplateById(this.dataset.template)
		if (!templateInfo) return;

		trg(this.closest('.tooltip'), 'close');

		// Execute action on template
		if (action === 'open') {
			editor.confirmDiscardChanges(() => {
				importDocument(templateInfo).catch(showDocumentLoadError);
			});
		} else if (action === 'new') {
			editor.confirmDiscardChanges(() => {
				createNewDocument(templateInfo).catch(err => addMsg(_('Failed to load ') + err, 'error'));
			});
		}

	} catch (err) {
		addMsg(_('Failed to load ') + err, 'error');
	}
});
