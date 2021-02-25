function sel(s, dom) {
	return (dom || document).querySelector(s);
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
	var t = xml.replace(/<[^>]+>/sg, ' ').trim();
	return decode ? decXml(t) : t;
}
function selToText(dom, s, decode) {
	return xmlToText(sel(s, dom).innerHTML, decode);
}
function addMsg(message, cls) {
	var m = document.createElement('div');
	m.className = cls || 'error';
	m.innerHTML = message;
	sel('#message').appendChild(m);
	setTimeout(function () { m.remove() }, 5000);
}
function delMsg() {
	sel('#message').innerHTML = '';
}
function addConfirm(message, onconfirm) {
	var m = document.createElement('div');
	m.className = 'confirm';
	m.innerHTML = message + '<a href="#" class="btn error yes">' + _('Yes') + '</a> <a href="#" class="btn cancel">' + _('Cancel') + '</a>';
	m.addEventListener('click', function (e) {
		var t = e.target;
		if (!t || !t.matches('.yes,.cancel')) return;
		t.closest('.confirm').remove();
		if (t.matches('.yes')) onconfirm();
	});
	sel('body').appendChild(m);
}
function ttip(dom, event, modal) {
	var c = dom.offsetParent;
	var o = event ? [event.offsetY, event.offsetX] : [0, 0];
	o[0] += dom.offsetTop;
	o[1] += dom.offsetLeft;
	var t = document.createElement('div');
	t.className = 'tooltip' + (modal ? ' modal' : '');
	if (o[0] > c.clientHeight / 2) {
		t.style.bottom = (c.clientHeight - o[0]) + 'px';
	} else {
		t.style.top = (o[0] + (event ? 0 : dom.offsetHeight)) + 'px';
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
	clean_ttip(t.closest('.tooltip'));
	if (modal) document.body.classList.add('has-modal');
	dom.parentNode.insertBefore(t, dom.nextSibling);
	return t;
}
function clean_ttip(t) {
	each('.tooltip:not(.modal)', function (i) {
		if (i == t) return;
		var t2 = find('.tooltip', i);
		for (var j in t2) { if (t2[j] == t) return; }
		trg(i, 'close');
	});
	if (!sel('.tooltip.modal')) document.body.classList.remove('has-modal');
}
function disable(s, enable, dom) {
	sel(s, dom).classList.toggle('disabled', !enable);
}
document.addEventListener('click', function (e) {
	var t = e.target;
	if (!t) return;
	if (t.matches('.disabled')) {
		e.stopPropagation();
		e.preventDefault();
	}
	if (t.matches('a[href="#"]')) e.preventDefault();
	if (t.matches('.tooltip .close')) trg(t.closest('.tooltip'), 'close');
	if (t.matches('.dropdown .input')) return;
	clean_ttip(t.closest('.tooltip:not(.dropdown)'));
});
document.addEventListener('close', function (e) {
	var t = e.target;
	if (t && t.matches('.tooltip')) {
		setTimeout(function () {
			t.remove();
			if (!sel('.tooltip.modal')) document.body.classList.remove('has-modal');
		}, 50);
	}
});

window.addEventListener('DOMContentLoaded', function () {
	var _instanceId = Math.floor(Math.random() * 900000) + 100000;
	navigator.sendBeacon('/add-session?id=' + _instanceId)
	window.addEventListener('unload', function () {
		navigator.sendBeacon('/del-session?id=' + _instanceId);
	});
});

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
	dom.addEventListener('change', function (e) {
		var t = e.target;
		if (t && t.matches('[data-cid]')) self.onchange([t.dataset.cid]);
	});
	dom.addEventListener('click', function (e) {
		var t = e.target;
		if (!t) return;
		if (t.matches('[data-render]')) self.render([parseInt(t.dataset.render)]);
		if (t.matches('.plus-one')) {
			var cid = parseInt(t.dataset.next);
			dom.insertBefore(self.renderChunk(cid), t);
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
		e.addEventListener('load', function () {
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
	for (var hid in hdata) {
		var h = this.hidden[hid];
		if (h.id) {
			var v = hdata.replace(/(\r?\n|\r)/g, this.eol);
			if (h.value != v) {
				changed = true;
				chunks['h' + hid] = c;
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
Editor.prototype.renderChunk = function (cid) {
	cid = parseInt(cid);
	var c = this.chunks[cid];
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
	this.onchange_cb = onchange;
	if (this.onchange_cb) this.onchange_cb(this);
}
History.prototype.onchange = function () {
	localStorage[this.name] = JSON.stringify(this.data);
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
		this.data.splice(num, 1);
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
	hist[n] = new History('ed_' + n, 10, function (h) {
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

function open(id, onsuccess) {
	fetch('/open?id=' + encodeURIComponent(id || '')).then(r => r.json()).then(function (data) {
		if (!data.success) {
			addMsg(data.error || _('Unknown Error'));
			return;
		}
		evt(editor.dom, 'load', function () {
			hist.recent.walk(function (data, i) {
				if (data == editor.id) hist.recent.get(i);
			})
			hist.recent.add(editor.id);
			if (onsuccess) onsuccess();
		});
		editor.load(data, false);
	});
}
function save(chunks) {
	fetch('/save?create=' + (chunks ? 0 : 1) + '&id=' + encodeURIComponent(editor.id || 0), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(chunks || editor.chunks)
	}).then(r => r.json()).then(function (data) {
		if (!data.success) {
			addMsg(data.error || _('Unknown Error'));
			return;
		}
		addMsg(_('Document Saved'), 'success');
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
			var c = editor[f][cid.substr(1)];
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
		var tosave = [];
		for (var cid in data.chunks) {
			var d = data.chunks[cid];
			var f = cid[0] == 'h' ? 'hidden' : 'chunks';
			editor[f][cid.substr(1)] = d;
			tosave.push(d);
		}
		save(tosave);
		editor.render(data.cids);
	}
	if (data.id != editor.id) {
		open(data.id, h);
	} else {
		h();
	}
}

sel('.ed-open').addEventListener('click', function () {
	editor.ischanged(function () { open(); });
});
sel('.ed-recent').addEventListener('click', function (e) {
	var t = ttip(e.target);
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
sel('.ed-save').addEventListener('click', function () {
	save();
});
sel('.ed-undo').addEventListener('click', function () {
	undo();
});
sel('.ed-redo').addEventListener('click', function () {
	undo(true);
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

