Locale['EMPTY'] = 'ÜRES';
Locale['Sticks To...'] = 'Ragadás...';
Locale['Sticks Left'] = 'Balra ragad';
Locale['Sticks Right'] = 'Jobbra ragad';
Locale['Does Not Stick'] = 'Nem ragad';

Locale['Save'] = 'Elment';
Locale['Detailed'] = 'Részletes';
Locale['Simple'] = 'Egyszerű';
Locale['Re-Analyze'] = 'Új elemzés';
Locale['Select Ana.'] = 'Elemzés választása';
Locale['Fix Token'] = 'Token javítása';
Locale['Join Token...'] = 'Token összevon...';
Locale['Split Token...'] = 'Token szétszed...';
Locale['Type: Word'] = 'Típus: Szó';
Locale['Type: Punct'] = 'Típus: Punkt.';

Locale['Select Sentinence...'] = 'Érzelemtípus...';
Locale['Move Sentence...'] = 'Mondat mozgat...';
Locale['Join Sentence...'] = 'Mondat összevon...';
Locale['Split Sentence...'] = 'Mondat szétszed...';
Locale['Before'] = 'Előtte';
Locale['After'] = 'Utána';

Locale['Invalid Action'] = 'Nem végrehajtható akció';

TOKEN_STICKY = {
	'left': 'Sticks Left',
	'right': 'Sticks Right',
	'no': 'Does Not Stick'
}

SENT_TYPE = {
	'Bánat': 'Bánat',
	'Düh': 'Düh',
	'Elégedetlenség': 'Elégedetlenség',
	'Félelem': 'Félelem, Rémület (tartalmazza a Szorongást)',
	'Gúnyolódás': 'Gúnyolódás, Kifogásolás',
	'Irigység': 'Irigység, Féltékenység',
	'Undor': 'Undor, Megvetés',
	'Kellemetlenség': 'Kellemetlenség',
	'Együttérzés': 'Együttérzés, Szimpátia',
	'Érdeklődés': 'Érdeklődés (Interest)',
	'Nosztalgia': 'Nosztalgia',
	'Szokatlanság': 'Szokatlanság, Meglepődés',
	'Elégedettség': 'Elégedettség',
	'Öröm': 'Öröm',
	'Reménykedés': 'Reménykedés, Bizakodás, Vágyakozás'
}

ANNOT_TYPE = {
	'Személynév': 'Személynév',
	'Helynév': 'Helynév',
	'Intézménynév': 'Intézménynév'
}

var _active = {};
var _annots = { changed: false };

Editor.TYPES.p = {
	remove: function (input, chunk) {
		if (_annots.xml) {
			each('token', function (i) {
				var id = i.getAttribute('xml:id');
				if (!_annots.ref[id]) return;
				for (var j in _annots.ref[id]) {
					j = sel('[data-aid="' + j + '"]');
					if (j) j.remove();
				}
			}, _active[input.dataset.cid]);
		}
		delete _active[input.dataset.cid];
	},
	getValue: function (input, chunk) {
		var x = _active[input.dataset.cid];
		return x ? x.documentElement.outerHTML : chunk.value;
	},
	render: function (chunk, cid) {
		var pr = 0;
		for (var cid2 in _active) pr = Math.max(pr, editor.chunks[cid2].id || 0);
		var h = '';
		for (var i in editor.hidden) {
			i = editor.hidden[i];
			if ((i.id || 0) > (editor.chunks[cid].id || 0)) break;
			if ((i.id || 0) < pr) continue;
			if (i.name == '.head') h = i.value;
		}

		var x = parseXml(chunk.value);
		_active[parseInt(cid)] = x;
		var ep = parsePar(x);
		if (!ep.children.length) {
			ep.innerHTML = xmlToText(chunk.value) || '<em>' + _('EMPTY') + '</em>';
		} else {
			ep.className = 'par';
			if (_annots.xml) {
				each('token', function (i) {
					var id = i.getAttribute('xml:id');
					if (!_annots.ref[id]) return;
					for (var j in _annots.ref[id]) {
						if (sel('[data-aid="' + j + '"]')) return;
						var d = document.createElement('div');
						d.dataset.aid = j;
						d.className = 'annot';
						d.innerHTML = _annots.list[j].getAttribute('entity') + ': ' + xmlToText(_annots.list[j].innerHTML);
						sel('#footer').appendChild(d);
					}
				}, x);
			}
		}
		if (h) ep.innerHTML = '<h4>' + h + '</h4>' + ep.innerHTML;
		return ep;
	},
}

evt(editor.dom, 'change-hidden', function () {
	for (var i in editor.render_hidden) {
		var hid = editor.render_hidden[i];
		var h = editor.hidden[hid];
		if (h.name == '.header') {
			var html = '';
			var x = parseXml(h.value);
			html = '<h2>' + selToText(x, 'title') + '</h2>'
				+ '<h3>' + selToText(x, 'author') + '</h3>' + html;
			sel('#header').innerHTML = html;
		}
		if (h.name == '.annotations') {
			_annots = { id: hid, xml: parseXml(h.value), list: [], ref: {}, changed: false }
			each('annotation', function (i, ii) {
				_annots.list.push(i);
				each('token', function (j) {
					var t = j.getAttribute('target');
					if (!_annots.ref[t]) _annots.ref[t] = {};
					_annots.ref[t][ii] = (j.previousElementSibling ? 0 : 1) + (j.nextElementSibling ? 0 : 2);
				}, i);
			}, _annots.xml);
			sel('#footer').innerHTML = '';
		}
	}
});

evt(editor.dom, 'load', function () {
	sel('#header').innerHTML = '';
	sel('#footer').innerHTML = '';
});

function getSelect(tid, cls, val, empty_opt, opts) {
	var s = select(val, empty_opt, opts);
	s.className += ' ' + cls;
	if (tid) s.dataset.tid = tid;
	return s.outerHTML;
}
function getLink(tid, cls, txt, tpl) {
	return '<a href="#" class="' + cls + '"' + (tid ? ' data-tid="' + tid + '"' : '') + '>' + (tpl ? tpl.replace('@', _(txt)) : _(txt)) + '</a>';
}

function getUID(xml, prefix, start) {
	if (!sel('[*|id="' + prefix + (start ? '_' + start : '') + '"]', xml)) {
		return prefix + (start ? '_' + start : '');
	}
	return getUID(xml, prefix, start ? start + 1 : 2);
}
function parseXml(xml) {
	return (new DOMParser()).parseFromString(xml, 'text/xml');
}
function delNode(s) {
	if (s.previousSibling && s.previousSibling.nodeName == '#text') s.previousSibling.remove();
	s.remove();
}

function parsePar(dom) {
	var ep = document.createElement('div');
	each('s,l', function (s, si) {
		es = document.createElement('div');
		es.className = 's';
		es.dataset.sid = si;
		each('token', function (w, wi) {
			ew = document.createElement('span');
			var j = w.getAttribute('join') || '';
			ew.className = 't' + (j.match('^(left|right)$') ? ' ' + j : '');
			ew.dataset.tid = wi;
			var tkn = sel('form', w);
			if (!tkn) return;
			if (tkn.getAttribute('modified') == 'True') ew.className += ' modified';
			var morph = sel('morph', w);
			if (morph && morph.getAttribute('check') == 'False') ew.className += ' unchecked';
			ew.innerHTML = tkn.innerHTML || '&nbsp;';
			es.appendChild(ew);
		}, s);
		ew = document.createElement('span');
		ew.className = 'cfg';
		if (!s.getAttribute('sent')) ew.className += ' unchecked';
		ew.innerHTML = "⚙";
		es.appendChild(ew);
		ep.appendChild(es);
	}, dom);
	return ep;
}

function savePar(cids) {
	var hdata = {}, hids = [];
	if (_annots.changed) {
		hdata[_annots.id] = _annots.xml.documentElement.outerHTML;
		hids.push(_annots.id);
	}
	_annots.changed = false;
	var vis = editor.getVisible();
	editor.onchange(cids, hdata);
	if (hids.length) editor.renderHidden(hids);
	editor.render(vis);
}

function updAnnot(from, to) {
	if (!_annots.xml) return;
	var t1 = to[0].getAttribute('xml:id');
	console.log(from);
	console.log(to);
	each('[target="' + from.join('"],[target="') + '"]', function (i) {
		_annots.changed = true;
		var a = i.closest('annotation');
		if (!sel('[target="' + t1 + '"]', a) || t1 == i.getAttribute('target')) {
			for (var t in to) {
				t = to[t];
				var d = _annots.xml.createElement('token');
				d.setAttribute('target', t.getAttribute('xml:id'));
				d.textContent = sel('form', t).textContent;
				a.insertBefore(d, i);
			}
		}
		i.remove();
	}, _annots.xml);
	console.log(_annots);
}

document.addEventListener('click', function (e) {
	var t = e.target;
	if (!t) return;

	var c = t.closest('.par');
	if (!c) return;

	var cid = parseInt(c.dataset.cid);
	var x = _active[cid];
	var s = t.closest('.s');
	var sid = parseInt(s.dataset.sid);
	var xsl = find('s,l', x);
	var xs = xsl[sid];
	var tid = t.dataset.tid;
	var xtl = find('token', xs);
	var xt = tid ? xtl[tid] : false;

	// open tooltip
	if (t.matches('.t, .cfg')) {
		each('.par .active', function (i) { i.classList.remove('active'); });
		var html = '';
		if (xt) { //token
			t.classList.add('active');
			if (sel('morph', xt)) {
				html += getLink(tid, 'edit ana', 'Select Ana.');
			}
			if (_annots.xml) {
				html += getSelect(tid, 'add annot', '', 'New Annotation...', ANNOT_TYPE);
				// annotations containing the token
				var has = false;
				var lst = {};
				var items = _annots.ref[xt.getAttribute('xml:id')];
				for (var i in items || {}) {
					if (items[i] == 0) continue;
					has = true;
					lst[i] = xmlToText(_annots.list[i].innerHTML);
				}
				if (has) html += getSelect(tid, 'delfrom annot', '', 'Delete From Annotation...', lst);
				// annotations next to the token
				has = false;
				lst = {};
				if (tid > 0) {
					items = _annots.ref[xtl[parseInt(tid) - 1].getAttribute('xml:id')];
					for (var i in items || {}) {
						if ((items[i] & 2) == 0) continue;
						has = true;
						lst['L' + i] = xmlToText(_annots.list[i].innerHTML);
					}
				}
				if (tid < xtl.length - 1) {
					items = _annots.ref[xtl[parseInt(tid) + 1].getAttribute('xml:id')];
					for (var i in items || {}) {
						if ((items[i] & 1) == 0) continue;
						has = true;
						lst['F' + i] = xmlToText(_annots.list[i].innerHTML);
					}
				}
				if (has) html += getSelect(tid, 'addto annot', '', 'Add To Annotation...', lst);
			}
			html += getSelect(tid, 'edit sticky', xt.getAttribute('join') || '?', 'Sticks To...', TOKEN_STICKY);
			var tkn = selToText(xt, 'form', true);
			if (tkn.length > 1) {
				var split = {};
				for (var i = 1; i < tkn.length; ++i) {
					split[i] = encXml(tkn.substr(0, i)) + ' | ' + encXml(tkn.substr(i));
				}
				html += getSelect(tid, 'split token', '', 'Split Token...', split);
			}
			//html += getSelect(tid, 'edit tokentype', xt.nodeName, '', { w: 'Type: Word', pc: 'Type: Punct' });
			html += getSelect(tid, 'join token', '', 'Join Token...', { '0': 'Before', '1': 'After' });
			html += getLink(tid, 'edit token', 'Fix Token');
		} else {
			s.classList.add('active');
			html += getSelect(tid, 'edit sent multiple', (xs.getAttribute('sent') || '').split(';'), 'Select Sentinence...', SENT_TYPE);
		}
		if (xt) {
			html += getSelect(tid, 'split sent', '', 'Split Sentence...', { '0': 'Before', '1': 'After' });
		} else {
			html += getSelect(tid, 'join sent', '', 'Join Sentence...', { '0': 'Before', '1': 'After' });
			html += getSelect(tid, 'move sent', '', 'Move Sentence...', { '0': 'Before', '1': 'After' });
		}

		var tt = ttip(t);
		tt.classList.add('dropdown');
		tt.innerHTML = html;
		return;
	}

	if (t.matches('.edit.ana')) {
		var html = '';
		html += '<h3 class="tkn">' + _('Token') + ': <strong>' + selToText(xt, 'form') + '</strong></h3>';
		html += '<table><tr><th>' + _('Lemma') + '</th><th>' + _('Detailed') + '</th><th>' + _('Simple') + '</th><th></th></tr>';
		each('ana', function (i, ii) {
			if (i.getAttribute('modified') == 'True') return;
			html += '<tr><td>' + selToText(i, 'lemma') + '</td><td>' + selToText(i, 'detailed') + '</td><td>' + selToText(i, 'simple') + '</td>'
				+ '<td><a href="#" data-tid="' + tid + '" data-ana="' + ii + '" class="btn selAna ' + (i.getAttribute('correct') == 'True' ? 'selected' : '') + '">✓</a></td>'
		}, xt);
		var ana = sel('ana[modified="True"]', xt);
		html += '<tr>'
			+ '<td><input class="input" type="text" value="' + (ana ? selToText(ana, 'lemma') : '') + '"></td>'
			+ '<td><input class="input" type="text" value="' + (ana ? selToText(ana, 'detailed') : '') + '"></td>'
			+ '<td><input class="input" type="text" value="' + (ana ? selToText(ana, 'simple') : '') + '"></td>'
			+ '<td><a href="#" data-tid="' + tid + '" class="btn selAna ' + (ana ? 'selected' : '') + '">✓</a></td>'
		html += '</table>';
		html += '<div class="center">' + getLink(tid, 'btn ana fetch', 'Re-Analyze') + getLink(tid, 'btn ana save', 'Save') + '</div>';
		var tt = ttip(sel('.cfg', s), e, true);
		tt.innerHTML += html;
		evt('table input', 'focus', function () { trg('.btn', 'click', this.closest('tr')); }, tt)
		return;
	}
	if (t.matches('.btn.selAna')) {
		each('ana', function (i) { i.setAttribute('correct', 'False') }, xt);
		each('.btn.selAna', function (i) { i.classList.remove('selected') }, t.closest('table'));
		t.classList.add('selected');
		if (t.dataset.ana) find('ana', xt)[t.dataset.ana].setAttribute('correct', 'True');
		return;
	}
	if (t.matches('.save.ana')) {
		var morph = sel('morph', xt);
		var mod = sel('ana[modified="True"]', morph);
		if (mod) delNode(mod);
		if (!sel('ana[correct="True"]', morph)) {
			var vals = find('input', sel('.selAna.selected', t.closest('.tooltip')).closest('tr'));
			var tpl = sel('ana', x);
			var ana = parseXml(tpl.outerHTML).documentElement;
			ana.setAttribute('correct', 'True');
			ana.setAttribute('modified', 'True');
			sel('lemma', ana).textContent = vals[0].value.trim();
			sel('detailed', ana).textContent = vals[1].value.trim();
			sel('simple', ana).textContent = vals[2].value.trim();
			morph.appendChild(ana);
			if (ana.previousSibling && ana.previousSibling.nodeName == '#text') {
				morph.appendChild(ana.previousSibling);
			}
			if (tpl.previousSibling && tpl.previousSibling.nodeName == '#text') {
				morph.insertBefore(x.createTextNode(tpl.previousSibling.textContent), ana);
			}
		}
		morph.setAttribute('check', 'True');
		savePar([cid]);
		return;
	}
	if (t.matches('.fetch.ana')) {
		var formData = new FormData();
		formData.append('file', new Blob(['form\n' + sel('form', xt).textContent + '\n'], { type: 'text/plain' }), 'input.txt');
		fetch('/proxy?u=' + encodeURIComponent('http://emtsv.elte-dh.hu:5000/morph'), {
			method: 'POST',
			body: formData
		}).then(r => r.text()).then(function (data) {
			data = data.replace(/^[^\r\n]*[\r\n]+[^\t]*\t/, '');
			data = JSON.parse(data);
			var morph = sel('morph', xt);
			each('ana', function (i) { delNode(i); }, morph);
			var tpl = sel('ana', x);
			for (var d in data) {
				d = data[d];
				var ana = parseXml(tpl.outerHTML).documentElement;
				ana.setAttribute('correct', 'False');
				sel('lemma', ana).textContent = d.lemma;
				sel('detailed', ana).textContent = d.readable;
				sel('simple', ana).textContent = d.tag;
				morph.appendChild(ana);
				if (ana.previousSibling && ana.previousSibling.nodeName == '#text') {
					morph.appendChild(ana.previousSibling);
				}
				if (tpl.previousSibling && tpl.previousSibling.nodeName == '#text') {
					morph.insertBefore(x.createTextNode(tpl.previousSibling.textContent), ana);
				}
			}
			morph.setAttribute('check', 'False');
			savePar([cid]);
		});
	}

	if (t.matches('.edit.token')) {
		var html = '';
		html += '<input type="text" class="input" value="' + selToText(xt, 'form') + '">';
		html += '<div class="center">' + getLink(tid, 'btn token save', 'Save') + '</div>';
		var tt = ttip(sel('.cfg', s), e, true);
		tt.innerHTML += html;
		return;
	}
	if (t.matches('.save.token')) {
		var tkn = sel('form', xt);
		var val = sel('input', t.closest('.tooltip')).value;
		if (tkn.textContent == val) return;
		tkn.setAttribute('modified', "True");
		var morph = sel('morph', xt);
		if (morph) { morph.setAttribute('check', 'False'); morph.innerHTML = ''; }
		tkn.textContent = val;
		savePar([cid]);
		return;
	}

});

document.addEventListener('change', function (e) {
	var t = e.target;
	if (!t) return;

	var c = t.closest('.par');
	if (!c) return;

	var cid = parseInt(c.dataset.cid);
	var x = _active[cid];
	var s = t.closest('.s');
	var sid = parseInt(s.dataset.sid);
	var xsl = find('s,l', x);
	var xs = xsl[sid];
	var tid = t.dataset.tid;
	var xtl = find('token', xs);
	var xt = tid ? xtl[tid] : false;

	// sentence stuff

	if (t.matches('.edit.sent')) {
		if ((xs.getAttribute('sent') || '') == t.value) return;
		xs.setAttribute('sent', t.value);
		savePar([cid]);
		return;
	}

	if (t.matches('.join.sent')) {
		if (t.value == '') return;
		var off = t.value == '0' ? -1 : 1;
		var u, cids;
		if (xsl[sid + off]) {
			u = off > 0 ? [xs, xsl[sid + off]] : [xsl[sid + off], xs];
			cids = [cid];
		} else {
			if (!_active[cid + off]) {
				var e = editor.renderChunk(cid + off);
				if (e) c.parentNode.insertBefore(e, off > 0 ? c.nextSibling : c);
			}
			if (!_active[cid + off]) {
				addMsg(_('Invalid Action'));
				return;
			}
			u = off > 0 ? [xs, sel('s', _active[cid + off])] : [sel('s:last-of-type', _active[cid + off]), xs];
			cids = off > 0 ? [cid, cid + off] : [cid + off, cid];
		}
		if (!u[0] || !u[1]) {
			addMsg(_('Invalid Action'));
			return;
		}
		u[0].innerHTML = u[0].innerHTML.replace(/[ \r\n\t]+$/, '') + u[1].innerHTML;
		var id2 = u[1].getAttribute('xml:id').split('_');
		delNode(u[1]);
		var id1 = u[0].getAttribute('xml:id').split('_');
		if (id1.length > 1) {
			if (id2.length > 1) {
				u[0].setAttribute('xml:id', '');
				u[0].setAttribute('xml:id', getUID(x, id[0]));
			} else {
				u[0].setAttribute('xml:id', id2[0]);
			}
		}
		savePar(cids);
		return;
	}

	if (t.matches('.split.sent')) {
		if (t.value == '') return;
		var xt2 = xtl[parseInt(tid) + (t.value == '0' ? 0 : 1)];
		if (!xt2 || xt2 == xtl[0]) {
			addMsg(_('Invalid Action'));
			return;
		}
		var indent = xs.previousSibling && xs.previousSibling.nodeName == '#text' ? xs.previousSibling.textContent : '';
		xs.insertBefore(x.createElement('split'), xt2);
		var xe = x.documentElement;
		var id = xs.getAttribute('xml:id').split('_')[0];
		xe.innerHTML = xe.innerHTML.replace(/([ \t\r\n]*)<split[^>]*>/
			, indent + '</' + xs.nodeName + '>' + indent + '<' + xs.nodeName + (id ? ' xml:id="' + getUID(x, id) + '"' : '') + '> $1');
		savePar([cid]);
		return;
	}

	if (t.matches('.move.sent')) {
		if (t.value == '') return;
		var off = t.value == '0' ? -1 : 1;
		if (!_active[cid + off]) {
			var e = editor.renderChunk(cid + off);
			if (e) c.parentNode.insertBefore(e, off > 0 ? c.nextSibling : c);
		}
		if (!_active[cid + off] || (off > 0 && xsl.length > sid + 1) || (off < 0 && sid > 0)) {
			addMsg(_('Invalid Action'));
			return;
		}
		var x2 = _active[cid + off].documentElement
		if (off > 0) {
			x2.innerHTML = x2.innerHTML.replace(/([ \t\r\n]*)</, '$1' + xs.outerHTML + '$1<');
		} else {
			var indent = xs.previousSibling && xs.previousSibling.nodeName == '#text' ? xs.previousSibling.textContent : '';
			x2.innerHTML = x2.innerHTML.replace(/([ \t\r\n]*)$/, indent + xs.outerHTML + '$1');
		}
		delNode(xs);
		savePar(off > 0 ? [cid, cid + off] : [cid + off, cid]);
		return;
	}

	// token stuff

	if (t.matches('.edit.sticky')) {
		tid = parseInt(tid);
		switch (xt.getAttribute('join')) {
			case 'left':
				if (tid > 0) xtl[tid - 1].setAttribute('join', 'no');
				break;
			case 'right':
				if (tid < xtl.length - 1) xtl[tid + 1].setAttribute('join', 'no');
				break;
		}
		xt.setAttribute('join', t.value);
		switch (t.value) {
			case 'left':
				if (tid > 0) xtl[tid - 1].setAttribute('join', 'right');
				break;
			case 'right':
				if (tid < xtl.length - 1) xtl[tid + 1].setAttribute('join', 'left');
				break;
		}
		savePar([cid]);
		return;
	}

	if (t.matches('.join.token')) {
		if (t.value == '') return;
		var off = t.value == '0' ? -1 : 1;
		var xt2 = xtl[parseInt(tid) + off];
		if (!xt2) {
			addMsg(_('Invalid Action'));
			return;
		}
		var u = off > 0 ? [xt, xt2] : [xt2, xt];
		var xml = '<form modified="True">' + selToText(u[0], 'form') + selToText(u[1], 'form') + '</form>';
		if (sel('morph', u[0]) || sel('morph', u[1])) xml += '<morph check="False"/>';
		var id2 = u[1].getAttribute('xml:id').split('_');
		delNode(u[1]);
		u[0].innerHTML = xml;
		var id1 = u[0].getAttribute('xml:id').split('_');
		if (id1.length > 1) {
			if (id2.length > 1) {
				u[0].setAttribute('xml:id', '');
				u[0].setAttribute('xml:id', getUID(x, id1[0]));
			} else {
				u[0].setAttribute('xml:id', id2[0]);
			}
		}
		updAnnot([id1.join('_'), id2.join('_')], [u[0]]);
		savePar([cid]);
		return;
	}

	if (t.matches('.split.token')) {
		if (t.value == '') return;
		var tkn = sel('form', xt);
		tkn.setAttribute('modified', 'True');
		var morph = sel('morph', xt);
		if (morph) {
			morph.setAttribute('check', 'False');
			morph.innerHTML = '';
		}
		var xt2 = parseXml(xt.outerHTML).documentElement;
		sel('form', xt2).textContent = tkn.innerHTML.substr(t.value);
		var id1 = xt.getAttribute('xml:id');
		if (id1) xt2.setAttribute('xml:id', getUID(x, id1.split('_')[0]));
		tkn.textContent = tkn.textContent.substr(0, t.value);
		xs.insertBefore(xt2, xt.nextSibling);
		if (xt.previousSibling && xt.previousSibling.nodeName == '#text') {
			xs.insertBefore(x.createTextNode(xt.previousSibling.textContent), xt.nextSibling);
		}
		updAnnot([id1], [xt, xt2]);
		savePar([cid]);
		return;
	}

	// if (t.matches('.edit.tokentype')) {
	// 	if (t.value == '' || t.value == xt.nodeName) return;
	// 	var xt2 = x.createElement(t.value);
	// 	xt2.innerHTML = xt.innerHTML;
	// 	sel('form', xt2).setAttribute('modified', 'True');
	// 	var id = x.documentElement.getAttribute('xml:id');
	// 	if (id) {
	// 		xt2.setAttribute('xml:id', getUID(x, t.value + id));
	// 		updAnnot([xt.getAttribute('xml:id')], [xt2]);
	// 	}
	// 	xs.insertBefore(xt2, xt);
	// 	xt.remove();
	// 	savePar([cid]);
	// 	return;
	// }

	// annotation stuff

	if (t.matches('.add.annot')) {
		if (t.value == '' || !_annots.xml) return;
		var i = _annots.xml.createElement(xt.nodeName);
		i.setAttribute('target', xt.getAttribute('xml:id'));
		i.textContent = sel('form', xt).textContent;
		var a = _annots.xml.createElement('annotation');
		a.setAttribute('entity', t.value);
		a.appendChild(i);
		//TODO: sort?
		_annots.xml.documentElement.appendChild(a);
		_annots.changed = true;
		savePar();
		return;
	}

	if (t.matches('.addto.annot')) {
		if (t.value == '' || !_annots.xml) return;
		var an = _annots.list[t.value.substr(1)];
		var i = _annots.xml.createElement(xt.nodeName);
		i.setAttribute('target', xt.getAttribute('xml:id'));
		i.textContent = sel('form', xt).textContent;
		an.insertBefore(i, t.value[0] == 'F' ? an.children[0] : null);
		_annots.changed = true;
		savePar();
		return;
	}

	if (t.matches('.delfrom.annot')) {
		if (t.value == '' || !_annots.xml) return;
		var an = _annots.list[t.value];
		sel('[target="' + xt.getAttribute('xml:id') + '"]', an).remove();
		if (!sel('[target]', an)) an.remove();
		_annots.changed = true;
		savePar();
		return;
	}

});

