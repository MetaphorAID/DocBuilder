function sel(s, dom, def) {
	return (dom || document).querySelector(s) || def;
}

function find(s, dom) {
	return (dom || document).querySelectorAll(s);
}

function each(s, fn, dom) {
	const arr = typeof s === 'string' ? find(s, dom) : (
		s instanceof HTMLElement ? [s] : s
	)
	for (let i = 0; i < arr.length; ++i) if (fn(arr[i], i) === false) break;
}

function evt(s, t, fn, dom) {
	each(s, i => {
		t.split(' ').forEach(e => {
			i.addEventListener(e, fn);
		});
	}, dom);
}

function trg(s, e, dom) {
	each(s, i => {
		i.dispatchEvent(new Event(e, {bubbles: true}));
	}, dom);
}

function encXml(t) {
	return String(t)
		.replace('&', '&amp;')
		.replace("'", '&apos;')
		.replace('"', '&quot;')
		.replace('<', '&lt;')
		.replace('>', '&gt;');
}

function decXml(t) {
	return String(t)
		.replace('&apos;', "'")
		.replace('&quot;', '"')
		.replace('&lt;', '<')
		.replace('&gt;', '>')
		.replace('&amp;', '&');
}

function xmlToText(xml, decode) {
	const t = (xml || '')
		.replace(/<[^>]+>/gs, ' ')
		.trim();
	return decode ? decXml(t) : t.replace("'", '&apos;').replace('"', '&quot;');
}

function selToText(dom, s, decode) {
	return xmlToText(sel(s, dom, {}).innerHTML, decode);
}

function addMsg(message, cls, target) {
	const m = document.createElement('div');
	m.className = `${cls || 'error'} msg`;
	m.innerHTML = message;
	if (target?.classList.contains('input')) {
		target.parentNode.insertBefore(m, target.nextSibling);
	} else {
		(target || sel('#message')).appendChild(m);
	}
	setTimeout(() => {
		m.remove();
	}, 5000);
}

function delMsg() {
	sel('#message').innerHTML = '';
}

function addConfirm(message, onconfirm) {
	const m = document.createElement('div');
	m.className = 'confirm';
	m.innerHTML =
		message +
		`<a href="#" class="btn error yes">${_('Yes')}</a> ` +
		`<a href="#" class="btn cancel">${_('Cancel')}</a>`;
	evt(m, 'click', e => {
		const t = e.target;
		if (!t || !t.matches('.yes,.cancel')) return;
		t.closest('.confirm').remove();
		if (t.matches('.yes')) onconfirm();
	});
	sel('body').appendChild(m);
}

function ttip(dom, event, modal) {
	const t = document.createElement('div');
	t.className = `tooltip${modal ? ' modal' : ''}`;
	dom.parentNode.insertBefore(t, dom.nextSibling);
	clean_ttip(t);

	const c = t.offsetParent || document.body;
	const o = event ? [event.offsetY, event.offsetX] : [0, 0];
	let tt = event ? event.target : dom;
	while (tt) {
		o[0] += tt.offsetTop;
		o[1] += tt.offsetLeft;
		if (tt.offsetParent === c) break;
		tt = tt.parentNode;
	}

	if (event ? (event.pageY - window.scrollY > window.innerHeight / 2) : (o[0] > c.clientHeight / 2)) {
		t.style.bottom = `${c.clientHeight - o[0] + 5}px`;
	} else {
		t.style.top = `${o[0] + (event ? 10 : dom.offsetHeight)}px`;
	}
	if (!modal) {
		if (o[1] < c.clientWidth / 2) {
			t.style.left = `${o[1]}px`;
		} else {
			t.style.right = `${c.clientWidth - o[1] - (event ? 0 : dom.offsetWidth)}px`;
		}
	} else {
		t.innerHTML = '<a href="#" class="btn close">✕</a>';
	}
	return t;
}

function clean_ttip(t) {
	each('.tooltip:not(.modal)', i => {
		if (i === t) return;
		const t2 = find('.tooltip', i);
		for (const j of t2) if (t2[j] === t) return;
		trg(i, 'close');
	});
}

function select(val, empty_opt, opts, multiple) {
	const s = document.createElement('div');
	s.className = `select${multiple ? ' multiple' : ''}`;
	s.dataset.value = multiple ? JSON.stringify(val) : val;
	for (const o in opts) {
		const a = document.createElement('a');
		a.href = '#';
		a.dataset.value = o;
		if (typeof (val) === 'object' ? (val.indexOf(o) !== -1) : (val === o)) a.className = 'selected';
		a.textContent = _(opts[o]);
		s.appendChild(a);
	}
	if (typeof empty_opt !== 'undefined') {
		const a = document.createElement('a');
		a.href = '#';
		a.className = 'no-value';
		if (!sel('.selected', s)) a.className += ' selected';
		a.textContent = _(empty_opt);
		s.insertBefore(a, s.children[0]);
	}

	return s;
}

function disable(s, enable, dom) {
	sel(s, dom).classList.toggle('disabled', !enable);
}

document.addEventListener('click', function (e) {
	const t = e.target;
	if (!t) return;
	if (t.matches('.disabled')) {
		e.preventDefault();
		return;
	}
	if (t.matches('a[href="#"]')) e.preventDefault();
	if (t.matches('.tooltip .close')) trg(t.closest('.tooltip'), 'close');
	if (t.matches('.dropdown .input') && !t.matches('.select')) return;
	if (t.matches('.select') && !t.matches('a')) {
		t.classList.toggle('open');
		return;
	}
	if (t.matches('.select > a')) {
		const s = t.parentNode;
		if (s.classList.contains('open')) {
			if (!t.classList.contains('no-value')) {
				if (!s.classList.contains('multiple')) {
					each('.selected', i => {
						i.classList.remove('selected');
					}, s);
				}
				t.classList.toggle('selected');
			}
			const v = [];
			each('.selected', i => {
				if (i.dataset.value) v.push(i.dataset.value);
			}, s);

			s.dataset.value = s.classList.contains('multiple') ? JSON.stringify(v) : (v[0] || '');
			if (s.classList.contains('multiple') && !t.classList.contains('no-value')) return;
			trg(s, 'change');
			s.classList.remove('open');
		} else {
			s.classList.add('open');
			return;
		}
	}
	clean_ttip(t.closest('.tooltip:not(.dropdown)'));
});

document.addEventListener('close', e => {
	const t = e.target;
	if (t && t.matches('.tooltip')) {
		each('.select.multiple.open', i => {
			trg(i, 'change');
		}, t)
		setTimeout(() => {
			t.remove();
		}, 50);
	}
});

const DB_NAME = "AnnotationInterfaceIndexedDB";   // The name of our IndexedDB database
const STORE_NAME = "annotationFiles";             // The name of the object store (like a table)

let db;  // Will hold the database connection

window.addEventListener('DOMContentLoaded', function () {
	// Initialise the database
	// Request to open (or create) the database
	const request = indexedDB.open(DB_NAME, 1);

	// Called if the DB doesn't exist yet or version changes
	request.onupgradeneeded = (e) => {
		db = e.target.result;
		// Create an object store (like a table) with "name" as the key
		db.createObjectStore(STORE_NAME, {
			keyPath: 'name'
		});
	};

	// Called when the DB is ready to use
	request.onsuccess = (e) => {
		db = e.target.result;

		// Init recent files from DB
		listFilesInIndexedDB()
			.then(keys => {
				hist.recent.clear();  // Clear history
				keys.forEach(key => {
					hist.recent.add(key);
				});
			})
			.catch(err => addMsg(_('Database error:' + err), 'error'));
	};

	// Called if there's an error opening the DB
	request.onerror = (e) => addMsg(_('Database error:' + e.target.error), 'error');
});

function listFilesInIndexedDB() {
	return new Promise((resolve, reject) => {
		// Create a read-only transaction
		const tx = db.transaction(STORE_NAME, 'readonly');
		// Get the object store
		const store = tx.objectStore(STORE_NAME);

		// Get the specific key
		const getRequest = store.getAllKeys();

		// Pass when transaction is complete
		getRequest.onsuccess = () => resolve(getRequest.result);
		getRequest.onerror = (e) => reject(e);
	});
}

window.onerror = function (errorMsg, url, lineNum, colNum, error) {
	addMsg(_('Exception: ') + errorMsg + ' (' + url + ':' + lineNum + ')', 'error');
};

function _(text) {
	return window.Locale && Locale[text] || text;
}

each('.locale', function (i) {
	i.innerHTML = _(i.innerHTML.trim());
});

class Editor {
	static TYPES = {
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

	static getType(type) {
		return (type ? Editor.TYPES[type] : false) || Editor.TYPES._default_;
	}

	constructor(dom, onchange) {
		this.dom = dom;
		this.onchange_cb = onchange;
		this.chunks = [];
		this.restore = false;
		this.restoreHidden = false;

		dom.classList.add('editor');

		// Initially disable save button since no file is open
		disable('.ed-save', !!this.id);

		evt(dom, 'change', e => {
			const t = e.target;
			if (t && t.matches('[data-cid]')) this.onchange([t.dataset.cid]);
		});

		evt(dom, 'click', e => {
			const t = e.target;
			if (!t) return;

			if (t.matches('[data-render]')) this.render([Number(t.dataset.render)]);

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

		window.addEventListener('beforeunload', e => {
			if (this.ischanged()) {
				e.preventDefault();
				e.returnValue = _('There are unsaved changes! Are you sure?');
				return e.returnValue;
			}
		});
	}

	load(data, store_filler) {
		if (!data.id) return;

		this.id = data.id;
		this.eol = false;
		this.hidden = [];
		this.chunks = [];

		for (const chunk of data.chunks || []) {
			if (!store_filler && !chunk.name) continue;

			if (!this.eol) {
				const m = chunk.value.match(/(\r?\n|\r)/);

				if (m) this.eol = m[1];
			}

			if (chunk.name[0] === '.') this.hidden.push(chunk);
			else this.chunks.push(chunk);
		}

		if (!this.eol) this.eol = '\n';

		this.dom.innerHTML = '';
		clean_ttip(this.dom);

		for (const css of data.css || []) {
			if (sel(`link[href="${css}"]`)) continue;

			const e = document.createElement('link');
			e.setAttribute('rel', 'stylesheet');
			e.setAttribute('href', css);
			sel('head').appendChild(e);
		}

		let loading = 0;
		for (const js of data.js || []) {
			if (sel(`script[src="${js}"]`)) continue;

			++loading;
			const e = document.createElement('script');
			e.setAttribute('src', js);
			evt(e, 'load', () => {
				--loading;
			});
			sel('body').appendChild(e);
		}

		const onload = () => {
			if (loading > 0) {
				setTimeout(onload, 50);
				return;
			}

			addMsg(_('Document Loaded'), 'success');

			trg(this.dom, 'load');
			const hids = Object.keys(this.hidden);
			this.renderHidden(hids);
			this.render([0]);
		};

		onload();
	}

	ischanged(onnotchanged) {
		let changed = false;

		each('[data-cid]', i => {
			const c = this.chunks[i.dataset.cid];
			const t = Editor.getType(c.name);

			if (c.id && t.getValue && c.value !== t.getValue(i, c).replace(/(\r?\n|\r)/g, this.eol)) {
				changed = true;
			}
		}, this.dom);

		if (!onnotchanged) {
			return changed;
		}

		const oncontinue = () => {
			each('[data-cid]', i => {
				const c = this.chunks[i.dataset.cid];
				const t = Editor.getType(c.name);

				if (t.remove) t.remove(i, c);
			}, this.dom);

			onnotchanged();
		};

		if (!changed) {
			oncontinue();
		} else {
			addConfirm(_('There are unsaved changes! Are you sure?'), oncontinue);
		}
	}

	onchange(cids, hdata) {
		editor.restore = editor.getVisible();

		const hids = Object.keys(hdata || {});
		if (hids.length) editor.restoreHidden = hids;

		const chunks = {};
		const values = {};
		let changed = false;
		for (const cid of cids) {
			const c = this.chunks[cid];
			const t = Editor.getType(c.name);

			if (c.id && t.getValue) {
				const v = t.getValue(sel(`[data-cid="${cid}"]`, this.dom), c).replace(/(\r?\n|\r)/g, this.eol);

				if (c.value !== v) {
					changed = true;
					chunks[`c${cid}`] = c;
					values[`c${cid}`] = v;
				}
			}
		}

		for (const hid in (hdata || {})) {
			const h = this.hidden[hid];

			if (h.id) {
				const v = hdata[hid].replace(/(\r?\n|\r)/g, this.eol);

				if (h.value !== v) {
					changed = true;
					chunks[`h${hid}`] = h;
					values[`h${hid}`] = v;
				}
			}
		}

		if (changed) this.onchange_cb(chunks, values);
	}

	render(cids) {
		this.dom.innerHTML = '';

		clean_ttip(this.dom);

		if (!cids.length) return;

		this.dom.appendChild(this.renderPaginator(cids[0]));

		for (const cid of cids) {
			this.dom.appendChild(this.renderChunk(cid));
		}

		if (this.chunks.length > cids[cids.length - 1] + 1) {
			const a = document.createElement('a');

			a.href = '#';
			a.className = 'btn plus-one';
			a.dataset.next = String(Number(cids[cids.length - 1]) + 1);
			a.innerHTML = _('Show +1 sentence');
			this.dom.appendChild(a);
		}
	}

	renderHidden(hids) {
		this.render_hidden = hids;
		trg(this.dom, 'change-hidden');
		this.render_hidden = [];
	}

	renderChunk(cid) {
		cid = Number(cid);
		const c = this.chunks[cid];
		if (!c) return null;

		const e = Editor.getType(c.name).render(c, cid);
		if (e) e.dataset.cid = cid;

		return e;
	}

	renderPaginator(cid) {
		cid = Number(cid);
		const cur = cid + 1;
		const max = (this.chunks || []).length;
		if (max < 1) return;

		let html = '';
		if (cur > 2) {
			html += '<li><a href="#" class="btn" data-render="0">(1) &lt;&lt;</a></li>';
		}
		if (cur > 1) {
			html += `<li><a href="#" class="btn" data-render="${cid - 1}">&lt;</a></li>`;
		}
		if (cur > 4) {
			html += '<li class="disabled"><a>...</a></li>';
		}

		const s = Math.min(max, cur + 3);
		for (let p = Math.max(1, cur - 3); p <= s; ++p) {
			html += `<li class="${p === cur ? 'active' : ''}"><a href="#" class="btn" data-render="${p - 1}">${p}</a></li>`;
		}
		if (max > cur + 3) {
			html += '<li class="disabled"><a>...</a></li>';
		}
		if (max > cur) {
			html += `<li><a href="#" class="btn" data-render="${cid + 1}">&gt;</a></li>`;
		}
		if (max > cur + 1) {
			html += `<li><a href="#" class="btn" data-render="${max - 1}">&gt;&gt; (${max})</a></li>`;
		}

		const p = document.createElement('ul');
		p.className = 'pagination';
		p.innerHTML = html;

		return p;
	}

	getVisible() {
		const cids = [];
		each('[data-cid]', i => {
			cids.push(i.dataset.cid);
		}, this.dom);

		return cids;
	}
}

class History {
	static BACKUP_INTERVAL = 30000;
	static MAX_NUMBER = 10;

	constructor(name, max, onchange) {
		this.name = name;
		this.max = max;
		this.data = JSON.parse(localStorage[name] || '[]');
		this.bu_stamp = Date.now();
		this.onchange_cb = onchange;
		this.onchange_cb?.(this);
	}

	backup() {
		this.bu_stamp = Date.now();
		const d = structuredClone(this.data);
		while (d.length) {
			try {
				localStorage[this.name] = JSON.stringify(d);
				break;
			} catch (e) {
				console.error('Could not save data into localStorage');
				d.pop();
			}
		}
	}

	onchange() {
		clearTimeout(this.timer);
		this.timer = setTimeout(() => {
				this.backup();
			},
			Math.max(200, (this.bu_stamp || 0) + History.BACKUP_INTERVAL - Date.now()));
		this.onchange_cb?.(this);
	}

	add(data) {
		while (this.data.length >= this.max) {
			this.data.pop();
		}
		this.data.unshift(structuredClone(data));
		this.onchange();
	}

	get(num, peek) {
		const index = num || 0;
		const data = this.data[index];
		if (data && !peek) {
			this.data.splice(index, 1);
			this.onchange();
		}
		return data;
	}

	isEmpty() {
		return this.data.length === 0;
	}

	walk(callback) {
		for (const [i, item] of this.data.entries()) callback(item, i);
	}

	clear() {
		this.data = [];
		this.onchange();
	}
}

// Project specific stuff

const hist = {
	recent: null,
	undo: null,
	redo: null
};
for (const n in hist) {
	hist[n] = new History(`ed_${n}`, History.MAX_NUMBER, h => {
		disable(`.${h.name.replace('_', '-')}`, !h.isEmpty());
	});
}

const editor = new Editor(sel('#editor'), function (chunks, values) {
	hist.undo.add({
		id: editor.id,
		chunks: chunks,
		values: values,
		cids: editor.getVisible()
	});
	hist.redo.clear();
	const tosave = [];
	for (const cid in chunks) {
		chunks[cid].value = values[cid];
		tosave.push(chunks[cid]);
	}
	save(tosave);
});

function loadJSONFromURL(url) {
	return fetch(url)
		.then(response => {
			if (!response.ok) {
				addMsg(_('Error fetching file: ' + url), 'error');
				throw new Error(_('Failed to load ') + url);
			}
			return response.json();
		});
}

function loadTemplate(templateDir, url) {
	return loadJSONFromURL(`./${templateDir}/${url}`)
		.then(template => {
			if (typeof template['css'] === 'string') {
				template['css'] = template['css'].split(',');
			}
			if (typeof template['js'] === 'string') {
				template['js'] = template['js'].split(',');
			}

			template.css = template.css.map(e => `./${templateDir}/${e}`);
			template.js = template.js.map(e => `./${templateDir}/${e}`);

			return template;
		})
		.catch(err => {
			console.error('Error loading template:', err);
			// Rethrow so the caller can handle it
			return Promise.reject(err);
		});
}

function getAvailableTemplates(templateDir) {
	return loadJSONFromURL(`./${templateDir}/template_list.json`)
		.then(templateList => {
			return templateList;
		})
		.catch(err => {
			console.error('Error loading template:', err);
			// Rethrow so the caller can handle it
			return Promise.reject(err);
		});
}

function selectTemplate(action, event) {
	let tt = ttip(event.target, event);
	tt.classList.add('dropdown');
	getAvailableTemplates('templates')
		.then(templates => {
			if (action === 'new') {
				templates = templates.filter(t => t.new === true);
			}

			templates.forEach(template => {
				let a = document.createElement('a');
				a.href = '#';
				a.className = 'template-select';
				a.dataset.template = template.id;
				a.dataset.action = action;
				a.innerHTML = template.name;
				tt.appendChild(a);
			});
		});
}

function chooseFile(extension) {
	return new Promise((resolve, reject) => {
		// Create a hidden file input restricted to the template extension
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.' + extension;
		input.multiple = false;
		input.style.display = 'none';
		document.body.appendChild(input);

		input.onchange = () => {
			const file = input.files[0];
			// Clean up
			input.remove();
			file ? resolve(file) : reject(new Error(_('No file chosen')));
		};

		input.click();
	});
}

function readFileAsText(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (e) => resolve(e.target.result);
		reader.onerror = reject;
		reader.readAsText(file, 'UTF-8');
	});
}

function storeFileInIndexedDB(fileName, data) {
	return new Promise((resolve, reject) => {
		// Create a transaction with read/write access
		const tx = db.transaction(STORE_NAME, 'readwrite');
		// Get the object store we’ll write to
		const store = tx.objectStore(STORE_NAME);

		// Save the chunks as an object: { name, data }
		store.put({
			name: fileName,
			data
		});

		// Pass when transaction is complete
		tx.oncomplete = () => resolve(data);

		tx.onerror = (e) => reject(e);
	});
}

function open(id, onsuccess, template) {
	let promise;
	// Load file from FileInIndexedDB
	if (id !== undefined) {
		promise = retriveFileInIndexedDB(id);
	} else {
		// Open new file
		const templatePromise = typeof template === 'string'
			? loadTemplate('templates', template)
			: Promise.resolve(template);

		promise = templatePromise
			.then(template => chooseFile(template.extension)
				.then(file => readFileAsText(file)
					.then(text => storeFileInIndexedDB(file.name, prepareData(file.name, text, template)))
				)
			);
	}

	promise.then(storedData => {
		fileLoaded(storedData, onsuccess);
	})
		.catch(err => {
			console.error('Error during file open process:', err);
			addMsg(_('Error during file open process:' + err), 'error');
		});
}

function fileLoaded(data, onsuccess) {
	evt(editor.dom, 'load', function () {
		hist.recent.walk(function (data, i) {
			if (data === editor.id) hist.recent.get(i);
		});
		hist.recent.add(editor.id);
		if (onsuccess) onsuccess();
	});
	editor.load(data, false);
	disable('.ed-save', !!editor.id);
	if (editor.restore) {
		editor.render(editor.restore);
		editor.restore = false;
	}
	if (editor.restoreHidden) {
		editor.renderHidden(editor.restoreHidden);
		editor.restoreHidden = false;
	}
}

function prepareData(fileName, text, template) {
	const mChunks = getChunks(text, template.chunks);
	return {
		id: fileName,
		chunks: mChunks,
		js: template.js,
		css: template.css
	};
}

function getChunks(content, splitter) {
	const matches = [];

	// Collect all matches
	Object.entries(splitter).forEach(([patternStr, key]) => {
		const regex = new RegExp(patternStr, 'gs'); // g = global, s = dotall
		let match;
		while ((match = regex.exec(content)) !== null) {
			matches.push({
				start: match.index,
				end: regex.lastIndex,
				chunk: {
					'id': null,
					'name': key,
					'value': match[0]
				}
			});
		}
	});

	// Sort matches
	matches.sort((a, b) => {
		if (a.start === b.start) {
			return b.end - a.end; // Longer match first
		}
		return a.start - b.start;
	});

	const chunks = [];
	let pos = 0;
	let id = 0;

	for (const m of matches) {
		const c = m.chunk;
		const start = m.start;
		const end = m.end;

		if (pos > start) {
			// Overlapping, just add this chunk
			chunks.push(c);
			continue;
		}

		if (pos < start) {
			// Add intermediate chunk
			chunks.push({
				'id': ++id,
				'name': '',
				'value': content.substring(pos, start)
			});
		}

		c.id = ++id;
		chunks.push(c);
		pos = end;
	}

	// Add any remaining content at the end
	if (pos < content.length) {
		chunks.push({
			'id': ++id,
			'name': '',
			'value': content.substring(pos)
		});
	}

	return chunks;
}

function setChunks(chunks, mChunks) {
	let i = 0;
	let j = 0;

	while (i < chunks.length || j < mChunks.length) {
		if (i < chunks.length && j < mChunks.length && chunks[i].id === mChunks[j].id) {
			// If both chunks and mChunks have the same id, merge them
			if (chunks[i].append) {
				mChunks[j].value = mChunks[j].value + (chunks[i].value || '');
			} else {
				mChunks[j].value = chunks[i].value || '';
			}
			i++;
			j++;
		} else if (i < chunks.length && (j >= mChunks.length || chunks[i].id < mChunks[j].id)) {
			// If no matching mChunk, just add the chunk
			throw new Error(_(`No matching mChunk found for chunk with id: ${chunks[i].id}`));
		} else {
			// If no matching chunk, just add the mChunk leave mChunk as is (skip)
			j++;
		}
	}

	return mChunks;
}

function retriveFileInIndexedDB(fileName) {
	return new Promise((resolve, reject) => {
		// Create a read-only transaction
		const tx = db.transaction(STORE_NAME, 'readonly');
		// Get the object store
		const store = tx.objectStore(STORE_NAME);

		// Get the specific key
		const getRequest = store.get(fileName);

		// Pass when transaction is complete
		getRequest.onsuccess = () => resolve(getRequest.result?.data ?? null);
		getRequest.onerror = (e) => reject(e);
	});
}

function buildFile(mChunks) {
	let result = '';

	for (const chunk of mChunks) {
		if (chunk.id == null) continue;
		result += chunk.value;
	}
	return new Blob([result]);
}

function saveFile(fileName, data) {
	// Create a temporary object URL to download
	const url = URL.createObjectURL(data);

	// Create a temporary <a> element to trigger the download
	const a = document.createElement('a');
	a.href = url;
	a.download = fileName;  // Original file name
	a.click();              // Simulate click to download

	// Clean up the temporary URL
	URL.revokeObjectURL(url);
	// Clean up the temporary <a> element
	a.remove();

	addMsg(_('Document Saved'), 'success');
}

function save(chunks) {
	// If chunks is undefined, use editor.chunks, otherwise use provided chunks
	retriveFileInIndexedDB(editor.id || 0)
		.then(data => {
			// Set chunks using setChunks, and store the updated result in IndexedDB
			data.chunks = setChunks(chunks || editor.chunks, data.chunks);
			// Store the data in IndexedDB with the correct fileName (data.id)
			return storeFileInIndexedDB(data.id, data); // Return the promise from storeFileInIndexedDB
		})
		.then((data) => {
			// If chunks is undefined, 'Save as...'
			if (!chunks) {
				const text = buildFile(data.chunks);
				saveFile(editor.id, text);
			} else {
				addMsg(_('Document Saved'), 'success');
				if (editor.forceReload) {
					open(editor.id, false);
					editor.forceReload = false;
				} else {
					if (editor.restore) {
						editor.render(editor.restore);
						editor.restore = false;
					}
					if (editor.restoreHidden) {
						editor.renderHidden(editor.restoreHidden);
						editor.restoreHidden = false;
					}
				}
			}
		})
		.catch(err => {
			console.error('Error saving:', err);
			addMsg(_('Error saving:' + err), 'error');
		});
}

function undo(reverse) {
	const data = hist[reverse ? 'redo' : 'undo'].get();
	if (!data) return;
	const cids = editor.getVisible();
	editor.render([]);

	function h() {
		let current = {};
		const next = {};
		for (const cid in data.chunks) {
			const f = cid[0] === 'h' ? 'hidden' : 'chunks';
			const c = editor[f][cid.substring(1)];
			if (c.value !== data.values[cid]) {
				current = false;
			}
			if (current !== false) current[cid] = c;
			next[cid] = data.chunks[cid].value;
		}
		if (current === false) {
			hist[reverse ? 'redo' : 'undo'].add(data);
			addMsg(_('Document changed outside, history action is disabled'));
			editor.render(cids);
			return;
		}
		hist[reverse ? 'undo' : 'redo'].add({
			id: data.id,
			chunks: current,
			values: next,
			cids: cids
		});
		const tosave = [];
		const hids = [];
		for (const cid in data.chunks) {
			const d = data.chunks[cid];
			const f = cid[0] === 'h' ? 'hidden' : 'chunks';
			editor[f][cid.substring(1)] = d;
			tosave.push(d);
			if (f === 'hidden') hids.push(cid.substring(1));
		}
		save(tosave);
		if (hids.length) editor.renderHidden(hids);
		editor.render(data.cids);
	}

	if (data.id !== editor.id) {
		open(data.id, h);
	} else {
		h();
	}
}

evt('.ed-open', 'click', function (e) {
	selectTemplate('open', e);
	e.stopPropagation();
});
evt('.ed-new', 'click', function (e) {
	selectTemplate('new', e);
	e.stopPropagation();
});
evt('.ed-recent', 'click', function (e) {
	const t = ttip(e.target, e);
	hist.recent.walk(function (data, id) {
		const a = document.createElement('a');
		a.setAttribute('href', '#');
		a.dataset.open = id;
		a.innerHTML = data.split("\t")[0].replace(/^.*?([^\\\/]+)$/, '$1');
		t.appendChild(a);
	});
	t.classList.add('dropdown');
	e.stopPropagation();
});
evt('.ed-save', 'click', function (e) {
	if (e.target.classList.contains('disabled')) return;
	save();
});
evt('.ed-undo', 'click', function () {
	undo();
});
evt('.ed-redo', 'click', function () {
	undo(true);
});
evt('.ed-exit', 'click', function () {
	if (confirm(_('Do you want to exit?'))) {
		window.location.href = 'about:blank';
	}
});

function loadNextScript(scripts, index = 0) {
	return new Promise((resolve, reject) => {
		function next(i) {
			if (i >= scripts.length) {
				resolve(); // All scripts loaded
				return;
			}
			let js = scripts[i];
			let e = document.createElement('script');
			e.src = js;
			e.onload = () => next(i + 1);
			e.onerror = () => reject(new Error('Error loading script: ' + js));
			document.body.appendChild(e);
		}

		next(index);
	});
}

function callTokenNew(template) {
	let TokenClass = window.TOKEN || (typeof TOKEN !== 'undefined' && TOKEN);
	if (TokenClass && typeof TokenClass.new === 'function') {
		TokenClass.new().then(result => {
			if (result) {
				let [filename, data] = result;
				let newData = prepareData(filename, data, template);
				storeFileInIndexedDB(filename, newData).then(() => {
					fileLoaded(newData);
				});
			}
		});
	} else {
		addMsg(_('New document creation not supported for this template'), 'error');
	}
}

document.addEventListener('click', function (e) {
	const t = e.target;
	if (t && t.matches('[data-open]')) {
		editor.ischanged(function () {
			open(hist.recent.get(t.dataset.open));
		});
	}
	if (t && t.matches('.template-select')) {
		let templateId = t.dataset.template;
		let action = t.dataset.action;
		getAvailableTemplates('templates')
			.then(templates => {
				let templateInfo = templates.find(t => t.id === templateId);
				if (templateInfo) {
					loadTemplate('templates', templateInfo.path).then(template => {
						if (action === 'open') {
							editor.ischanged(function () {
								open(undefined, undefined, template);
							});
						} else if (action === 'new') {
							// Find scripts not yet loaded
							let scripts = (template.js || []).filter(js => !sel('script[src="' + js + '"]'));
							loadNextScript(scripts)
								.then(() => {
									callTokenNew(template);
								})
								.catch(err => {
									console.error(err);
								});
						}
					}).catch(err => {
						addMsg(_('Error loading template:') + err, 'error');
					});
				}
				trg(t.closest('.tooltip'), 'close');
			});
	}
});

// $(window).on('load resize', function () {
// 	$('body').addClass('resizing');

// 	$('body').removeClass('resizing');
// });
