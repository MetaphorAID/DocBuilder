function sel(s, dom) {
	return (dom || document).querySelector(s) || {};
}
function each(sel, fn, dom) {
	var arr = typeof (sel) == 'string' ? ((dom || document).querySelectorAll(sel) || []) : (
		sel instanceof HTMLElement ? [sel] : sel
	)
	for (var i = 0; i < arr.length; ++i) if (fn(arr[i], i) === false) break;
}
function evt(sel, t, fn, dom) {
	each(sel, function (i) {
		t.split(' ').forEach(function (e) { i.addEventListener(e, fn); });
	}, dom);
}

document.addEventListener('click', function (e) {
	if (!e.target && e.target.matches('a[href="#"]')) {
		e.preventDefault();
	}
});

window.addEventListener('DOMContentLoaded', function () {
	var _instanceId = Math.floor(Math.random() * 900000) + 100000;
	navigator.sendBeacon('/add-session?id=' + _instanceId)
	window.addEventListener('unload', function () {
		navigator.sendBeacon('/del-session?id=' + _instanceId);
	});
});

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
function addConfirm(message, callback) {
	var m = document.createElement('div');
	m.className = 'confirm';
	m.innerHTML = message + '<a href="#" class="btn error yes">Yes</a> <a href="#" class="btn cancel">Cancel</a>';
	m.addEventListener('click', function (e) {
		if (!e.target || !e.target.matches('.yes,.cancel')) return;
		e.target.closest('.confirm').remove();
		if (e.target.matches('.yes')) callback();
	});
	sel('body').appendChild(m);

}

function ttip(dom, event) {
	var c = dom.offsetParent;
	var o = event ? [event.offsetY, event.offsetX] : [0, 0];
	o[0] += dom.offsetTop;
	o[1] += dom.offsetLeft;
	var t = document.createElement('div');
	t.className = 'tooltip';
	if (o[0] > c.clientHeight / 2) {
		t.style.bottom = (c.clientHeight - o[0]) + 'px';
	} else {
		t.style.top = (o[0] + (event ? 0 : dom.offsetHeight)) + 'px';
	}
	if (o[1] < c.clientWidth / 2) {
		t.style.left = o[1] + 'px';
	} else {
		t.style.right = (c.clientWidth - o[1] - (event ? 0 : dom.offsetWidth)) + 'px';
	}

	each('.tooltip', function (i) {
		i.remove();
	}, c);
	dom.parentNode.insertBefore(t, dom.nextSibling);
	return t;
}
document.addEventListener('click', function (e) {
	if (!e.target) return;
	each('.tooltip', function (i) { i.remove(); }, e.target);
});

var Editor = function (dom) {
	this.dom = dom;
	this.data = {};

	var self = this;

	dom.addEventListener('change', function (e) {
		if (e.target && e.target.matches('[data-cid]')) {
			self.onchange(e.target);
		}
	});

	dom.addEventListener('click', function (e) {
		if (!e.target) return;
		if (e.target.matches('[data-render]')) {
			var cid = parseInt(e.target.dataset.render);
			if (self.chunks[cid]) self.render(cid);
		}

		if (e.target.matches('.plus-one')) {
			var cid = parseInt(e.target.dataset.cid);
			dom.insertBefore(self.renderChunk(cid), e.target);
			if (self.chunks.length > cid + 1) {
				e.target.dataset.cid = cid + 1;
			} else {
				e.target.remove();
			}
		}
	});

	window.addEventListener('beforeunload', function (e) {
		if (!self.onsaved()) {
			e.preventDefault();
			e.returnValue = 'Unsaved changes!';
			return 'Unsaved changes!';
		}
	});
}
Editor.TYPES = {
	_default_: {
		getValue: function (input, chunk) {
			return input.value;
		},
		render: function (chunk) {
			if (!chunk.id || !chunk.name) {
				var e = document.createElement('pre');
				e.textContent = chunk.value;
				return e;
			}
			var e = document.createElement('textarea');
			e.className = 'input';
			e.textContent = chunk.value;
			return e;
		}
	}
};
Editor.prototype.load = function (data, show_filler) {
	if (!data.id) return;
	this.id = localStorage.last_id = data.id;

	if (!show_filler) {
		this.chunks = [];
		for (var c in data.chunks || []) {
			if (!data.chunks[c].name) continue;
			this.chunks.push(data.chunks[c]);
		}
	} else {
		this.chunks = data.chunks || [];
	}

	this.dom.innerHTML = '';

	for (var css in data.css || []) {
		css = data.css[css];
		if (sel('link[href="' + css + '"]').nodeName) continue;
		var e = document.createElement('link');
		e.setAttribute('rel', 'stylesheet');
		e.setAttribute('href', css);
		sel('head').appendChild(e);
	}

	var loading = 0;
	for (var js in data.js || []) {
		js = data.js[js];
		if (sel('script[src="' + js + '"]').nodeName) continue;
		++loading;
		var e = document.createElement('script');
		e.setAttribute('src', js);
		e.addEventListener('load', function () {
			--loading;
		});
		sel('body').appendChild(e);
	}

	if (!this.chunks.length) return;

	var self = this;
	function onload() {
		if (loading > 0) {
			setTimeout(onload, 50);
			return;
		}
		self.render(0);
		addMsg('Document loaded', 'success');
	}
	onload();

}
Editor.prototype.onsaved = function (callback) {
	var saved = true;
	var self = this;
	each('[data-cid]', function (i) {
		var c = self.chunks[i.dataset.cid];
		var t = (c.name ? Editor.TYPES[c.name] : false) || Editor.TYPES._default_;
		if (c.id && t.getValue) {
			if (c.value != (t || Editor.TYPES._default_).getValue(i, c)) {
				saved = false;
			}
		}
	}, self.dom);
	if (!callback) {
		return saved;
	} else if (saved) {
		callback();
		return;
	}
	addConfirm('There are unsaved changes! Are you sure?', callback);
}
Editor.prototype.onchange = function (input) {
	var c = this.chunks[input.dataset.cid];
	var t = (c.name ? Editor.TYPES[c.name] : false) || Editor.TYPES._default_;
	if (c.id && t.getValue) {
		c.value = (t || Editor.TYPES._default_).getValue(input, c);
		save([c]);
	}
}
Editor.prototype.render = function (cid) {
	var self = this;
	self.onsaved(function () {
		self.dom.innerHTML = '';
		self.dom.appendChild(self.renderPaginator(cid));
		self.dom.appendChild(self.renderChunk(cid));

		if (self.chunks.length > cid + 1) {
			var a = document.createElement('a');
			a.setAttribute('href', '#');
			a.className = 'btn plus-one';
			a.dataset.cid = cid + 1;
			a.innerHTML = '+1';
			self.dom.appendChild(a);
		}
	});
}
Editor.prototype.renderChunk = function (cid) {
	var c = this.chunks[cid];
	var t = c.name ? Editor.TYPES[c.name] : false;
	var e = (t || Editor.TYPES._default_).render(c);
	if (e) e.dataset.cid = cid;
	return e;
}
Editor.prototype.renderPaginator = function (cid) {
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

var editor = new Editor(sel('#editor'));

function open() {
	editor.onsaved(function () {
		fetch('/open').then(r => r.json()).then(function (data) {
			if (!data.success) {
				addMsg(data.error || 'Unknown Error');
				return;
			}
			editor.load(data);
		});
	});
}

function restore() {
	editor.onsaved(function () {
		fetch('/restore?id=' + (localStorage.last_id || 0)).then(r => r.json()).then(function (data) {
			if (!data.success) {
				addMsg(data.error || 'Unknown Error');
				return;
			}
			editor.load(data);
		});
	});
}

function save(chunks) {
	fetch('/save?create=' + (chunks ? 0 : 1) + '&id=' + (editor.id || 0), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(chunks || editor.chunks)
	}).then(r => r.json()).then(function (data) {
		if (!data.success) {
			addMsg(data.error || 'Unknown Error');
			return;
		}
		addMsg('Document saved', 'success');
	});
}

// $(window).on('load resize', function () {
// 	$('body').addClass('resizing');

// 	$('body').removeClass('resizing');
// });

