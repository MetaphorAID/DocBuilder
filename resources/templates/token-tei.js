(function () {
	var TOKEN_STICKY = {
		'left': 'Sticks Left',
		'right': 'Sticks Right',
		'both': 'Sticks Both',
		'no': 'Does Not Stick'
	}

	var SENT_TYPE = {
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

	var ANNOT_TYPE = {
		'Személynév': 'Személynév',
		'Helynév': 'Helynév',
		'Intézménynév': 'Intézménynév'
	}

	Locale['Detailed'] = 'Részletes';
	Locale['Simple'] = 'Egyszerű';
	Locale['Re-Analyze'] = 'Új elemzés';
	Locale['Select Ana.'] = 'Elemzés választása';
	Locale['No Selected Analyzation'] = 'Nincs kiválasztva elemzés';
	Locale['Type: Word'] = 'Típus: Szó';
	Locale['Type: Punct'] = 'Típus: Punkt.';
	Locale['Select Sentinence...'] = 'Érzelemtípus...';

	var _active = {};
	var _annots = { changed: false };

	Editor.TYPES.t_p = {
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
				if (i.name == '.t_head') h = i.value;
			}

			var x = parseXml(chunk.value);
			_active[parseInt(cid)] = x;
			var ep = parsePar(x);
			if (!ep.children.length) {
				ep.innerHTML = xmlToText(chunk.value) || '<em>' + _('EMPTY') + '</em>';
			} else {
				ep.classList.add('par', 'tei');
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
			if (h.name == '.t_header') {
				var html = '';
				var x = parseXml(h.value);
				html = '<h2>' + selToText(x, 'title') + '</h2>'
					+ '<h3>' + selToText(x, 'author') + '</h3>' + html;
				sel('#header').innerHTML = html;
			}
			if (h.name == '.t_annotations') {
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
		var tv = localStorage.tableview;
		var ep = document.createElement('div');
		if (tv) ep.className = 'table';
		each('s,l', function (s, si) {
			var es = document.createElement(tv ? 'table' : 'div');
			es.className = 's';
			es.dataset.sid = si;
			if (tv) {
				es.innerHTML = '<tbody><tr><th>' + _('Token') + '</th><th>' + _('Lemma') + '</th><th>' + _('Detailed') + '</th><th>' + _('Simple') + '</th><th></th></tr></tbody>'
				es = es.children[0];
			}
			each('token', function (w, wi) {
				var ew = document.createElement(tv ? 'tr' : 'span');
				var j = w.getAttribute('join') || '';
				ew.className = 't';
				if (['left', 'both'].indexOf(j) != -1) ew.className += ' left';
				if (['right', 'both'].indexOf(j) != -1) ew.className += ' right';
				ew.dataset.tid = wi;
				var tkn = sel('form', w);
				if (!tkn) return;
				if (tkn.getAttribute('modified') == 'True') ew.className += ' modified';
				var morph = sel('morph', w);
				if (morph && morph.getAttribute('check') == 'False') {
					ew.className += ' unchecked';
					if (find('ana', morph).length == 1) ew.className += ' single';
				} else {
					morph = false;
				}
				if (tv) {
					var et = document.createElement('td');
					et.innerHTML = tkn.innerHTML || '&nbsp;';
					et.className = 'as-parent';
					ew.appendChild(et);
					var ana = sel('ana[correct="True"]', w);
					et = document.createElement('td');
					et.className = 'as-parent';
					et.innerHTML = ana ? sel('lemma', ana).textContent : '&nbsp;';
					ew.appendChild(et);
					et = document.createElement('td');
					et.className = 'as-parent';
					et.innerHTML = ana ? sel('detailed', ana).textContent : '&nbsp;';
					ew.appendChild(et);
					et = document.createElement('td');
					et.className = 'as-parent';
					et.innerHTML = ana ? sel('simple', ana).textContent : '&nbsp;';
					ew.appendChild(et);
					et = document.createElement('td');
					if (morph && ana) {
						et.className = 'selAna';
						et.dataset.tid = wi;
						et.dataset.ana = 'default';
						et.innerHTML = '✓';
					} else {
						et.className = 'as-parent';
						et.innerHTML = '&nbsp;';
					}
					ew.appendChild(et);
				} else {
					ew.innerHTML = tkn.innerHTML || '&nbsp;';
				}
				es.appendChild(ew);
			}, s);
			var ew = document.createElement(tv ? 'tr' : 'span');
			ew.className = 'cfg';
			if (!s.getAttribute('sent')) ew.className += ' unchecked';
			ew.innerHTML = tv ? '<td colspan="5" class="as-parent">⚙</td>' : '⚙';
			es.appendChild(ew);
			ep.appendChild(tv ? es.parentNode : es);
		}, dom);
		return ep;
	}

	function savePar(cids) {
		var hdata = {};
		if (_annots.changed) {
			hdata[_annots.id] = _annots.xml.documentElement.outerHTML;
			_annots.changed = false;
		}
		editor.onchange(cids, hdata);
	}

	function updAnnot(from, to) {
		if (!_annots.xml) return;
		var t1 = to[0].getAttribute('xml:id');
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
	}

	function updJoin(tid, xtl) {
		var l = tid > 0 && ['right', 'both'].indexOf(xtl[tid - 1].getAttribute('join')) != -1;
		var r = tid < xtl.length - 1 && ['left', 'both'].indexOf(xtl[tid + 1].getAttribute('join')) != -1;
		xtl[tid].setAttribute('join', l ? (r ? 'both' : 'left') : (r ? 'right' : 'no'));
	}

	function updAna(tokens, cid) {
		token = tokens.shift();
		var formData = new FormData();
		formData.append('file', new Blob(['form\n' + sel('form', token).textContent + '\n'], { type: 'text/plain' }), 'input.txt');
		fetch('/proxy?u=' + encodeURIComponent('http://emtsv.elte-dh.hu:5000/morph'), {
			method: 'POST',
			body: formData
		}).then(r => r.text()).then(function (data) {
			data = data.replace(/^[^\r\n]*[\r\n]+[^\t]*\t/, '');
			data = JSON.parse(data);
			var morph = sel('morph', token);
			each('ana', function (i) { delNode(i); }, morph);
			var tpl = sel('ana', _active[cid]);
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
					morph.insertBefore(_active[cid].createTextNode(tpl.previousSibling.textContent), ana);
				}
			}
			morph.setAttribute('check', 'False');
			if (tokens.length) {
				updAna(tokens, cid);
			} else {
				savePar([cid]);
			}
		});
	}

	document.addEventListener('click', function (e) {
		var t = e.target;
		if (!t) return;

		var c = t.closest('.par.tei');
		if (!c) return;

		if (localStorage.tableview && t.classList.contains('as-parent')) t = t.parentNode;

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
					html += TOKEN.getLink(tid, 'edit ana', 'Select Ana.');
				}
				if (_annots.xml) {
					html += TOKEN.getSelect(tid, 'add annot', '', 'New Annotation...', ANNOT_TYPE);
					// annotations containing the token
					var has = false;
					var lst = {};
					var items = _annots.ref[xt.getAttribute('xml:id')];
					for (var i in items || {}) {
						if (items[i] == 0) continue;
						has = true;
						lst[i] = xmlToText(_annots.list[i].innerHTML);
					}
					if (has) html += TOKEN.getSelect(tid, 'delfrom annot', '', 'Delete From Annotation...', lst);
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
					if (has) html += TOKEN.getSelect(tid, 'addto annot', '', 'Add To Annotation...', lst);
				}
				html += TOKEN.getSelect(tid, 'edit sticky', xt.getAttribute('join') || '?', 'Sticks To...', TOKEN_STICKY);
				var tkn = selToText(xt, 'form', true);
				if (tkn.length > 1) {
					var split = {};
					for (var i = 1; i < tkn.length; ++i) {
						split[i] = encXml(tkn.substr(0, i)) + ' | ' + encXml(tkn.substr(i));
					}
					html += TOKEN.getSelect(tid, 'split token', '', 'Split Token...', split);
				}
				//html += TOKEN.getSelect(tid, 'edit tokentype', xt.nodeName, '', { w: 'Type: Word', pc: 'Type: Punct' });
				html += TOKEN.getSelect(tid, 'join token', '', 'Join Token...', TOKEN.SEL_WHERE);
				html += TOKEN.getLink(tid, 'edit token', 'Fix Token');
				html += TOKEN.getLink(tid, 'ins token', 'Insert Token');
				html += TOKEN.getLink(tid, 'del token', 'Delete Token');
			} else {
				s.classList.add('active');
				html += TOKEN.getSelect(tid, 'edit sent', (xs.getAttribute('sent') || '').split(';'), 'Select Sentinence...', SENT_TYPE, true);
			}
			if (xt) {
				html += TOKEN.getSelect(tid, 'split sent', '', 'Split Sentence...', TOKEN.SEL_WHERE);
			} else {
				html += TOKEN.getSelect(tid, 'join sent', '', 'Join Sentence...', TOKEN.SEL_WHERE);
				html += TOKEN.getSelect(tid, 'move sent', '', 'Move Sentence...', TOKEN.SEL_WHERE);
			}

			var tt = ttip(t, e);
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
			html += '<div class="center">' + TOKEN.getLink(tid, 'btn ana fetch', 'Re-Analyze') + TOKEN.getLink(tid, 'btn ana save', 'Save') + '</div>';
			var tt = ttip(sel('.cfg', s), e, true);
			tt.innerHTML += html;
			evt('table input', 'focus', function () { trg('.btn', 'click', this.closest('tr')); }, tt)
			return;
		}
		if (t.matches('.selAna')) {
			if (t.dataset.ana === 'default') {
				var morph = sel('morph', xt);
				each('ana[correct="True"]', function (i, idx) { if (idx) i.setAttribute('correct', 'False'); });
				morph.setAttribute('check', 'True');
				savePar([cid]);
			} else {
				each('ana', function (i) { i.setAttribute('correct', 'False') }, xt);
				each('.btn.selAna', function (i) { i.classList.remove('selected') }, t.closest('table'));
				t.classList.add('selected');
				if (t.dataset.ana) find('ana', xt)[t.dataset.ana].setAttribute('correct', 'True');
			}
			return;
		}
		if (t.matches('.save.ana')) {
			var morph = sel('morph', xt);
			var mod = sel('ana[modified="True"]', morph);
			if (mod) delNode(mod);
			if (!sel('ana[correct="True"]', morph)) {
				var input = sel('.selAna.selected', t.closest('.tooltip'));
				if (!input) {
					addMsg(_('No Selected Analyzation'), null, t.closest('.tooltip'));
					return;
				}
				input = find('input', input.closest('tr'));
				var vals = [
					input[0].value.trim(),
					input[1].value.trim(),
					input[2].value.trim()
				];
				if (!vals[0].length || vals[0].indexOf(' ') != -1) {
					addMsg(_('Invalid Format'), null, input[0]);
					return;
				}
				// if (vals[1].length && !vals[1].match(/^\S+\[\/\S+\](=\S+)?(\s+\+\s+\S*\[[^\]]+\](=\S+)?)*$/)) {
				// 	addMsg(_('Invalid Format'), null, input[1]);
				// 	return;
				// }
				// if (!vals[2].length || !vals[2].match(/^\[\/\S+\](\[[^\]]+\])*$/)) {
				// 	addMsg(_('Invalid Format'), null, input[2]);
				// 	return;
				// }
				var tpl = sel('ana', x);
				var ana = parseXml(tpl.outerHTML).documentElement;
				ana.setAttribute('correct', 'True');
				ana.setAttribute('modified', 'True');
				sel('lemma', ana).textContent = vals[0];
				sel('detailed', ana).textContent = vals[1];
				sel('simple', ana).textContent = vals[2];
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
			updAna([xt], cid);
			return;
		}

		if (t.matches('.edit.token')) {
			var html = '';
			html += '<input type="text" class="input" value="' + selToText(xt, 'form') + '">';
			html += '<div class="center">' + TOKEN.getLink(tid, 'btn token save', 'Save') + '</div>';
			var tt = ttip(sel('.cfg', s), e, true);
			tt.innerHTML += html;
			return;
		}
		if (t.matches('.save.token')) {
			var tkn = sel('form', xt);
			var input = sel('input', t.closest('.tooltip'));
			var val = input.value.trim();
			if (tkn.textContent == val) {
				trg(t.closest('.tooltip'), 'close');
				return;
			}
			if (!val.length || val.indexOf(' ') != -1) {
				addMsg(_('Invalid Format'), null, input);
				return;
			}
			tkn.setAttribute('modified', "True");
			var morph = sel('morph', xt);
			if (morph) { morph.setAttribute('check', 'False'); morph.innerHTML = ''; }
			tkn.textContent = val;
			updAna([xt], cid);
			return;
		}

		if (t.matches('.ins.token')) {
			var html = '';
			html += '<input type="text" class="input" value="">';
			html += '<div class="center">'
				+ TOKEN.getLink(tid, 'btn token ins2 left', 'Insert Before <b>%word%</b>').replace('%word%', selToText(xt, 'form'))
				+ TOKEN.getLink(tid, 'btn token ins2 right', 'Insert After <b>%word%</b>').replace('%word%', selToText(xt, 'form'))
				+ '</div>';
			var tt = ttip(sel('.cfg', s), e, true);
			tt.innerHTML += html;
			return;
		}
		if (t.matches('.ins2.token')) {
			var input = sel('input', t.closest('.tooltip'));
			var val = input.value.trim();
			if (!val.length || val.indexOf(' ') != -1) {
				addMsg(_('Invalid Format'), null, input);
				return;
			}
			var xt2 = parseXml(xt.outerHTML).documentElement;
			xt2.setAttribute('xml:id', getUID(x, xt.getAttribute('xml:id').split('_')[0]));
			var tkn = sel('form', xt2);
			tkn.textContent = val;
			tkn.setAttribute('modified', 'True');
			var morph = sel('morph', xt2);
			if (morph) {
				morph.setAttribute('check', 'False');
				morph.innerHTML = '';
			}
			var tn = xt.previousSibling && xt.previousSibling.nodeName == '#text' ? xt.previousSibling.textContent : '';
			xs.insertBefore(xt2, t.classList.contains('left') ? xt : xt.nextSibling);
			if (tn.length) xs.insertBefore(x.createTextNode(tn), t.classList.contains('left') ? xt : xt.nextSibling);
			updAna([xt2], cid);
			return;
		}

		if (t.matches('.del.token')) {
			var id = xt.getAttribute('xml:id');
			delNode(xt);
			updAnnot([id], []);
			savePar([cid]);
			return;
		}

	});

	document.addEventListener('change', function (e) {
		var t = e.target;
		if (!t) return;

		var c = t.closest('.par.tei');
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

		var val = t.dataset.value || t.value;
		if (t.classList.contains('multiple')) val = JSON.parse(t.dataset.value);

		if (t.matches('.edit.sent')) {
			val = val.join(';');
			if ((xs.getAttribute('sent') || '') == val) return;
			xs.setAttribute('sent', val);
			savePar([cid]);
			return;
		}

		if (t.matches('.join.sent')) {
			if (val == '') return;
			var off = val == '0' ? -1 : 1;
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
			u[0].setAttribute('modified', 'True');
			u[0].innerHTML = u[0].innerHTML.replace(/[ \r\n\t]+$/, '') + u[1].innerHTML;
			var id2 = u[1].getAttribute('xml:id').split('_');
			delNode(u[1]);
			var id1 = u[0].getAttribute('xml:id').split('_');
			if (id1.length > 1) {
				if (id2.length > 1) {
					u[0].setAttribute('xml:id', '');
					u[0].setAttribute('xml:id', getUID(x, id1[0]));
				} else {
					u[0].setAttribute('xml:id', id2[0]);
				}
			}
			savePar(cids);
			return;
		}

		if (t.matches('.split.sent')) {
			if (val == '') return;
			var xt2 = xtl[parseInt(tid) + (val == '0' ? 0 : 1)];
			if (!xt2 || xt2 == xtl[0]) {
				addMsg(_('Invalid Action'));
				return;
			}
			var indent = xs.previousSibling && xs.previousSibling.nodeName == '#text' ? xs.previousSibling.textContent : '';
			xs.setAttribute('modified', 'True');
			xs.insertBefore(x.createElement('split'), xt2);
			var xe = x.documentElement;
			var id = xs.getAttribute('xml:id').split('_')[0];
			xe.innerHTML = xe.innerHTML.replace(/([ \t\r\n]*)<split[^>]*>/
				, indent + '</' + xs.nodeName + '>' + indent + '<' + xs.nodeName + (id ? ' xml:id="' + getUID(x, id) + '"' : '') + ' modified="True"> $1');
			savePar([cid]);
			return;
		}

		if (t.matches('.move.sent')) {
			if (val == '') return;
			var off = val == '0' ? -1 : 1;
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
			xt.setAttribute('join', val);
			if (tid > 0) updJoin(tid - 1, xtl);
			if (tid < xtl.length - 1) updJoin(tid + 1, xtl);
			savePar([cid]);
			return;
		}

		if (t.matches('.join.token')) {
			if (val == '') return;
			var off = val == '0' ? -1 : 1;
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
			updAna([u[0]], cid);
			return;
		}

		if (t.matches('.split.token')) {
			if (val == '') return;
			var tkn = sel('form', xt);
			tkn.setAttribute('modified', 'True');
			var morph = sel('morph', xt);
			if (morph) {
				morph.setAttribute('check', 'False');
				morph.innerHTML = '';
			}
			var xt2 = parseXml(xt.outerHTML).documentElement;
			sel('form', xt2).textContent = tkn.innerHTML.substr(val);
			var id1 = xt.getAttribute('xml:id');
			if (id1) xt2.setAttribute('xml:id', getUID(x, id1.split('_')[0]));
			tkn.textContent = tkn.textContent.substr(0, val);
			xs.insertBefore(xt2, xt.nextSibling);
			if (xt.previousSibling && xt.previousSibling.nodeName == '#text') {
				xs.insertBefore(x.createTextNode(xt.previousSibling.textContent), xt.nextSibling);
			}
			updAnnot([id1], [xt, xt2]);
			updAna([xt, xt2], cid);
			return;
		}

		// if (t.matches('.edit.tokentype')) {
		// 	if (val == '' || val == xt.nodeName) return;
		// 	var xt2 = x.createElement(val);
		// 	xt2.innerHTML = xt.innerHTML;
		// 	sel('form', xt2).setAttribute('modified', 'True');
		// 	var id = x.documentElement.getAttribute('xml:id');
		// 	if (id) {
		// 		xt2.setAttribute('xml:id', getUID(x, val + id));
		// 		updAnnot([xt.getAttribute('xml:id')], [xt2]);
		// 	}
		// 	xs.insertBefore(xt2, xt);
		// 	xt.remove();
		// 	savePar([cid]);
		// 	return;
		// }

		// annotation stuff

		if (t.matches('.add.annot')) {
			if (val == '' || !_annots.xml) return;
			var i = _annots.xml.createElement(xt.nodeName);
			i.setAttribute('target', xt.getAttribute('xml:id'));
			i.textContent = sel('form', xt).textContent;
			var a = _annots.xml.createElement('annotation');
			a.setAttribute('entity', val);
			a.appendChild(i);
			//TODO: sort?
			_annots.xml.documentElement.appendChild(a);
			_annots.changed = true;
			savePar();
			return;
		}

		if (t.matches('.addto.annot')) {
			if (val == '' || !_annots.xml) return;
			var an = _annots.list[val.substr(1)];
			var i = _annots.xml.createElement(xt.nodeName);
			i.setAttribute('target', xt.getAttribute('xml:id'));
			i.textContent = sel('form', xt).textContent;
			an.insertBefore(i, val[0] == 'F' ? an.children[0] : null);
			_annots.changed = true;
			savePar();
			return;
		}

		if (t.matches('.delfrom.annot')) {
			if (val == '' || !_annots.xml) return;
			var an = _annots.list[val];
			sel('[target="' + xt.getAttribute('xml:id') + '"]', an).remove();
			if (!sel('[target]', an)) an.remove();
			_annots.changed = true;
			savePar();
			return;
		}

	});

})();
