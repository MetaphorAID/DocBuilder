function sel(s, dom, def) {
	return (dom || document).querySelector(s) || def;
}
function find(s, dom) {
	return (dom || document).querySelectorAll(s) || [];
}
function each(s, fn, dom) {
	var arr = typeof (s) == 'string' ? find(s, dom) : (
		s instanceof HTMLElement ? [s] : s
	)
	for (var i = 0; i < arr.length; ++i) if (fn(arr[i], i) === false) break;
}
function evt(s, t, fn, dom) {
	each(s, function (i) {
		t.split(' ').forEach(function (e) { i.addEventListener(e, fn); });
	}, dom);
}
function trg(s, e, dom) {
	each(s, function (i) {
		i.dispatchEvent(new Event(e, { bubbles: true }));
	}, dom);
}
function encXml(t) {
	return ('' + t).replace('&', '&amp;').replace("'", '&apos;').replace('"', '&quot;').replace('<', '&lt;').replace('>', '&gt;');
}
function decXml(t) {
	return ('' + t).replace('&apos;', "'").replace('&quot;', '"').replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&');
}
function xmlToText(xml, decode) {
	var t = (xml || '').replace(/<[^>]+>/sg, ' ').trim();
	return decode ? decXml(t) : t.replace("'", '&apos;').replace('"', '&quot;');
}
function selToText(dom, s, decode) {
	return xmlToText(sel(s, dom, {}).innerHTML, decode);
}
function addMsg(message, cls, target) {
	var m = document.createElement('div');
	m.className = (cls || 'error') + ' msg';
	m.innerHTML = message;
	if (target && target.classList.contains('input')) {
		target.parentNode.insertBefore(m, target.nextSibling);
	} else {
		(target || sel('#message')).appendChild(m);
	}
	setTimeout(function () { m.remove() }, 5000);
}
function delMsg() {
	sel('#message').innerHTML = '';
}
function addConfirm(message, onconfirm) {
	var m = document.createElement('div');
	m.className = 'confirm';
	m.innerHTML = message + '<a href="#" class="btn error yes">' + _('Yes') + '</a> <a href="#" class="btn cancel">' + _('Cancel') + '</a>';
	evt(m, 'click', function (e) {
		var t = e.target;
		if (!t || !t.matches('.yes,.cancel')) return;
		t.closest('.confirm').remove();
		if (t.matches('.yes')) onconfirm();
	});
	sel('body').appendChild(m);
}
function ttip(dom, event, modal) {
	var t = document.createElement('div');
	t.className = 'tooltip' + (modal ? ' modal' : '');
	dom.parentNode.insertBefore(t, dom.nextSibling);
	clean_ttip(t);

	var c = t.offsetParent || document.body;
	var o = event ? [event.offsetY, event.offsetX] : [0, 0];
	var tt = event ? event.target : dom;
	while (tt) {
		o[0] += tt.offsetTop;
		o[1] += tt.offsetLeft;
		if (tt.offsetParent == c) break;
		tt = tt.parentNode;
	}

	if (event ? (event.pageY - window.scrollY > window.innerHeight / 2) : (o[0] > c.clientHeight / 2)) {
		t.style.bottom = (c.clientHeight - o[0] + 5) + 'px';
	} else {
		t.style.top = (o[0] + (event ? 10 : dom.offsetHeight)) + 'px';
	}
	if (!modal) {
		if (o[1] < c.clientWidth / 2) {
			t.style.left = o[1] + 'px';
		} else {
			t.style.right = (c.clientWidth - o[1] - (event ? 0 : dom.offsetWidth)) + 'px';
		}
	} else {
		t.innerHTML = '<a href="#" class="btn close">✕</a>';
	}
	return t;
}
function clean_ttip(t) {
	each('.tooltip:not(.modal)', function (i) {
		if (i == t) return;
		var t2 = find('.tooltip', i);
		for (var j in t2) { if (t2[j] == t) return; }
		trg(i, 'close');
	});
}
function select(val, empty_opt, opts, multiple) {
	var s = document.createElement('div');
	s.className = 'select' + (multiple ? ' multiple' : '');
	s.dataset.value = multiple ? JSON.stringify(val) : val;
	for (var o in opts) {
		var a = document.createElement('a');
		a.href = '#';
		a.dataset.value = o;
		if (typeof (val) == 'object' ? (val.indexOf(o) != -1) : (val == o)) a.className = 'selected';
		a.textContent = _(opts[o]);
		s.appendChild(a);
	}
	if (typeof empty_opt !== 'undefined') {
		var a = document.createElement('a');
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
	var t = e.target;
	if (!t) return;
	if (t.matches('.disabled')) { e.preventDefault(); return; }
	if (t.matches('a[href="#"]')) e.preventDefault();
	if (t.matches('.tooltip .close')) trg(t.closest('.tooltip'), 'close');
	if (t.matches('.dropdown .input') && !t.matches('.select')) return;
	if (t.matches('.select') && !t.matches('a')) {
		t.classList.toggle('open');
		return;
	}
	if (t.matches('.select > a')) {
		var s = t.parentNode;
		if (s.classList.contains('open')) {
			if (!t.classList.contains('no-value')) {
				if (!s.classList.contains('multiple')) {
					each('.selected', function (i) { i.classList.remove('selected'); }, s);
				}
				t.classList.toggle('selected');
			}
			var v = [];
			each('.selected', function (i) { if (i.dataset.value) v.push(i.dataset.value); }, s);
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
document.addEventListener('close', function (e) {
	var t = e.target;
	if (t && t.matches('.tooltip')) {
		each('.select.multiple.open', function (i) { trg(i, 'change'); }, t)
		setTimeout(function () {
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
		db.createObjectStore(STORE_NAME, { keyPath: 'name' });
	};

	// Called when the DB is ready to use
	request.onsuccess = (e) => {
		db = e.target.result;

		// Init recent files from DB
		listFilesInIndexedDB()
			.then(keys => {hist.recent.clear();  // Clear history
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
	addMsg('Exception: ' + errorMsg + ' (' + url + ':' + lineNum + ')', 'error');
};

function _(text) {
	return window.Locale && Locale[text] || text;
}

each('.locale', function (i) {
	i.innerHTML = _(i.innerHTML.trim());
});

var Editor = function (dom, onchange) {
	this.dom = dom;
	this.onchange_cb = onchange;
	this.chunks = [];

	var self = this;
	dom.classList.add('editor');
	evt(dom, 'change', function (e) {
		var t = e.target;
		if (t && t.matches('[data-cid]')) self.onchange([t.dataset.cid]);
	});
	evt(dom, 'click', function (e) {
		var t = e.target;
		if (!t) return;
		if (t.matches('[data-render]')) self.render([parseInt(t.dataset.render)]);
		if (t.matches('.plus-one')) {
			var cid = parseInt(t.dataset.next);
			var d = self.renderChunk(cid);
			if (d) dom.insertBefore(d, t);
			if (self.chunks.length > cid + 1) {
				t.dataset.next = cid + 1;
			} else {
				t.remove();
			}
		}
	});
	window.addEventListener('beforeunload', function (e) {
		if (self.ischanged()) {
			e.preventDefault();
			e.returnValue = _('There are unsaved changes! Are you sure?');
			return e.returnValue;
		}
	});
}
Editor.TYPES = {
	_default_: {
		remove: function (input, chunk) {
		},
		getValue: function (input, chunk) {
			return input.value;
		},
		render: function (chunk, cid) {
			if (!chunk.id || !chunk.name) {
				var e = document.createElement('pre');
				e.innerHTML = chunk.value;
				return e;
			}
			var e = document.createElement('textarea');
			e.className = 'input';
			e.value = chunk.value;
			return e;
		}
	}
};
Editor.getType = function (type) {
	return (type ? Editor.TYPES[type] : false) || Editor.TYPES._default_;
}
Editor.prototype.load = function (data, store_filler) {
	if (!data.id) return;
	this.id = data.id;
	this.eol = false;
	this.hidden = [];
	this.chunks = [];
	for (var c in data.chunks || []) {
		c = data.chunks[c];
		if (!store_filler && !c.name) continue;
		if (!this.eol) {
			var m = c.value.match(/(\r?\n|\r)/);
			if (m) this.eol = m[1];
		}
		if (c.name[0] == '.') this.hidden.push(c);
		else this.chunks.push(c);
	}
	if (!this.eol) eol = '\n';

	this.dom.innerHTML = '';
	clean_ttip(this.dom);

	for (var css in data.css || []) {
		css = data.css[css];
		if (sel('link[href="' + css + '"]')) continue;
		var e = document.createElement('link');
		e.setAttribute('rel', 'stylesheet');
		e.setAttribute('href', css);
		sel('head').appendChild(e);
	}

	var loading = 0;
	for (var js in data.js || []) {
		js = data.js[js];
		if (sel('script[src="' + js + '"]')) continue;
		++loading;
		var e = document.createElement('script');
		e.setAttribute('src', js);
		evt(e, 'load', function () {
			--loading;
		});
		sel('body').appendChild(e);
	}

	var self = this;
	function onload() {
		if (loading > 0) {
			setTimeout(onload, 50);
			return;
		}
		addMsg(_('Document Loaded'), 'success');
		trg(self.dom, 'load');
		var hids = []; for (var i in self.hidden) { hids.push(i); }
		self.renderHidden(hids);
		self.render([0]);
	}
	onload();

}
Editor.prototype.ischanged = function (onnotchanged) {
	var changed = false;
	var self = this;
	each('[data-cid]', function (i) {
		var c = self.chunks[i.dataset.cid];
		var t = Editor.getType(c.name);
		if (c.id && t.getValue && c.value != t.getValue(i, c).replace(/(\r?\n|\r)/g, self.eol)) {
			changed = true;
		}
	}, self.dom);
	if (!onnotchanged) {
		return changed;
	}
	function oncontinue() {
		each('[data-cid]', function (i) {
			var c = self.chunks[i.dataset.cid];
			var t = Editor.getType(c.name);
			if (t.remove) t.remove(i, c);
		}, self.dom);
		onnotchanged();
	}

	if (!changed) {
		oncontinue();
	} else {
		addConfirm(_('There are unsaved changes! Are you sure?'), oncontinue);
	}
}
Editor.prototype.onchange = function (cids, hdata) {
	editor.restore = editor.getVisible();
	var hids = Object.keys(hdata || {});
	if (hids.length) editor.restoreHidden = hids;
	var chunks = {}, values = {}, changed = false;
	for (var i in cids) {
		var cid = cids[i];
		var c = this.chunks[cid];
		var t = Editor.getType(c.name);
		if (c.id && t.getValue) {
			var v = t.getValue(sel('[data-cid="' + cid + '"]', this.dom), c).replace(/(\r?\n|\r)/g, this.eol);
			if (c.value != v) {
				changed = true;
				chunks['c' + cid] = c;
				values['c' + cid] = v;
			}
		}
	}
	for (var hid in (hdata || {})) {
		var h = this.hidden[hid];
		if (h.id) {
			var v = hdata[hid].replace(/(\r?\n|\r)/g, this.eol);
			if (h.value != v) {
				changed = true;
				chunks['h' + hid] = h;
				values['h' + hid] = v;
			}
		}
	}
	if (changed) this.onchange_cb(chunks, values);
}
Editor.prototype.render = function (cids) {
	var self = this;
	self.ischanged(function () {
		self.dom.innerHTML = '';
		clean_ttip(this.dom);
		if (!cids.length) return;
		self.dom.appendChild(self.renderPaginator(cids[0]));
		for (var i in cids) {
			self.dom.appendChild(self.renderChunk(cids[i]));
		}
		if (self.chunks.length > cids[cids.length - 1]) {
			var a = document.createElement('a');
			a.setAttribute('href', '#');
			a.className = 'btn plus-one';
			a.dataset.next = parseInt(cids[cids.length - 1]) + 1;
			a.innerHTML = '+1';
			self.dom.appendChild(a);
		}
	});
}
Editor.prototype.renderHidden = function (hids) {
	this.render_hidden = hids;
	trg(this.dom, 'change-hidden');
	this.render_hidden = [];
}
Editor.prototype.renderChunk = function (cid) {
	cid = parseInt(cid);
	var c = this.chunks[cid];
	if (!c) return null;
	var e = Editor.getType(c.name).render(c, cid);
	if (e) e.dataset.cid = cid;
	return e;
}
Editor.prototype.renderPaginator = function (cid) {
	cid = parseInt(cid);
	var cur = cid + 1;
	var max = (this.chunks || []).length
	if (max < 1) return;
	var html = '';
	if (cur > 2) {
		html += '<li><a href="#" class="btn" data-render="0">(1) &lt;&lt;</a></li>';
	}
	if (cur > 1) {
		html += '<li><a href="#" class="btn" data-render="' + (cid - 1) + '">&lt;</a></li>';
	}
	if (cur > 4) {
		html += '<li class="disabled"><a>...</a></li>';
	}
	var s = Math.min(max, cur + 3);
	for (var p = Math.max(1, cur - 3); p <= s; ++p) {
		html += '<li class="' + (p == cur ? 'active' : '') + '"><a href="#" class="btn" data-render="' + (p - 1) + '">' + p + '</a></li>';
	}
	if (max > cur + 3) {
		html += '<li class="disabled"><a>...</a></li>';
	}
	if (max > cur) {
		html += '<li><a href="#" class="btn" data-render="' + (cid + 1) + '">&gt;</a></li>';
	}
	if (max > cur + 1) {
		html += '<li><a href="#" class="btn" data-render="' + (max - 1) + '">&gt;&gt; (' + max + ')</a></li>';
	}
	var p = document.createElement('ul');
	p.className = "pagination";
	p.innerHTML = html;
	return p;
}
Editor.prototype.getVisible = function () {
	var cids = [];
	each('[data-cid]', function (i) { cids.push(i.dataset.cid); }, this.dom);
	return cids;
}

var History = function (name, max, onchange) {
	this.name = name;
	this.max = max;
	this.data = JSON.parse(localStorage[name] || '[]');
	this.bu_stamp = new Date().getTime();
	this.onchange_cb = onchange;
	if (this.onchange_cb) this.onchange_cb(this);
}
History.BACKUP_INTERVAL = 30000;
History.MAX_NUMBER = 10;
History.prototype.backup = function () {
	this.bu_stamp = new Date().getTime();
	var d = JSON.parse(JSON.stringify(this.data));
	while (save.length) {
		try {
			localStorage[this.name] = JSON.stringify(d);
			break;
		} catch (e) {
			console.error('Could not save data into localStorage');
			d.pop();
		}
	}
}
History.prototype.onchange = function () {
	var self = this;
	clearTimeout(this.timer);
	this.timer = setTimeout(function () { self.backup() }, Math.max(200, (this.bu_stamp || 0) + History.BACKUP_INTERVAL - new Date().getTime()));
	if (this.onchange_cb) this.onchange_cb(this);
}
History.prototype.add = function (data) {
	while (this.data.length >= this.max) {
		this.data.pop();
	}
	this.data.unshift(JSON.parse(JSON.stringify(data)));
	this.onchange();
}
History.prototype.get = function (num, peek) {
	var data = this.data[num || 0];
	if (data && !peek) {
		this.data.splice(num || 0, 1);
		this.onchange();
	}
	return data;
}
History.prototype.isEmpty = function () {
	return this.data.length == 0;
}
History.prototype.walk = function (callback) {
	for (var i in this.data) callback(this.data[i], i);
}
History.prototype.clear = function () {
	this.data = [];
	this.onchange();
}

// Project specific stuff

var hist = { recent: null, undo: null, redo: null };
for (var n in hist) {
	hist[n] = new History('ed_' + n, History.MAX_NUMBER, function (h) {
		disable('.' + h.name.replace('_', '-'), !h.isEmpty());
	});
}

var editor = new Editor(sel('#editor'), function (chunks, values) {
	hist.undo.add({ id: editor.id, chunks: chunks, values: values, cids: editor.getVisible() });
	hist.redo.clear();
	var tosave = [];
	for (var cid in chunks) {
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
				throw new Error('Failed to load ' + url);
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
			file ? resolve(file) : reject(new Error('No file chosen'));
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
		store.put({ name: fileName, data });

		// Pass when transaction is complete
		tx.oncomplete = () => resolve(data);

		tx.onerror = (e) => reject(e);
	});
}

function open(id, onsuccess) {
	let promise;
	// Load file from FileInIndexedDB
	if (id !== undefined) {
		promise = retriveFileInIndexedDB(id);
	} else {
		// Open new file
		promise = loadTemplate('templates', 'template.json')
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
			if (data == editor.id) hist.recent.get(i);
		});
		hist.recent.add(editor.id);
		if (onsuccess) onsuccess();
	});
	editor.load(data, false);
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
	return { id: fileName, chunks: mChunks, js: template.js, css: template.css };
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
				chunk: { 'id': null, 'name': key, 'value': match[0] }
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
			chunks.push({ 'id': ++id, 'name': '', 'value': content.substring(pos, start) });
		}

		c.id = ++id;
		chunks.push(c);
		pos = end;
	}

	// Add any remaining content at the end
	if (pos < content.length) {
		chunks.push({ 'id': ++id, 'name': '', 'value': content.substring(pos) });
	}

	return chunks;
}

function setChunks(chunks, mChunks) {
	let i = 0, j = 0;

	while (i < chunks.length || j < mChunks.length) {
		if (i < chunks.length && j < mChunks.length && chunks[i].id === mChunks[j].id) {
			// If both chunks and mChunks have the same id, merge them
			if (chunks[i].append || false) {
				mChunks[j].value = mChunks[j].value + (chunks[i].value || '');
			} else {
				mChunks[j].value = chunks[i].value || '';
			}
			i++;
			j++;
		} else if (i < chunks.length && (j >= mChunks.length || chunks[i].id < mChunks[j].id)) {
			// If no matching mChunk, just add the chunk
			throw new Error(`No matching mChunk found for chunk with id: ${chunks[i].id}`);
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
	var data = hist[reverse ? 'redo' : 'undo'].get();
	if (!data) return;
	var cids = editor.getVisible();
	editor.render([]);
	function h() {
		var current = {}, next = {};
		for (var cid in data.chunks) {
			var f = cid[0] == 'h' ? 'hidden' : 'chunks';
			var c = editor[f][cid.substring(1)];
			if (c.value != data.values[cid]) {
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
		hist[reverse ? 'undo' : 'redo'].add({ id: data.id, chunks: current, values: next, cids: cids });
		var tosave = [], hids = [];
		for (var cid in data.chunks) {
			var d = data.chunks[cid];
			var f = cid[0] == 'h' ? 'hidden' : 'chunks';
			editor[f][cid.substring(1)] = d;
			tosave.push(d);
			if (f == 'hidden') hids.push(cid.substring(1));
		}
		save(tosave);
		if (hids.length) editor.renderHidden(hids);
		editor.render(data.cids);
	}
	if (data.id != editor.id) {
		open(data.id, h);
	} else {
		h();
	}
}

evt('.ed-open', 'click', function () {
	editor.ischanged(function () { open(); });
});
evt('.ed-recent', 'click', function (e) {
	var t = ttip(e.target, e);
	hist.recent.walk(function (data, id) {
		var a = document.createElement('a');
		a.setAttribute('href', '#');
		a.dataset.open = id;
		a.innerHTML = data.split("\t")[0].replace(/^.*?([^\\\/]+)$/, '$1');
		t.appendChild(a);
	});
	t.classList.add('dropdown');
	e.stopPropagation();
});
evt('.ed-save', 'click', function () {
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
		window.location.href='about:blank';
	}
});

document.addEventListener('click', function (e) {
	var t = e.target;
	if (t && t.matches('[data-open]')) {
		editor.ischanged(function () {
			open(hist.recent.get(t.dataset.open));
		});
	}
});

// $(window).on('load resize', function () {
// 	$('body').addClass('resizing');

// 	$('body').removeClass('resizing');
// });

