function handleSelectOption(e, t) {
	const s = t.parentNode;

	if (!s.classList.contains('open')) {
		s.classList.add('open');
		return true;
	}

	if (!t.classList.contains('no-value')) {
		if (!s.classList.contains('multiple')) each('.selected', i => i.classList.remove('selected'), s);
		t.classList.toggle('selected');
	}

	const values = [];
	each('.selected', i => {
		if (i.dataset.value) values.push(i.dataset.value);
	}, s);

	s.dataset.value = s.classList.contains('multiple') ? JSON.stringify(values) : (values[0] || '');

	if (s.classList.contains('multiple') && !t.classList.contains('no-value')) return true;

	trg(s, 'change');
	s.classList.remove('open');

	return false;
}

document.addEventListener('click', e => {
	const t = e.target;
	if (!t) return;

	// Handle disabled
	if (t.matches('.disabled')) return e.preventDefault();

	// Handle anchor
	if (t.matches('a[href="#"]')) e.preventDefault();

	// Handle tooltip close
	if (t.matches('.tooltip .close')) trg(t.closest('.tooltip'), 'close');

	// Handle accidental clicks inside input
	if (t.matches('.dropdown .input') && !t.matches('.select')) return;

	// Handle select togle
	if (t.matches('.select') && !t.matches('a')) {
		t.classList.toggle('open');
		return;
	}

	// Handle select option
	if (t.matches('.select > a') && handleSelectOption(e, t)) return;

	clean_ttip(t.closest('.tooltip:not(.dropdown)'));
});

document.addEventListener('close', ({target}) => {
	if (!target?.matches('.tooltip')) return;

	// Trigger open multi-select change handlers before removing the tooltip
	each('.select.multiple.open', el => trg(el, 'change'), target);

	// Let the close event finish while the tooltip is still in the DOM
	requestAnimationFrame(() => target.remove());
});

window.addEventListener('DOMContentLoaded', () => each('.locale', el => el.innerHTML = _(el.innerHTML.trim())));

window.onerror = (errorMsg, url, lineNum, colNum, error) =>
	addMsg(_('Exception: ') + errorMsg + ' (' + url + ':' + lineNum + ')', 'error');

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
		if (this.#db) return this.#db;

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
		const transaction = this.#db.transaction(this.#storeName, mode);

		return {
			transaction,
			store: transaction.objectStore(this.#storeName),
			done: this.#waitForTransaction(transaction)
		};
	}

	#waitForTransaction(transaction) {
		return new Promise((resolve, reject) => {
			const fail = e => reject(
				transaction.error || e.target.error || new DOMException('Transaction aborted', 'AbortError')
			);

			transaction.oncomplete = () => resolve();
			transaction.onerror = fail;
			transaction.onabort = fail;
		});
	}

	async retrieveFile(fileName) {
		const {store, done} = await this.#transaction();
		const request = store.get(fileName);

		await done;

		// Return the result or null if not found
		return request.result?.data ?? null;
	}

	async storeFile(fileName, data) {
		const {store, done} = await this.#transaction('readwrite');
		store.put({name: fileName, data});

		return done;
	}

	async updateFile(fileName, updater) {
		const {transaction, store, done} = await this.#transaction('readwrite');
		let updatedData;
		let updateError = null;

		const request = store.get(fileName);
		request.onsuccess = () => {
			try {
				// Throw inside of try for uniform handling of errors
				if (!request.result) throw new Error(_('Document not found: ') + fileName);

				updatedData = updater(request.result.data);
				store.put({name: fileName, data: updatedData});
			} catch (err) {
				updateError = err;
				transaction.abort();
			}
		};

		try {
			await done;
		} catch (err) {
			throw updateError || err;
		}

		return updatedData;
	}

	async getAllKeys() {
		const {store, done} = await this.#transaction();
		const request = store.getAllKeys();

		await done;

		return request.result;
	}

	async delete(fileName) {
		const {store, done} = await this.#transaction('readwrite');
		store.delete(fileName);

		return done;
	}

	async clear() {
		const {store, done} = await this.#transaction('readwrite');
		store.clear();

		return done;
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
					// Chunk splitters must consume source text. Advancing past an empty match avoids an exec() loop,
					// but can also skip a real chunk starting at the same offset, so fail loudly instead
					throw new Error(_('The selected template could not split this file into editable sections. ' +
						'Check that you chose the right template and that the file is not empty or missing required content.'
					), {cause: new Error(`Chunk splitter matched an empty string at offset ${match.index}: ${patternStr}`)});
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
				// Keep overlapping matches as non-owning views w/o id, so their source text is not included twice when saving
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

	static createDocument(fileName, text, chunks) {
		return {
			id: fileName,
			chunks: this.#parse(text, chunks),
		};
	}

	static createBlob(chunks) {
		return new Blob([this.#build(chunks)]);
	}
}

class SaveQueue {
	#saveQueue
	#pendingSaves
	#failedSaves

	constructor() {
		this.#saveQueue = Promise.resolve();
		this.#pendingSaves = new Map();
		this.#failedSaves = new Set();
	}

	async enqueue(fileName, saveFn) {
		// Do not let one rejected promise poison the queue tail: otherwise every later save
		// would fail without trying. A single IndexedDB transaction is still all-or-nothing;
		// this is about separate queued save attempts. Example: storage has A0/B0 and save #1
		// captures A1 but fails. If save #2 later captures A2 for the same chunk and succeeds,
		// storage ends at A2/B0 because each save carries the full captured value for its chunks.
		// If save #2 captures only B1, storage becomes A0/B1; A1 is still not persisted, the
		// original caller saw the rejection, and failedSaves keeps the document in the
		// unsaved-warning state.
		const readyToSave = this.#saveQueue.catch(() => {});
		const saveToken = this.#markSavePending(fileName);
		// Chain the callback to be executed when previous ones have finished
		const persistence = readyToSave.then(saveFn);
		this.#saveQueue = persistence.finally(() => this.#markSaveFinished(fileName, saveToken));

		try {
			return await persistence;
		} catch (err) {
			this.#markSaveFailed(fileName);
			throw err;
		}
	}

	#markSavePending(fileName) {
		// Create a unique token for this save operation
		const saveToken = Symbol(fileName);
		// Get the set of pending saves for this file
		let pendingSaves = this.#pendingSaves.get(fileName);
		// Create the set if this is the first pending save
		if (!pendingSaves) {
			pendingSaves = new Set();
			this.#pendingSaves.set(fileName, pendingSaves);
		}
		// Add this save operation to the set
		pendingSaves.add(saveToken);

		// Return the token so it can be removed later
		return saveToken;
	}

	#markSaveFinished(fileName, saveToken) {
		// Get the set of pending saves for the file
		const pendingSaves = this.#pendingSaves.get(fileName);
		// If the file isn't being tracked, do nothing
		if (!pendingSaves) return;

		// Remove this particular save operation
		pendingSaves.delete(saveToken);
		// Remove the file entry if no saves remain
		if (!pendingSaves.size) this.#pendingSaves.delete(fileName);
	}

	#markSaveFailed(fileName) {
		this.#failedSaves.add(fileName);
	}

	clearFailures(fileName) {
		if (!fileName) throw new TypeError('clearFailures requires a fileName');

		this.#failedSaves.delete(fileName);
	}

	clearAll() {
		this.#pendingSaves.clear();
		this.#failedSaves.clear();
	}

	hasUnfinishedSave(fileName) {
		// Get pending saves for the file
		const pendingSaves = this.#pendingSaves.get(fileName);

		// If the filename is provided does it have pending or failed saves?
		return !!fileName && (!!pendingSaves?.size || this.#failedSaves.has(fileName));
	}
}

class DocumentManager {
	#editor
	#db
	#saveQueue

	constructor(editor, oninit, db = new AnnotationDB()) {
		this.#editor = editor;
		this.#db = db;
		this.#saveQueue = new SaveQueue();

		// Init the database
		this.#db.init().then(async () => {
			const keys = await this.#db.getAllKeys();
			oninit(keys);
		}).catch(err => addMsg(_('Database error: ') + err, 'error'));
	}

	async import(template) {
		// Import file from disk
		const file = await pickFile({extension: template.extension});
		const text = await readFile(file);

		return this.createDocument(file.name, text, template);
	}

	async createDocument(filename, data, template) {
		const newData = ChunkProcessor.createDocument(filename, data, template.chunks);
		// Inject template information to be able to display the document later
		newData.js = template.js;
		newData.css = template.css;
		await this.#db.storeFile(filename, newData);

		return newData;
	}

	async openFromIDB(fileName) {
		// Open file from IndexedDB
		const doc = await this.#db.retrieveFile(fileName);
		if (!doc) throw new Error(_('Document not found: ') + fileName);

		return doc;
	}

	async #saveToIDB(fileName, changes) {
		return this.#db.updateFile(fileName, data => {
			data.chunks = ChunkProcessor.merge(changes, data.chunks);

			return data;
		});
	}

	async persist(fileName, chunks) {
		// Capture the requested values before this save enters the queue
		// The editor may mutate its chunk objects while earlier saves are still running
		const changes = chunks.map(chunk => ({...chunk}));

		// Take care of the enqueuing of the save operation and handle the failures with the single save queue
		return this.#saveQueue.enqueue(fileName, async () => {
			try {
				return await this.#saveToIDB(fileName, changes);
			} catch (err) {
				throw new Error(_('Error saving: ') + (err.message || err));
			}
		});
	}

	clearSaveState() {
		this.#saveQueue.clearAll();
	}

	hasUnfinishedSave() {
		return this.#saveQueue.hasUnfinishedSave(this.#editor.id) || this.#editor.hasChanges();
	}

	download(data) {
		const fileName = data.id || this.#editor.id;
		this.#saveQueue.clearFailures(fileName);

		const blob = ChunkProcessor.createBlob(data.chunks);
		downloadAsFile(fileName, blob);
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
		let response;
		try {
			response = await fetch(url);
		} catch (err) {
			throw new Error(_('Could not load template file: ') + url, {cause: err});
		}

		if (!response.ok) {
			const message = `${response.status} ${response.statusText}`.trim();
			throw new Error(_('Could not load template file: ') + url, {cause: new Error(message)});
		}

		try {
			return await response.json();
		} catch (err) {
			throw new Error(_('Could not load template file: ') + url, {cause: err});
		}
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
			e.onerror = event => {
				e.remove();
				reject(new Error(_('Could not load template file: ') + src, {cause: event}));
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
			e.onerror = event => {
				e.remove();
				reject(new Error(_('Could not load template file: ') + src, {cause: event}));
			};
			document.body.appendChild(e);
		});

		this.#scripts.set(src, loading);
		loading.catch(() => this.#scripts.delete(src));
		return loading;
	}

	async loadResources(template) {
		await Promise.all((template.css || []).map(src => this.#loadStyle(src)));

		// Preserve script order because template templates may depend on earlier files
		for (const src of template.js || []) await this.#loadScript(src);
	}

	async show(action, target, event) {
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
	}
}

class Editor {
	static TYPES = {
		// This is the default editor type interface to be overloaded in templates (see strategy pattern)
		_default_: {
			remove(input, chunk) {
			},

			getValue(input, chunk) {
				return input.value;
			},

			render(chunk, cid) {
				if (!chunk.id || !chunk.name) {
					// Read-only fallback for non-owning or filler chunks; <pre> preserves text layout
					const e = document.createElement('pre');
					e.innerHTML = chunk.value;
					return e;
				}

				// Editable fallback for named chunks when the template has no custom renderer
				const e = document.createElement('textarea');
				e.className = 'input';
				e.value = chunk.value;
				return e;
			}
		}
	};
	static NEW_DOCUMENT_TYPES = {};

	static #getType(type) {
		// Select editor type (defined by templates) fallback to the default type
		return (type ? Editor.TYPES[type] : false) || Editor.TYPES._default_;
	}

	static registerNewDocumentType(type, handler) {
		Editor.NEW_DOCUMENT_TYPES[type] = handler;
	}

	static getNewDocumentType(type) {
		return Editor.NEW_DOCUMENT_TYPES[type];
	}

	#onchangeCallback
	#restore
	#restoreHidden

	constructor(dom, onchangeFun) {
		this.dom = dom;
		this.#onchangeCallback = onchangeFun;
		this.id = null;
		this.eol = null;
		this.hidden = [];
		this.chunks = [];
		this.#restore = null;
		this.#restoreHidden = null;

		// Mark the container as editor
		dom.classList.add('editor');

		// Initially disable save button since no file is open
		disable('.ed-export', false);

		// Rerender chunk when changed
		evt(dom, 'change', e => {
			if (e.target.matches('[data-cid]')) this.onchange([Number(e.target.dataset.cid)]);
		});

		evt(dom, 'click', e => {
			const t = e.target;
			if (!t) return;

			// Render the actual page identified by pagenumber
			if (t.matches('[data-render]')) return this.renderPage([Number(t.dataset.render)]);

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

	}

	#clearChunksView() {
		// Clean up rendered chunks. Let templates release per-render state before their DOM disappears
		each('[data-cid]', input => {
			const chunk = this.chunks[input.dataset.cid];
			if (!chunk) return;

			// Call the template's remove() function on the chunk to clear it's state
			const type = input._editorType || Editor.#getType(chunk.name);
			type.remove?.(input, chunk);
		}, this.dom);

		this.dom.innerHTML = '';
		clean_ttip(this.dom);
	}

	load(data) {
		const loadErrorMessage =
			_('Could not open the document. The file content is invalid or does not match the selected template.');

		if (!data?.id) throw new Error(loadErrorMessage, {cause: new Error(_('Missing document id'))});

		try {
			// Clear the old document view before #resetEditorState(data.id, data.chunks), while the previous
			// document model is still available for template cleanup hooks
			this.#clearChunksView();

			// Templates can clear per-document UI (e.g. header and footer) before the new document is rendered
			dispatchAppEvent(this.dom, new Event('document-before-render', {bubbles: true}));

			// Reset the editor (id, chunks, hidden, eol, pending restores)
			this.#resetEditorState(data.id, data.chunks);

			// Initialize all template-owned hidden UI (headers, annotations, legends)
			const hids = Object.keys(this.hidden);

			// Render the first page of the document on the clean state (hidden, chunks, paginator, +1 sentence)
			this.#renderPageContents([0], hids);

			// The editor UI is rendered and ready for template-owned setup
			dispatchAppEvent(this.dom, new Event('document-ready', {bubbles: true}));
		} catch (err) {
			throw new Error(loadErrorMessage, {cause: err});
		}
	}

	renderPage(cids, hids = []) {
		// Clear the current view
		this.#clearChunksView();

		// Render the current page of the document on the clean state (hidden, chunks, paginator, +1 sentence)
		this.#renderPageContents(cids, hids);
	}

	#renderPageContents(cids, hids = []) {
		// Tell the templates to render the hidden chunks in hids
		if (hids.length) dispatchAppEvent(this.dom, new CustomEvent('change-hidden', {detail: hids}));

		if (!cids.length) return;

		// Render the chunks
		for (const cid of cids) this.dom.appendChild(this.renderChunk(cid));

		// Render the paginator
		this.dom.appendChild(this.#renderPaginator(cids[0]));

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

	renderChunk(cid) {
		// Delegates rendering to the specific editor type's render() function
		const chunk = this.chunks[cid];
		if (!chunk) return null;

		const type = Editor.#getType(chunk.name);
		const e = type.render(chunk, cid);
		// Note which chunk this DOM element represents
		if (e) {
			e.dataset.cid = cid;
			e._editorType = type;
		}

		return e;
	}

	getVisible() {
		// Get visible chunk indices
		return Array.from(this.dom.querySelectorAll('[data-cid]'), el => Number(el.dataset.cid));
	}

	#resetEditorState(dataId, chunks) {
		// Reset the editor to a clean state
		this.id = dataId;
		this.eol = null;
		this.hidden = [];
		this.chunks = [];
		this.#restore = null;
		this.#restoreHidden = null;

		// Separate chunks to visible and hidden
		for (const chunk of chunks || []) {
			// Filler chunks preserve source text between editable sections in storage,
			// but the editor only renders chunks handled by the selected template
			if (!chunk.name) continue;

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

	hasChanges() {
		// Detect changes by comparing visible chunks and stop at the first difference
		for (const i of find('[data-cid]', this.dom)) {
			const chunk = this.chunks[i.dataset.cid];
			const c_type = Editor.#getType(chunk.name);

			if (!chunk.id || !c_type.getValue) continue;

			const value = c_type.getValue(i, chunk).replace(/(\r?\n|\r)/g, this.eol);
			if (chunk.value !== value) return true;
		}

		return false;
	}

	onchange(cids, hdata) {
		// Collect changes/differences and call the callback on them

		const hiddenData = hdata || {};
		const hids = Object.keys(hiddenData);

		// Collect changed VISIBLE chunks by change id (derived from chunk index) into a batch
		const chunks = {};
		const values = {};
		for (const cid of cids) {
			const chunk = this.chunks[cid];
			const chunk_type = Editor.#getType(chunk.name);

			if (chunk_type.getValue) {
				const chunk_value = chunk_type.getValue(sel(`[data-cid="${cid}"]`, this.dom), chunk);
				this.#recordChangeForChunk(chunk, chunk_value, `c${cid}`, chunks, values);
			}
		}

		// Collect changed HIDDEN chunks by change id (derived from chunk index) into a batch
		for (const [hid, hidValue] of Object.entries(hiddenData))
			this.#recordChangeForChunk(this.hidden[hid], hidValue, `h${hid}`, chunks, values);

		// If there were visible or hidden changes commit them at once (to get a single undo entry)
		if (Object.keys(chunks).length > 0) {
			// Remember the currently visible chunk ids so the post-save render keeps the same viewport
			this.#restore = this.getVisible();

			if (hids.length) {
				// Hidden chunks may drive template-owned UI outside the visible page; refresh every touched one
				const restoreHidden = new Set(this.#restoreHidden ?? []);
				for (const hid of hids) restoreHidden.add(hid);
				this.#restoreHidden = Array.from(restoreHidden);
			}

			const documentId = this.id;
			const commit = this.#onchangeCallback(chunks, values);

			return Promise.resolve(commit).finally(() => {
				// The commit is async; load() may switch this editor to another document before it finishes
				if (this.id === documentId) {
					// The callback stores undo data, applies the new values to the model, and persists them.
					// Redraw the same visible chunk ids from the updated model; "restore" means viewport, not old content.
					// [] is valid for hidden-only updates: renderPage([]) clears visible chunks and applies hidden updates.
					const cids = this.#restore;
					this.#restore = null;

					const hids = this.#restoreHidden ?? [];
					this.#restoreHidden = null;

					if (cids !== null) this.renderPage(cids, hids);
				}
			});
		}
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

	#getPaginationItems(current, max) {
		// Create pagination items without formatting
		const items = [];

		if (current > 2) items.push({label: '(1) <<', page: 0});

		if (current > 1) items.push({label: '<', page: current - 2});

		if (current > 4) items.push({label: '...', disabled: true});

		for (let p = Math.max(1, current - 3); p <= Math.min(max, current + 3); ++p)
			items.push({
				label: String(p),
				page: p - 1,
				active: p === current
			});

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
}

class History {
	static #BACKUP_INTERVAL = 30000;
	static #MAX_NUMBER = 10;
	#name
	#max
	#onchange
	#data
	#backup_timestamp

	constructor(name, onchange = null, max = History.#MAX_NUMBER) {
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
	#persistFun;

	constructor(editor, hist, persistFun) {
		this.#editor = editor;
		this.#hist = hist;
		this.#persistFun = persistFun;
	}

	#createReverseHistoryEntry(data) {
		const chunks = {};
		const values = {};
		let valid = true;

		this.#forEachHistoryChunk(data, item => {
			// Verify that the document has not changed since the history entry was created
			if (!item.current || item.current.value !== item.expected) {
				valid = false;
				return false; // Shortcut if invalid
			}

			// Build the reverse history entry that	will be pushed onto the opposite stack (undo <-> redo)
			chunks[item.cid] = item.current;
			values[item.cid] = item.target.value;
		});

		return valid ? {chunks, values} : false;
	}

	#applyChunksToEditor(data) {
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
			const ret = callback({
				cid,
				store,
				index,
				current: this.#editor[store][index],
				target: data.chunks[cid],
				expected: data.values[cid]
			});
			// Shortcut if invalid history is provided
			if (ret === false) return;
		}
	}

	async #applyHistoryEntry(data, visible, from, to) {
		// Intentionally render an empty page first: renderPage([]) clears the current view, closes editor-owned tooltips,
		// and lets templates run remove hooks against the currently rendered chunks before the history entry mutates them
		this.#editor.renderPage([]);

		// Create the corresponding reverse entry
		const reverseEntry = this.#createReverseHistoryEntry(data);

		// Document changed, history is invalid
		if (!reverseEntry) {
			from.clear();
			to.clear();

			this.#editor.renderPage(visible);

			addMsg(_('Document changed outside, history action is disabled'), 'error');
			return;
		}

		// Apply a single history entry to the editor
		const {tosave, hidden} = this.#applyChunksToEditor(data);
		let renderCids;
		let renderHidden;

		try {
			try {
				await this.#persistFun(data.id, tosave);
				// The user may open/create another document before the queued save finishes
				// Only the still-active document should get save-completion UI updates
				if (data.id !== this.#editor.id) addMsg(_('Document Saved'), 'success');

				renderCids = data.cids;
				renderHidden = hidden;
			} catch (err) {
				// Undo/redo mutates the editor before saving (see this.#applyChunksToEditor(data) above)
				// If that persist fails, IndexedDB still has the pre-history-action state, so restore the editor to that state
				// Normal edit saves do not roll back their in-memory changes on failure
				const reverted = this.#applyChunksToEditor(reverseEntry);
				renderCids = visible;
				renderHidden = reverted.hidden;
				throw err;
			}

			to.add({
				id: data.id,
				chunks: reverseEntry.chunks,
				values: reverseEntry.values,
				cids: visible
			});
		} finally {
			// Render both in normal and error cases, but with different parameters
			this.#editor.renderPage(renderCids, renderHidden);
		}
	}

	#apply(reverse) {
		const from = this.#hist[reverse ? 'redo' : 'undo'];
		const to = this.#hist[reverse ? 'undo' : 'redo'];

		// Get history (undo or redo) if any
		const data = from.get();
		if (!data) return Promise.resolve();

		// The entry (data) has already been popped from the source stack (undo or redo)
		// If setup, rendering, or saving fails, put it back so the action can be retried
		const restoreHistoryEntry = err => {
			try {
				from.add(data);
			} catch (restoreErr) {
				return Promise.reject(restoreErr);
			}

			return Promise.reject(err);
		};

		try {
			// History entries store chunk indexes for one document only. If a stale entry survived a document switch,
			// drop both stacks and stop instead of applying those indexes to the currently open document
			if (data.id !== this.#editor.id) {
				console.error('Undo/redo history belongs to another document; clearing history stacks.', {
					activeDocumentId: this.#editor.id,
					historyDocumentId: data.id,
					sourceStack: reverse ? 'redo' : 'undo',
					targetStack: reverse ? 'undo' : 'redo',
					entry: data
				});
				from.clear();
				to.clear();
				return Promise.resolve();
			}

			const visible = this.#editor.getVisible();
			return this.#applyHistoryEntry(data, visible, from, to).catch(restoreHistoryEntry);
		} catch (err) {
			return restoreHistoryEntry(err);
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
	recent: new History('ed_recent', h => disable('.ed-recent', !!h.length)),
	undo: new History('ed_undo', h => disable('.ed-undo', !!h.length)),
	redo: new History('ed_redo', h => disable('.ed-redo', !!h.length))
};
const editor = new Editor(sel('#editor'), async (chunks, values) => {
	// When the content changes in the editor
	// Keep targeting the document that produced this edit even if another document is opened while saving
	const documentId = editor.id;
	// Store previous values in Undo history
	hist.undo.add({
		id: documentId,
		chunks: chunks,
		values: values,
		cids: editor.getVisible()
	});
	// Any new edit invalidates Redo history
	hist.redo.clear();
	// Apply changes to chunk objects
	const tosave = [];
	for (const [cid, chunk] of Object.entries(chunks)) {
		chunk.value = values[cid];
		tosave.push(chunk);
	}
	// Persist changes
	await documents.persist(documentId, tosave).then(() => {
		// The user may open/create another document before the queued save finishes
		// Only the still-active document should get save-completion UI updates
		if (editor.id === documentId) addMsg(_('Document Saved'), 'success');
	}).catch((err) => addMsg(err.message, 'error'));
});
const documents = new DocumentManager(editor, async (keys) => {
	// Setup initial history (if there is any)
	try {
		hist.recent.clear();
		keys.forEach(key => hist.recent.add(key));
	} catch (err) {
		addMsg(_('Database error: ') + err, 'error');
	}
});
const undoManager = new UndoManager(editor, hist, (documentId, chunks) => documents.persist(documentId, chunks));
const templates = new TemplateManager();

function confirmDiscardChanges(callback) {
	if (!documents.hasUnfinishedSave()) {
		callback();
	} else {
		addConfirm(_('There are unsaved changes! Are you sure?'), callback);
	}
}

async function displayDocument(data) {
	// Loading a document replaces any pending/failed save state the editor was warning about
	documents.clearSaveState();

	// Undo and redo only apply to edits made since this document was loaded
	hist.undo.clear();
	hist.redo.clear();
	editor.load(data);
	hist.recent.moveToTop(editor.id);

	// Enable export button
	disable('.ed-export', !!editor.id);

	addMsg(_('Document Loaded'), 'success');
}

async function openDocument(id) {
	const data = await documents.openFromIDB(id);
	// Information on the required template resources must be stored along the data
	await templates.loadResources(data);
	await displayDocument(data);
}

async function importDocument(templateInfo) {
	const loadedTemplate = await templates.loadTemplate(templateInfo.path);
	await templates.loadResources(loadedTemplate);
	const data = await documents.import(loadedTemplate);
	await displayDocument(data);
}

async function createNewDocument(templateInfo) {
	// Load the resources that register this template's creation handler
	const template = await templates.loadTemplate(templateInfo.path);
	await templates.loadResources(template);

	const creationHandler = Editor.getNewDocumentType(templateInfo.id);
	if (!creationHandler) return addMsg(_('New document creation not supported for this template'), 'error');

	const result = await creationHandler();
	if (!result) return;

	// Process the source returned by the template, then save and render the document
	const [filename, data] = result;
	const newData = await documents.createDocument(filename, data, template);
	await displayDocument(newData);
}

function showDocumentLoadError(err) {
	const message = err?.message || String(err || '');
	const hasCause = err && typeof err === 'object' && 'cause' in err;
	if (!message || !hasCause) return;

	// Wrapped load errors keep their low-level cause here, while the UI shows the friendly top-level message
	console.error('Error during file open process:', err.cause);
	addMsg(message, 'error');
}

evt('.ed-import', 'click', e => {
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
evt('.ed-export', 'click', e => {
	if (e.target.classList.contains('disabled')) return;
	const documentId = editor.id;
	documents.persist(documentId, editor.chunks)
		.then(data => {
			// Saving can finish after the user has moved on to another document
			// Avoid downloading the stale export, but make the cancelled export visible
			if (editor.id !== documentId)
				return addMsg(_('Export cancelled because another document became active before the save finished.'), 'error');

			addMsg(_('Document Saved'), 'success');

			documents.download(data);
		})
		.catch(err => addMsg(err.message, 'error'));
});
evt('.ed-undo', 'click', () => undoManager.undo().catch(err => addMsg(err.message, 'error')));
evt('.ed-redo', 'click', () => undoManager.redo().catch(err => addMsg(err.message, 'error')));
evt('.ed-exit', 'click', () => {
	if (confirm(_('Do you want to exit?'))) window.location.href = 'about:blank';
});

evtDelegated(document, '[data-open]', 'click', function () {
	// Open recent document
	confirmDiscardChanges(() => {
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
			confirmDiscardChanges(() =>
				importDocument(templateInfo).catch(showDocumentLoadError));
		} else if (action === 'new') {
			confirmDiscardChanges(() =>
				createNewDocument(templateInfo).catch(showDocumentLoadError));
		}

	} catch (err) {
		showDocumentLoadError(err);
	}
});

window.addEventListener('beforeunload', e => {
	if (documents.hasUnfinishedSave()) {
		e.preventDefault();
		e.returnValue = _('There are unsaved changes! Are you sure?');
		return e.returnValue;
	}
});
